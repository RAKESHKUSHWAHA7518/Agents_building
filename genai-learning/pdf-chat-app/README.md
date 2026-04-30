# PDF Chat App — AI-Powered Document Q&A

A full-stack GenAI app that lets you upload any PDF and chat with it using Google Gemini + RAG.

## Tech Stack
- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **AI**: Google Gemini 2.0 Flash
- **RAG**: LangChain.js + custom vector store
- **Embeddings**: Gemini text-embedding-004

## How to Run

### 1. Setup Backend
```bash
cd backend
# Add your Gemini API key to .env
echo "GEMINI_API_KEY=your_key_here" > .env
npm install
node server.js
```

### 2. Setup Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

### 3. Open browser
Go to: http://localhost:5173

## How it Works
1. Upload a PDF → backend splits it into chunks
2. Each chunk is embedded using Gemini embeddings
3. Chunks stored in in-memory vector store
4. You ask a question → question is embedded
5. Most similar chunks retrieved (semantic search)
6. Gemini generates answer using retrieved chunks
7. Answer streamed back word-by-word to the UI
