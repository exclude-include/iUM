# iUM Backend API

FastAPI backend for the iUM learning platform with Supabase integration.

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
# Edit .env and add your credentials:
# - GOOGLE_API_KEY: Your Google Gemini API key (required)
# - SUPABASE_URL: Your Supabase project URL (required)
# - SUPABASE_KEY: Your Supabase anon key (required)
# - OPIK_API_KEY: Your Opik API key (optional, for tracing)
```

4. Set up Supabase database:
   - See [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) for detailed schema setup
   - Run the SQL commands in your Supabase SQL editor

5. Run the development server:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

API documentation (Swagger UI) will be available at `http://localhost:8000/docs`

## API Endpoints

### Accounts
- `POST /api/accounts` - Create a new account
- `GET /api/accounts/{account_id}` - Get account by ID
- `GET /api/accounts/email/{email}` - Get account by email
- `PUT /api/accounts/{account_id}` - Update account
- `DELETE /api/accounts/{account_id}` - Delete account

### Feed (Reels)
- `GET /api/feed` - Get short-form content feed for Soft View (from Supabase)
- `POST /api/feed/reels` - Create a new reel

### Workspace
- `GET /api/workspace/{workspace_id}` - Get workspace content for Hard View
- `GET /api/workspace/{workspace_id}/folders` - Get folders in workspace
- `GET /api/workspace/{workspace_id}/history` - Get learning history (JSON format from Supabase)
- `POST /api/workspace/{workspace_id}/history` - Create new history item

### Google Drive Integration
- `POST /api/google-drive/auth` - Save Google OAuth tokens
- `GET /api/google-drive/auth/{account_id}` - Get Google integration status
- `DELETE /api/google-drive/auth/{account_id}` - Revoke Google integration
- `POST /api/google-drive/files/sync` - Sync Google Drive files to database
- `GET /api/google-drive/files` - Get synced Drive files
- `DELETE /api/google-drive/files/{file_id}` - Delete Drive file record

### Agent (RAG-based Chat)
- `POST /api/agent/chat` - Chat with AI agent using RAG pipeline
  - Uses Feynman Technique prompt
  - Retrieves relevant context from VectorDB
  - Traced with Opik
- `GET /api/agent/chat/{conversation_id}/history` - Get conversation history

### Document Ingestion
- `POST /api/ingest` - Upload and process PDF/Text files
  - Accepts PDF or text files
  - Saves file metadata to Supabase (files table)
  - Chunks documents using RecursiveCharacterTextSplitter
  - Embeds using Google Generative AI
  - Stores in ChromaDB collection "user_knowledge"
- `GET /api/ingest/status` - Get VectorDB collection status

## Database Integration

### Supabase Tables

1. **accounts** - User account information
2. **files** - Uploaded file metadata
3. **google_integrations** - Google OAuth tokens
4. **File metadata stored in Supabase
   - Chunking with RecursiveCharacterTextSplitter (1000 chars, 200 overlap)
3. **Embeddings**: Google Generative AI embeddings
4. **LLM**: Google Gemini 2.5 Flashrt-form learning content

See [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) for complete schema details.

### History JSON Format

History items are stored with a flexible JSON structure:

```json
{
  "messages": [...],
  "sources": [...],
  "duration_seconds": 300,
  "topics": ["Linear Algebra", "Tensors"],
  "summary": "Studied Levi-Civita tensor properties"
}
```

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
Create an account**:
```bash
curl -X POST "http://localhost:8000/api/accounts" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John Doe"}'
```

2. **Ingest a document**:
```bash
curl -X POST "http://localhost:8000/api/ingest" \
  -F "file=@document.pdf" \
  -F "account_id=your-account-id" \
  -F "folder_id=optional-folder-id"
```

3. **Chat with the agent**:
```bSupabase database integration
- ✅ Account management system
- ✅ Google Drive integration endpoints
- ✅ History tracking with JSON storage
- ✅ File upload with metadata tracking
- ✅ Reels (short-form content) management
- ✅ VectorDB integration (ChromaDB)
- ✅ LangChain RAG pipeline
- ✅ Opik integration for agent tracing
- ✅ File upload handling (PDF/Text)
- ✅ Feynman Technique prompt
- ✅ Google Gemini AI integration

### TODO
- [ ] Google OAuth flow implementation (frontend + backend)
- [ ] Google Drive file sync automation
- [ ] Authentication & authorization (JWT/Sessions)
- [ ] Real-time updates (WebSockets)
- [ ] Conversation memory/context management
- [ ] Advanced retrieval strategies (hybrid search, reranking)
- [ ] File storage in Supabase Storage
- [ ] Workspace and folder management in database
    "history_type": "study",
    "content": {
      "duration_seconds": 300,
      "topics": ["Linear Algebra"],
      "summary": "Learned about tensor properties"
    }
  }'
```

5. **Connect Google Drive**:
```bash
curl -X POST "http://localhost:8000/api/google-drive/auth" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "your-account-id",
    "access_token": "your-google-access-token",
    "refresh_token": "your-google-refresh-token"
  
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

