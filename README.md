# Transaction Analytics + RAG Chatbot

Upload CSV transaction data, view charts & summaries, and ask AI questions about your data.

## Quick Start (Docker)

### 1. Add your OpenAI API key

Edit `backend/.env.local` and replace the placeholder:

```
OPENAI_API_KEY=sk-proj-YOUR-ACTUAL-KEY-HERE
```

Get a key at: https://platform.openai.com/api-keys

### 2. Run

```bash
docker compose up --build
```

### 3. Open

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001/docs

---

## How It Works

1. **Upload** a CSV file with transaction data
2. **View** auto-detected schema, summary tables, and charts
3. **Ask AI** questions — it answers using only your uploaded data

### CSV Format

Your CSV needs at minimum:

| Required Column | Examples |
|---|---|
| Price/Amount | `price`, `amount`, `harga` |
| Quantity | `qty`, `quantity`, `jumlah` |
| Category OR Product | `category`, `product_name`, `type` |

Optional: `rating`, `date`

### Example CSV

```csv
Category,Product_Name,Price,Quantity,Rating
Electronics,Laptop,999.99,150,4.5
Electronics,Smartphone,699.99,300,4.3
Clothing,T-Shirt,29.99,500,4.0
Food,Pizza,12.99,1000,4.6
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, Tailwind CSS, Recharts, Framer Motion |
| Backend | FastAPI, Python, Pandas |
| AI | OpenAI GPT-4.1-mini via LangChain |
| Database | MongoDB (for future persistence) |

---

## Project Structure

```
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── server.py          # FastAPI app with RAG logic
│   ├── .env.local         # YOUR OpenAI key goes here
│   └── requirements.docker.txt
├── frontend/
│   ├── Dockerfile
│   ├── .env.local         # Backend URL config
│   └── src/
│       ├── App.js         # Main React app
│       └── index.css      # Dark theme styles
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/` | Health check |
| `POST` | `/api/upload` | Upload CSV (multipart form) |
| `POST` | `/api/regroup` | Regroup by category/product |
| `POST` | `/api/ask` | Ask AI a question |

---

## Stopping

```bash
docker compose down
```

To also remove stored data:

```bash
docker compose down -v
```
