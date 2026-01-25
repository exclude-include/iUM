# iUM Backend API

FastAPI backend for the iUM learning platform.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your API keys:
# - OPENAI_API_KEY: Your OpenAI API key (required)
# - OPIK_API_KEY: Your Opik API key (optional, for tracing)
```

4. Run the development server:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

API documentation (Swagger UI) will be available at `http://localhost:8000/docs`

## API Endpoints

### Feed
- `GET /api/feed` - Get short-form content feed for Soft View

### Workspace
- `GET /api/workspace/{workspace_id}` - Get workspace content for Hard View
- `GET /api/workspace/{workspace_id}/folders` - Get folders in workspace

### Agent (RAG-based Chat)
- `POST /api/agent/chat` - Chat with AI agent using RAG pipeline
  - Uses Feynman Technique prompt
  - Retrieves relevant context from VectorDB
  - Traced with Opik
- `GET /api/agent/chat/{conversation_id}/history` - Get conversation history

### Document Ingestion
- `POST /api/ingest` - Upload and process PDF/Text files
  - Accepts PDF or text files
  - Chunks documents using RecursiveCharacterTextSplitter
  - Embeds using OpenAI text-embedding-3-small
  - Stores in ChromaDB collection "user_knowledge"
- `GET /api/ingest/status` - Get VectorDB collection status

## RAG Pipeline

The RAG (Retrieval-Augmented Generation) pipeline is implemented with:

1. **VectorDB**: ChromaDB for persistent storage of document embeddings
2. **Document Processing**: 
   - PDF files using PyPDFLoader
   - Text files directly
   - Chunking with RecursiveCharacterTextSplitter (1000 chars, 200 overlap)
3. **Embeddings**: OpenAI text-embedding-3-small
4. **LLM**: GPT-4o for generating responses
5. **Feynman Tutor Prompt**: Encourages students to explain concepts back
6. **Opik Tracing**: All LangChain operations are traced

### Usage Example

1. **Ingest a document**:
```bash
curl -X POST "http://localhost:8000/api/ingest" \
  -F "file=@document.pdf"
```

2. **Chat with the agent**:
```bash
curl -X POST "http://localhost:8000/api/agent/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain the Levi-Civita tensor"}'
```

## Development

### Completed Features
- ✅ VectorDB integration (ChromaDB)
- ✅ LangChain RAG pipeline
- ✅ Opik integration for agent tracing
- ✅ File upload handling (PDF/Text)
- ✅ Feynman Technique prompt

### TODO
- [ ] Database integration (PostgreSQL/MongoDB) for user data
- [ ] Pinecone integration option for production
- [ ] Authentication & authorization
- [ ] Real-time updates (WebSockets)
- [ ] Conversation memory/context management
- [ ] Advanced retrieval strategies (hybrid search, reranking)

