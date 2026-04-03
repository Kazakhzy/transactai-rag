from fastapi import FastAPI, APIRouter, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone

import pandas as pd

ROOT_DIR = Path(__file__).parent
# dotenv removed

mongo_url = os.getenv('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.getenv('DB_NAME')]

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# Determine which LLM backend to use

app = FastAPI()
api_router = APIRouter(prefix="/api")

sessions = {}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# --- RAG Logic ---

def detect_columns(df):
    df.columns = df.columns.str.strip()
    def find_col(keywords):
        for col in df.columns:
            for kw in keywords:
                if kw in col.lower():
                    return col
        return None

    price = find_col(["price", "amount", "harga"])
    quantity = find_col(["qty", "quantity", "jumlah"])
    rating = find_col(["rating", "score", "review"])
    category = find_col(["category", "kategori", "group", "type"])
    product_name = find_col(["product_name", "item_name", "name"])
    product_id = find_col(["product_id", "productno", "sku", "code"])
    product = product_name or product_id

    if not price or not quantity:
        raise ValueError("Price or quantity column not found")
    if not category and not product:
        raise ValueError("No category or product column found")

    return {
        "price": price,
        "quantity": quantity,
        "rating": rating,
        "category": category,
        "product": product,
        "product_is_id": product == product_id
    }


def clean_transactions(df, schema):
    df = df.copy()
    price_col = schema["price"]
    qty_col = schema["quantity"]
    df[price_col] = (
        df[price_col].astype(str)
        .str.replace("$", "", regex=False)
        .str.replace(",", "", regex=False)
        .astype(float)
    )
    df["revenue"] = df[price_col] * df[qty_col]
    return df


def resolve_group_key(schema, user_choice=None):
    if user_choice == "category" and schema.get("category"):
        return schema["category"], "category"
    if user_choice == "product" and schema.get("product"):
        return schema["product"], "product"
    if schema.get("category"):
        return schema["category"], "category"
    return schema["product"], "product"


def summarize_data(df, group_key, schema):
    qty = schema["quantity"]
    rating = schema.get("rating")
    agg = {qty: "sum", "revenue": "sum"}
    if rating:
        agg[rating] = "mean"
    return df.groupby(group_key).agg(agg).reset_index()


def summary_to_text(summary_df, group_key, group_label, schema):
    qty = schema["quantity"]
    rating = schema.get("rating")
    texts = []
    for _, row in summary_df.iterrows():
        line = (
            f"{group_label.capitalize()} '{row[group_key]}' sold "
            f"{int(row[qty])} units with total revenue ${row['revenue']:.2f}."
        )
        if rating and rating in row.index and pd.notna(row.get(rating)):
            line += f" Average rating: {row[rating]:.2f}."
        texts.append(line)
    return texts


# --- LLM Helpers ---

SYSTEM_PROMPT = (
    "You are a data analyst assistant.\n\n"
    "Rules:\n"
    "- Answer ONLY using the provided context.\n"
    "- If the answer is not present in the data, say: "
    "\"I cannot answer this question based on the uploaded data.\"\n"
    "- Do NOT use external knowledge.\n"
    "- Do NOT make assumptions.\n"
    "- Be concise and data-driven.\n"
    "- Format numbers nicely with currency symbols where appropriate."
)


async def ask_llm_openai(context: str, question: str) -> str:
    """Use OpenAI API directly via LangChain (for local/own key)."""
    from langchain_openai import ChatOpenAI
    from langchain.schema import HumanMessage, SystemMessage

    llm = ChatOpenAI(
        model="gpt-4.1-mini",
        temperature=0,
        openai_api_key=OPENAI_API_KEY,
    )
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"),
    ]
    result = await llm.ainvoke(messages)
    return result.content




# --- Pydantic Models ---

class UploadResponse(BaseModel):
    session_id: str
    preview: list
    columns: list
    summary: list
    summary_columns: list
    chart_data: list
    pie_data: list
    group_key: str
    group_label: str
    group_options: list
    schema_info: dict
    row_count: int
    product_is_id: bool = False


class AskRequest(BaseModel):
    session_id: str
    question: str
    group_choice: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    sources: list


# --- API Routes ---

@api_router.get("/")
async def root():
    return {"message": "Transaction Analytics + RAG API"}


@api_router.post("/upload", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...)):
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content))

    schema = detect_columns(df)
    df_clean = clean_transactions(df, schema)

    group_options = []
    if schema.get("category"):
        group_options.append("category")
    if schema.get("product"):
        group_options.append("product")

    group_key, group_label = resolve_group_key(schema)
    summary = summarize_data(df_clean, group_key, schema)
    summary_texts = summary_to_text(summary, group_key, group_label, schema)

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "df_clean": df_clean,
        "schema": schema,
        "summary_texts": summary_texts,
        "group_key": group_key,
        "group_label": group_label,
    }

    preview_df = df.head(100).fillna("")
    summary_filled = summary.fillna("")

    chart_data = []
    for _, row in summary_filled.iterrows():
        chart_data.append({
            "name": str(row[group_key]),
            "revenue": round(float(row["revenue"]), 2),
            "quantity": int(row[schema["quantity"]]),
        })

    MAX_SLICES = 8
    pie_data_df = summary_filled[summary_filled[schema["quantity"]] > 0]
    pie_data = []
    if len(pie_data_df) <= MAX_SLICES:
        for _, row in pie_data_df.iterrows():
            pie_data.append({
                "name": str(row[group_key]),
                "value": int(row[schema["quantity"]]),
            })

    return UploadResponse(
        session_id=session_id,
        preview=preview_df.to_dict(orient="records"),
        columns=list(df.columns),
        summary=summary_filled.to_dict(orient="records"),
        summary_columns=list(summary.columns),
        chart_data=chart_data,
        pie_data=pie_data,
        group_key=group_key,
        group_label=group_label,
        group_options=group_options,
        schema_info={k: v for k, v in schema.items() if k != "product_is_id"},
        row_count=len(df),
        product_is_id=schema.get("product_is_id", False),
    )


@api_router.post("/regroup")
async def regroup(session_id: str, group_choice: str):
    session = sessions.get(session_id)
    if not session:
        return {"error": "Session not found"}

    df_clean = session["df_clean"]
    schema = session["schema"]

    group_key, group_label = resolve_group_key(schema, group_choice)
    summary = summarize_data(df_clean, group_key, schema)
    summary_texts = summary_to_text(summary, group_key, group_label, schema)

    session["group_key"] = group_key
    session["group_label"] = group_label
    session["summary_texts"] = summary_texts

    summary_filled = summary.fillna("")
    chart_data = []
    for _, row in summary_filled.iterrows():
        chart_data.append({
            "name": str(row[group_key]),
            "revenue": round(float(row["revenue"]), 2),
            "quantity": int(row[schema["quantity"]]),
        })

    MAX_SLICES = 8
    pie_data_df = summary_filled[summary_filled[schema["quantity"]] > 0]
    pie_data = []
    if len(pie_data_df) <= MAX_SLICES:
        for _, row in pie_data_df.iterrows():
            pie_data.append({
                "name": str(row[group_key]),
                "value": int(row[schema["quantity"]]),
            })

    return {
        "summary": summary_filled.to_dict(orient="records"),
        "summary_columns": list(summary.columns),
        "chart_data": chart_data,
        "pie_data": pie_data,
        "group_key": group_key,
        "group_label": group_label,
    }


@api_router.post("/ask", response_model=AskResponse)
async def ask_question(req: AskRequest):
    session = sessions.get(req.session_id)
    if not session:
        return AskResponse(
            answer="Session not found. Please upload a CSV first.",
            sources=[]
        )

    summary_texts = session["summary_texts"]

    # ✅ Better context handling
    context = "\n\n".join(summary_texts[:50])

    answer = await ask_llm_openai(context, req.question)

    return AskResponse(
        answer=answer,
        sources=summary_texts[:3]
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
