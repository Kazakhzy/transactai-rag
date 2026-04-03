# Transaction Analytics + RAG Chatbot - PRD

## Problem Statement
User built a RAG app (Streamlit) for transaction CSV analytics + AI Q&A. Requested UI improvement with dark/moody theme, blues/teals, full-width centered chat, chat bubbles. Also requested Docker local setup and own OpenAI API key support.

## Architecture
- **Frontend**: React + Tailwind CSS + Recharts + Framer Motion
- **Backend**: FastAPI + Pandas + LangChain/EmergentIntegrations
- **AI**: GPT-4.1-mini (supports both OpenAI direct key & Emergent universal key)
- **Database**: MongoDB (via Motor)
- **Deployment**: Docker Compose (MongoDB + Backend + Frontend)

## What's Been Implemented (2026-02-07)
- Ported Streamlit RAG app to React + FastAPI full-stack
- Dark/moody cyber-noir UI with teal/cyan accents
- CSV upload with drag-and-drop
- Auto schema detection (price, quantity, category, product, rating)
- Data preview & summary tables
- Revenue bar chart + quantity pie chart (Recharts)
- AI chat with styled bubbles (user right, AI left)
- Typing indicator animation
- Docker Compose setup for local development
- Dual LLM support: OPENAI_API_KEY (direct) or EMERGENT_LLM_KEY (universal)
- README with complete local setup guide

## Testing Status
- Backend: 100% (4/4 tests passed)
- Frontend: 100% (19/19 features working)
- All verified by testing agent

## Backlog
- P1: Chat history persistence in MongoDB
- P1: Group-by toggle (category/product) in dashboard
- P2: Date-based filtering if date column detected
- P2: Export summary as CSV/PDF
- P3: Multi-file upload support
