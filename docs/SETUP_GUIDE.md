# iUM Setup Guide

Quick setup guide for the iUM learning platform with Google Drive integration and Reels feature.

## Summary of Changes

### 1. Fixed Vercel Deployment Error ✅

**Issue:** Module not found: `@/lib/supabase/client`

**Solution:**
- Created `/apps/web/lib/supabase/client.ts` with Supabase browser client
- Added `@supabase/supabase-js` dependency to `package.json`
- Created `.env.example` for required environment variables

### 2. Implemented Google Drive Integration ✅

**New Files:**
- `/apps/api/routers/integrations.py` - OAuth & Drive sync endpoints
- `/apps/api/models/integrations.py` - Pydantic models
- `/apps/api/utils/supabase_client.py` - Supabase connection utility

**Features:**
- Google OAuth 2.0 authentication
- Drive file synchronization
- Token refresh handling
- Metadata storage in Supabase
- Placeholder for RAG processing

### 3. Implemented Reels Upload Feature ✅

**New Files:**
- `/apps/api/routers/reels.py` - Video upload & management endpoints
- `/apps/api/models/reels.py` - Pydantic models

**Features:**
- Video file upload to Supabase Storage
- Multiple video format support (MP4, MOV, AVI, WebM)
- File size validation (100MB max)
- CRUD operations for reels
- Pagination support

## Installation Steps

### Step 1: Install Frontend Dependencies

```bash
cd apps/web
npm install
```

This will install the new `@supabase/supabase-js` package.

### Step 2: Install Backend Dependencies

```bash
cd apps/api
pip install -r requirements.txt
```

New packages installed:
- `google-auth-oauthlib>=1.2.0`
- `google-api-python-client>=2.108.0`
- `google-auth>=2.25.0`
- `supabase>=2.3.0`
- `postgrest>=0.13.0`
- `storage3>=0.7.0`

### Step 3: Set Up Supabase Database

1. **Run the migration:**

Go to your Supabase SQL Editor and run:
```bash
/apps/api/migrations/001_create_integrations_tables.sql
```

This creates three tables:
- `google_integrations` - OAuth tokens
- `drive_files` - Synced file metadata
- `reels` - Video metadata

2. **Create Storage Bucket:**

In Supabase Dashboard → Storage:
- Click "New bucket"
- Name: `reels`
- Set Public: ✅ Yes
- Click "Create bucket"

### Step 4: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:8000/api/integrations/google/callback`
   - `https://your-domain.com/api/integrations/google/callback` (for production)
7. Copy Client ID and Client Secret

### Step 5: Configure Environment Variables

#### Frontend (`apps/web/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### Backend (`apps/api/.env`):

```env
# Google AI
GOOGLE_API_KEY=your-google-api-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback

# CORS
ALLOWED_ORIGINS=*
```

### Step 6: Start the Application

#### Terminal 1 - Backend:
```bash
cd apps/api
uvicorn main:app --reload
```

#### Terminal 2 - Frontend:
```bash
cd apps/web
npm run dev
```

## Testing the New Features

### Test 1: Google OAuth Flow

```bash
# 1. Get authorization URL
curl "http://localhost:8000/api/integrations/google/login?user_id=test_user"

# 2. Open the URL in browser and complete OAuth
# 3. Check if token is stored in google_integrations table
```

### Test 2: Drive Sync

```bash
# Sync files from Google Drive
curl -X POST "http://localhost:8000/api/integrations/drive/sync?user_id=test_user" \
  -H "Content-Type: application/json" \
  -d '{"folder_id": null}'
```

### Test 3: Reel Upload

```bash
# Upload a video
curl -X POST "http://localhost:8000/api/reels/upload" \
  -F "file=@test_video.mp4" \
  -F "user_id=test_user" \
  -F "title=Test Video" \
  -F "description=My first reel"

# List all reels
curl "http://localhost:8000/api/reels/list"
```

## API Documentation

### Google OAuth & Drive Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/google/login` | Get OAuth URL |
| GET | `/api/integrations/google/callback` | Handle OAuth callback |
| POST | `/api/integrations/drive/sync` | Sync Drive files |

### Reels Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reels/upload` | Upload video |
| GET | `/api/reels/list` | List all reels |
| GET | `/api/reels/{id}` | Get specific reel |
| DELETE | `/api/reels/{id}` | Delete reel |

**Full API documentation:** See `/apps/api/INTEGRATIONS.md`

## Vercel Deployment

### Frontend Deployment

1. **Set Environment Variables in Vercel:**
   - `NEXT_PUBLIC_API_URL` - Your backend URL
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

2. **Deploy:**
```bash
cd apps/web
vercel deploy
```

### Backend Deployment

For the FastAPI backend, you can deploy to:
- **Railway**: `railway up`
- **Render**: Connect GitHub repo
- **Google Cloud Run**: Use Docker container
- **AWS Lambda**: Use Mangum adapter

**Important:** Update `GOOGLE_OAUTH_REDIRECT_URI` in Google Cloud Console and environment variables to match your production domain.

## Troubleshooting

### Issue: "Module not found: @/lib/supabase/client"

**Solution:** 
1. Run `npm install` in `apps/web`
2. Ensure `@supabase/supabase-js` is in `package.json`
3. Check that `.env.local` has Supabase credentials

### Issue: "Missing Supabase credentials"

**Solution:**
1. Check `.env` file exists in `apps/api`
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
3. Use **service role key**, not anon key for backend

### Issue: "OAuth callback failed"

**Solution:**
1. Verify redirect URI in Google Cloud Console matches exactly
2. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
3. Ensure OAuth consent screen is configured

### Issue: "Storage bucket not found"

**Solution:**
1. Create `reels` bucket in Supabase Dashboard
2. Set bucket to **Public**
3. Verify storage policies allow uploads

## Next Steps

1. **Implement RAG Processing:**
   - Complete the `process_file_for_rag()` function
   - Use LangChain to process Drive files
   - Store embeddings in ChromaDB

2. **Add Video Processing:**
   - Generate thumbnails for reels
   - Extract video duration
   - Implement video transcoding

3. **Frontend Integration:**
   - Create UI for Google Drive connection
   - Add reel upload component
   - Display synced files in folders

4. **Add Authentication:**
   - Integrate Supabase Auth
   - Protect API endpoints
   - Implement user sessions

## Support & Documentation

- **Detailed API Docs:** `/apps/api/INTEGRATIONS.md`
- **Database Schema:** `/apps/api/migrations/001_create_integrations_tables.sql`
- **Supabase Docs:** https://supabase.com/docs
- **Google Drive API:** https://developers.google.com/drive

## Package Installation Commands

As requested, here are all the pip install commands for new packages:

```bash
# Install all new dependencies
pip install google-auth-oauthlib>=1.2.0
pip install google-api-python-client>=2.108.0
pip install google-auth>=2.25.0
pip install supabase>=2.3.0
pip install postgrest>=0.13.0
pip install storage3>=0.7.0

# Or install everything at once
pip install -r apps/api/requirements.txt
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
└────────┬──────────────────────────────────────┬─────────────┘
         │                                       │
         │ HTTP/REST                             │ OAuth Flow
         │                                       │
┌────────▼──────────────────────┐      ┌────────▼──────────────┐
│   Next.js Frontend            │      │   Google OAuth        │
│   - Supabase Client           │      │   - Drive API         │
└────────┬──────────────────────┘      └───────────────────────┘
         │
         │ API Calls
         │
┌────────▼──────────────────────────────────────────────────────┐
│               FastAPI Backend (Python)                         │
│   ┌──────────────────┐  ┌──────────────────┐                 │
│   │  Integrations    │  │     Reels        │                 │
│   │  Router          │  │     Router       │                 │
│   └────────┬─────────┘  └────────┬─────────┘                 │
│            │                     │                            │
│            │   Supabase Client   │                            │
│            └──────────┬──────────┘                            │
└───────────────────────┼───────────────────────────────────────┘
                        │
                        │
┌───────────────────────▼───────────────────────────────────────┐
│                     Supabase                                   │
│   ┌─────────────────┐  ┌─────────────────┐                   │
│   │   PostgreSQL    │  │    Storage       │                   │
│   │   - Tables      │  │    - Reels       │                   │
│   └─────────────────┘  └─────────────────┘                   │
└────────────────────────────────────────────────────────────────┘
```

---

**Status:** All features implemented and ready for testing! 🎉
