# iUM - Insight, Understanding, Mastery

An agentic learning ecosystem featuring dual learning modes for focused study and casual learning, powered by RAG (Retrieval-Augmented Generation) and vector similarity search.

## Project Structure

```
iUM/
├── apps/
│   ├── web/              # Next.js 15 frontend application
│   │   ├── components/   # React components
│   │   │   ├── views/    # Hard/Soft learning views
│   │   │   ├── SocialMode/  # Reels & social features
│   │   │   ├── ui/       # Shadcn/ui components
│   │   │   └── layout/   # Layout components
│   │   ├── lib/          # Utilities & state management
│   │   └── types/        # TypeScript type definitions
│   └── api/              # FastAPI backend
│       ├── routers/      # API endpoints
│       ├── models/       # Pydantic models
│       ├── utils/        # RAG chain, vector store, Supabase client
│       └── migrations/   # Database migrations
├── docs/                 # 📚 Documentation files
│   ├── SETUP_GUIDE.md
│   ├── SUPABASE_SETUP.md
│   ├── DEPLOY.md
│   ├── MULTI_AGENT_PROPOSAL.md
│   └── ...
├── tests/                # 🧪 Test files and utilities
├── package.json          # Monorepo root configuration
└── README.md
```

## Tech Stack

### Frontend (`apps/web`)
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn/ui (Radix UI based)
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **State Management:** Zustand
- **Math Rendering:** KaTeX, react-katex
- **Markdown:** ReactMarkdown with remark-math, remark-gfm
- **Diagrams:** Mermaid.js
- **Database Client:** Supabase JS Client

### Backend (`apps/api`)
- **Framework:** FastAPI (Python)
- **AI/ML:** LangChain, Google Gemini (gemini-2.5-flash)
- **Vector DB:** ChromaDB with pgvector (Supabase)
- **Embeddings:** Google text-embedding-004 (768 dimensions)
- **Storage:** Supabase Storage
- **Database:** Supabase PostgreSQL

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Supabase account (for database & storage)
- Google API Key (for Gemini LLM)

### Backend Setup

1. Navigate to the API directory:
```bash
cd apps/api
```

2. Create virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

3. Configure environment variables (`.env`):
```env
GOOGLE_API_KEY=your_google_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

4. Run database migrations in Supabase SQL Editor:
```sql
-- migrations/001_create_files_table.sql
-- migrations/002_add_quiz_and_embedding_to_reels.sql
```

5. Start the backend server:
```bash
./run.sh
# or manually:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup

1. Navigate to the web directory:
```bash
cd apps/web
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
./run.sh
# or: npm run dev
```

The application will be available at `http://localhost:3000`

## Features

### Dual-Mode Architecture

#### 1. Hard Mode (Deep Dive Study)
Desktop-like workspace for focused, intensive learning.

**Components:**
- **Folder Sidebar** - Organize documents into folders with drag & drop
- **Main Content Area** - View documents, math equations (LaTeX), and Mermaid diagrams
- **Chat Sidebar** - AI tutor powered by RAG for contextual Q&A
- **Sources Panel** - View retrieved document sources

**Features:**
- PDF/Text document upload and processing
- Vector-based document retrieval (ChromaDB)
- Folder-scoped RAG queries
- Math equation rendering with KaTeX
- Mermaid diagram visualization
- Learning unit generation (concepts, summaries, quizzes)

#### 2. Soft Mode (Casual Learning)
TikTok/Reels-style interface for bite-sized learning content.

**Components:**
- **Reel Player** - Full-screen video player with swipe navigation
- **Quiz Overlay** - Interactive quizzes embedded in reels
- **Social Sidebar** - Navigation between Feed, Search, Explore, Profile
- **Upload Dialog** - Create reels with optional quizzes

**Features:**
- Short-form video content feed
- **Interactive Quizzes in Reels:**
  - Quiz appears at specified timestamp (or 50% of video)
  - Video pauses until correct answer
  - Hints shown on wrong answers
  - Quiz completion tracking
- Folder-based content filtering
- Like, bookmark, and comment interactions
- Hashtag-based categorization
- User profile with uploaded reels

### Reels Recommendation System
Vector similarity-based content recommendation.

**How it works:**
1. User's active folders contain documents with embeddings (ChromaDB)
2. Calculate centroid (average) of document embeddings
3. Find reels with similar quiz embeddings using pgvector cosine similarity
4. Recommend most relevant educational content

**API Endpoint:** `GET /api/reels/recommend?folder_ids=id1,id2&limit=5`

### Global Navigation
- Persistent left-side dock for mode switching
- Quick access to: Hard Mode, Soft Mode
- Streak tracking, notifications
- Profile and settings

## API Endpoints

### Agent
- `POST /api/agent/chat` - RAG-based chat with AI tutor
- `POST /api/agent/summarize` - Generate study summaries

### Ingest
- `POST /api/ingest/upload` - Upload and process documents

### Workspace
- `GET /api/workspace/{id}` - Get workspace structure
- `GET /api/workspace/{id}/folders` - Get files from database

### Reels
- `GET /api/reels/list` - List all reels
- `GET /api/reels/{id}` - Get specific reel
- `POST /api/reels/upload` - Upload video reel
- `POST /api/reels/create-with-quiz` - Create reel with embedded quiz
- `PATCH /api/reels/{id}/quiz` - Add/update quiz for existing reel
- `GET /api/reels/recommend` - Get recommended reels based on folder content
- `DELETE /api/reels/{id}` - Delete a reel

### Feed
- `GET /api/feed` - Get learning feed items

## Database Schema

### Files Table
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Reels Table
```sql
CREATE TABLE reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  tags TEXT[],
  folder_name TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  quiz JSONB,                    -- Quiz data (question, options, answer)
  quiz_embedding VECTOR(768),    -- For similarity search
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Vector Search Function
```sql
CREATE FUNCTION match_reels_by_embedding(
  query_embedding VECTOR(768),
  match_count INT,
  similarity_threshold FLOAT
) RETURNS TABLE(...) AS $$
  -- Cosine similarity search using pgvector
$$;
```

## Development Status

- [x] Monorepo structure
- [x] Next.js 15 setup with TypeScript
- [x] Shadcn/ui components
- [x] Global layout with navigation dock
- [x] Zustand state management
- [x] Hard Mode implementation
  - [x] Folder management
  - [x] Document upload & processing
  - [x] RAG-based AI chat
  - [x] Math & diagram rendering
  - [x] Learning unit display
- [x] Soft Mode implementation
  - [x] Reels player UI
  - [x] Quiz overlay system
  - [x] Upload with quiz support
  - [x] Social interactions (like, bookmark)
- [x] Backend API
  - [x] FastAPI setup
  - [x] RAG pipeline with LangChain
  - [x] Supabase integration
  - [x] Reels CRUD with quiz
  - [x] Vector similarity recommendation
- [ ] Production deployment
- [ ] User authentication (Supabase Auth)
- [ ] Spaced repetition system

## Scripts

### Backend
```bash
# Start backend server
./apps/api/run.sh

# Manual start
cd apps/api && uvicorn main:app --reload --port 8000
```

### Frontend
```bash
# Start frontend dev server
./apps/web/run.sh

# Manual start
cd apps/web && npm run dev
```

## License

Private project for Hackathon
