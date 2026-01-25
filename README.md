# iUM - Insight, Understanding, Mastery

An agentic learning ecosystem powered by Opik, featuring dual learning modes for focused study and casual learning.

## Project Structure

```
iUM/
├── apps/
│   ├── web/          # Next.js 15 frontend application
│   └── api/          # FastAPI backend (to be implemented)
├── package.json      # Monorepo root configuration
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
- **Architecture:** Clean separation of concerns

### Backend (`apps/api`)
- **Framework:** FastAPI (Python)
- **AI/ML:** LangChain, Opik
- **Vector DB:** ChromaDB (dev) / Pinecone (prod)
- **Embeddings:** OpenAI text-embedding-3-small

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (for backend)

### Installation

1. Install dependencies:
```bash
cd apps/web
npm install
```

2. Run the development server:
```bash
npm run dev
# or from root:
npm run dev:web
```

The application will be available at `http://localhost:3000`

## Features

### Dual-Mode Architecture

1. **Hard-Basic View (Deep Dive)**
   - Desktop-like workspace for focused study
   - PDF/Text viewers
   - Folder and tab management
   - Multimodal AI chat agent (Tutor)
   - RAG system for document processing

2. **Soft View (Subconscious)**
   - Short-form video feed (Reels-style)
   - Quizzes and interactive content
   - Spaced repetition system
   - Community features

### Global Navigation Dock
- Persistent left-side navigation bar
- Quick access to: Streak, Insights, Notifications
- Profile and Settings access

## Development

### Project Status
- ✅ Monorepo structure
- ✅ Next.js 15 setup with TypeScript
- ✅ Shadcn/ui components
- ✅ Global layout with navigation dock
- ✅ Zustand state management
- ✅ Hard-Basic View implementation
- 🚧 Soft View implementation
- ✅ Backend API setup
- ✅ RAG pipeline
- 🚧 Agentic tutor

## License

Private project for Hackathon

