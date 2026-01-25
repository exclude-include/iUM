# iUM Frontend

Next.js 15 frontend application for the iUM learning platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## API Integration

The frontend connects to the FastAPI backend at `http://localhost:8000` (configurable via `NEXT_PUBLIC_API_URL`).

### API Client

The API client is located in `lib/api.ts` and provides:

- **Chat API**: `api.chat.sendMessage()`, `api.chat.getHistory()`
- **Ingest API**: `api.ingest.uploadFile()`, `api.ingest.getStatus()`
- **Feed API**: `api.feed.getFeed()`
- **Workspace API**: `api.workspace.getWorkspace()`, `api.workspace.getFolders()`

### Usage Example

```typescript
import { api } from "@/lib/api";

// Send a chat message
const response = await api.chat.sendMessage("Explain the Levi-Civita tensor");

// Upload a document
const file = new File([...], "document.pdf");
const result = await api.ingest.uploadFile(file);

// Get workspace data
const workspace = await api.workspace.getWorkspace("default");
```

## Features

- **Dual-Mode Architecture**: Hard-Basic View (deep dive) and Soft View (reels-style)
- **Type-Safe API**: Full TypeScript types matching backend models
- **Mock Data**: Works with mock data when backend is unavailable
- **Responsive Design**: Mobile-friendly Soft View, desktop-optimized Hard View

## Development

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + Shadcn/ui
- **State Management**: Zustand
- **Animations**: Framer Motion

