# Integrations & Reels API Documentation

This document describes the Google Drive integration and Reels upload features implemented in the iUM API.

## Table of Contents

1. [Setup](#setup)
2. [Google OAuth & Drive Sync](#google-oauth--drive-sync)
3. [Reels Upload](#reels-upload)
4. [Database Schema](#database-schema)
5. [Environment Variables](#environment-variables)

## Setup

### 1. Install Dependencies

```bash
cd apps/api
pip install -r requirements.txt
```

Required packages:
- `google-auth-oauthlib>=1.2.0` - Google OAuth authentication
- `google-api-python-client>=2.108.0` - Google Drive API client
- `google-auth>=2.25.0` - Google authentication library
- `supabase>=2.3.0` - Supabase Python client
- `langchain` (future use) - For RAG processing

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen
6. Add authorized redirect URI: `http://localhost:8000/api/integrations/google/callback`
7. Copy the **Client ID** and **Client Secret**

### 3. Configure Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Create the required tables (see [Database Schema](#database-schema))
3. Create a storage bucket named `reels` with public access
4. Copy your **Project URL** and **Service Role Key**

### 4. Set Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback
```

## Google OAuth & Drive Sync

### API Endpoints

#### 1. GET `/api/integrations/google/login`

Generate Google OAuth authorization URL.

**Query Parameters:**
- `user_id` (required): User ID to associate with the OAuth token

**Response:**
```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/auth?...",
  "state": "csrf-token"
}
```

**Usage Example:**
```python
import requests

response = requests.get(
    "http://localhost:8000/api/integrations/google/login",
    params={"user_id": "user123"}
)
data = response.json()

# Redirect user to authorization_url
print(f"Visit: {data['authorization_url']}")
```

#### 2. GET `/api/integrations/google/callback`

Handle OAuth callback and store tokens.

**Query Parameters:**
- `code` (required): Authorization code from Google
- `state` (required): State parameter for CSRF verification

**Response:**
```json
{
  "success": true,
  "message": "Google Drive connected successfully",
  "user_id": "user123"
}
```

**Note:** This endpoint is called automatically by Google after user authorization.

#### 3. POST `/api/integrations/drive/sync`

Sync files from Google Drive to database.

**Query Parameters:**
- `user_id` (required): User ID for file synchronization

**Request Body:**
```json
{
  "folder_id": "optional-google-drive-folder-id"
}
```

**Response:**
```json
{
  "success": true,
  "files_synced": 15,
  "files_processed": 0,
  "message": "Successfully synced 15 files from Google Drive",
  "files": [
    {
      "id": "uuid",
      "google_file_id": "google-file-id",
      "user_id": "user123",
      "name": "Document.pdf",
      "mime_type": "application/pdf",
      "size": 1024000,
      "web_view_link": "https://drive.google.com/...",
      "created_time": "2024-01-01T00:00:00Z",
      "modified_time": "2024-01-02T00:00:00Z",
      "synced_at": "2024-01-03T00:00:00Z",
      "is_processed": false
    }
  ]
}
```

**Usage Example:**
```python
import requests

response = requests.post(
    "http://localhost:8000/api/integrations/drive/sync",
    params={"user_id": "user123"},
    json={"folder_id": None}  # Sync all files
)
data = response.json()
print(f"Synced {data['files_synced']} files")
```

### Supported File Types

The Drive sync supports the following MIME types:
- `application/pdf` - PDF files
- `application/vnd.google-apps.document` - Google Docs
- `application/vnd.google-apps.presentation` - Google Slides
- `text/plain` - Text files
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` - Word documents

### RAG Processing (Future Implementation)

The `process_file_for_rag()` function is currently a placeholder. Future implementation will:

1. Download file content from Google Drive
2. Extract text using LangChain document loaders
3. Chunk content using RecursiveCharacterTextSplitter
4. Generate embeddings using GoogleGenerativeAIEmbeddings
5. Store in ChromaDB vector database

## Reels Upload

### API Endpoints

#### 1. POST `/api/reels/upload`

Upload a video reel to Supabase Storage.

**Form Data:**
- `file` (required): Video file (multipart/form-data)
- `user_id` (required): User ID uploading the reel
- `title` (required): Title of the reel
- `description` (optional): Description of the reel

**Response:**
```json
{
  "success": true,
  "message": "Reel uploaded successfully",
  "reel": {
    "id": "uuid",
    "user_id": "user123",
    "title": "My Learning Video",
    "description": "This is a tutorial video",
    "video_url": "https://your-project.supabase.co/storage/v1/object/public/reels/...",
    "thumbnail_url": null,
    "duration": null,
    "views": 0,
    "likes": 0,
    "created_at": "2024-01-03T00:00:00Z"
  }
}
```

**Usage Example (Python):**
```python
import requests

with open("video.mp4", "rb") as video_file:
    files = {"file": ("video.mp4", video_file, "video/mp4")}
    data = {
        "user_id": "user123",
        "title": "My Learning Video",
        "description": "Tutorial on Python"
    }
    
    response = requests.post(
        "http://localhost:8000/api/reels/upload",
        files=files,
        data=data
    )
    result = response.json()
    print(f"Uploaded: {result['reel']['video_url']}")
```

**Usage Example (JavaScript/Fetch):**
```javascript
const formData = new FormData();
formData.append('file', videoFile);
formData.append('user_id', 'user123');
formData.append('title', 'My Learning Video');
formData.append('description', 'Tutorial on Python');

const response = await fetch('http://localhost:8000/api/reels/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Uploaded:', result.reel.video_url);
```

#### 2. GET `/api/reels/list`

List reels with pagination.

**Query Parameters:**
- `user_id` (optional): Filter by user ID
- `limit` (optional, default: 20): Number of reels to return (1-100)
- `offset` (optional, default: 0): Offset for pagination

**Response:**
```json
{
  "reels": [...],
  "total": 50,
  "offset": 0,
  "limit": 20
}
```

#### 3. GET `/api/reels/{reel_id}`

Get a specific reel by ID.

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user123",
  "title": "My Learning Video",
  "video_url": "https://...",
  ...
}
```

#### 4. DELETE `/api/reels/{reel_id}`

Delete a reel (only by owner).

**Query Parameters:**
- `user_id` (required): User ID for authorization

**Response:**
```json
{
  "success": true,
  "message": "Reel deleted successfully"
}
```

### Supported Video Types

- `video/mp4` - MP4 files
- `video/quicktime` - MOV files
- `video/x-msvideo` - AVI files
- `video/webm` - WebM files

**Maximum file size:** 100MB

## Database Schema

### Supabase Tables

#### `google_integrations`

Stores OAuth tokens for Google Drive integration.

```sql
CREATE TABLE google_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_google_integrations_user_id ON google_integrations(user_id);
```

#### `drive_files`

Stores metadata of synced Google Drive files.

```sql
CREATE TABLE drive_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT,
  web_view_link TEXT,
  created_time TIMESTAMPTZ,
  modified_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  is_processed BOOLEAN DEFAULT FALSE,
  UNIQUE(google_file_id, user_id)
);

-- Indexes
CREATE INDEX idx_drive_files_user_id ON drive_files(user_id);
CREATE INDEX idx_drive_files_google_file_id ON drive_files(google_file_id);
CREATE INDEX idx_drive_files_is_processed ON drive_files(is_processed);
```

#### `reels`

Stores video reel metadata.

```sql
CREATE TABLE reels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration FLOAT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reels_user_id ON reels(user_id);
CREATE INDEX idx_reels_created_at ON reels(created_at DESC);
```

### Supabase Storage

#### Bucket: `reels`

Create a public storage bucket for video files:

1. Go to **Storage** in Supabase Dashboard
2. Create new bucket named `reels`
3. Set **Public** = true
4. Configure policies for upload/delete (optional)

## Environment Variables

### Required Variables

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback
```

### Optional Variables

```env
# CORS Configuration
ALLOWED_ORIGINS=*  # Use "*" for all origins or comma-separated list

# Google AI (for RAG processing)
GOOGLE_API_KEY=your-google-ai-api-key
```

## Testing

### Test Google OAuth Flow

1. Start the API server:
```bash
cd apps/api
uvicorn main:app --reload
```

2. Visit the login endpoint:
```bash
curl "http://localhost:8000/api/integrations/google/login?user_id=test_user"
```

3. Copy the `authorization_url` and open in browser
4. Complete OAuth flow
5. Verify token stored in `google_integrations` table

### Test Drive Sync

```bash
curl -X POST "http://localhost:8000/api/integrations/drive/sync?user_id=test_user" \
  -H "Content-Type: application/json" \
  -d '{"folder_id": null}'
```

### Test Reel Upload

```bash
curl -X POST "http://localhost:8000/api/reels/upload" \
  -F "file=@test_video.mp4" \
  -F "user_id=test_user" \
  -F "title=Test Video" \
  -F "description=This is a test"
```

## Error Handling

All endpoints include comprehensive error handling:

- **400 Bad Request**: Invalid input (file type, size, missing parameters)
- **403 Forbidden**: Unauthorized action (e.g., deleting someone else's reel)
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side errors with detailed messages

Example error response:
```json
{
  "detail": "Failed to upload reel: Storage bucket not found"
}
```

## Future Enhancements

1. **RAG Processing**: Implement `process_file_for_rag()` to automatically process synced Drive files
2. **Video Thumbnails**: Generate thumbnails for uploaded reels
3. **Video Duration**: Extract video duration metadata
4. **Batch Sync**: Support syncing multiple Drive folders simultaneously
5. **Webhook Integration**: Set up Drive webhooks for real-time sync
6. **Video Transcoding**: Optimize video files for streaming

## Support

For issues or questions:
1. Check the error message details
2. Verify environment variables are set correctly
3. Ensure Supabase tables and storage bucket are created
4. Check Google Cloud Console for OAuth configuration
