"""
Google OAuth & Drive Integration Router
Handles OAuth authentication and Drive file synchronization
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import os
import json
from datetime import datetime, timedelta
from typing import Optional
import secrets

from models.integrations import (
    GoogleAuthUrlResponse,
    GoogleCallbackRequest,
    GoogleCallbackResponse,
    DriveSyncRequest,
    DriveSyncResponse,
    DriveFile,
    DriveFileInfo,
    DriveFilesResponse,
    DriveImportRequest,
    DriveImportResponse,
)
from utils.supabase_client import get_supabase_client

router = APIRouter()

# Google OAuth scopes
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

# Redirect URI - should match Google Cloud Console configuration
REDIRECT_URI = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/api/integrations/google/callback")

# Supported MIME types for RAG ingestion
SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.google-apps.document',  # Google Docs
    'application/vnd.google-apps.presentation',  # Google Slides
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
]


def get_oauth_flow(state: Optional[str] = None) -> Flow:
    """
    Create Google OAuth flow instance
    
    Args:
        state: Optional state parameter for CSRF protection
        
    Returns:
        Flow: Google OAuth flow instance
        
    Raises:
        HTTPException: If OAuth credentials are not configured
    """
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }
    
    if not client_config["web"]["client_id"] or not client_config["web"]["client_secret"]:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
        )
    
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    
    if state:
        flow.state = state
    
    return flow


@router.get("/google/login", response_model=GoogleAuthUrlResponse)
async def google_login(user_id: str = Query(..., description="User ID for authentication")):
    """
    Generate Google OAuth authorization URL
    
    Args:
        user_id: User ID to associate with the OAuth token
        
    Returns:
        GoogleAuthUrlResponse: Authorization URL and state parameter
    """
    try:
        # Generate state parameter with user_id encoded for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Store state with user_id in session or cache (simplified here)
        # In production, store this in Redis or database
        state_data = {"state": state, "user_id": user_id}
        
        flow = get_oauth_flow()
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=json.dumps(state_data),
            prompt='consent',  # Force consent screen to get refresh token
        )
        
        return GoogleAuthUrlResponse(
            authorization_url=authorization_url,
            state=state
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate authorization URL: {str(e)}")


@router.get("/google/callback", response_model=GoogleCallbackResponse)
async def google_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="State parameter for verification"),
):
    """
    Handle Google OAuth callback and store tokens
    
    Args:
        code: Authorization code from Google
        state: State parameter for CSRF verification
        
    Returns:
        GoogleCallbackResponse: Success status and user information
    """
    try:
        # Parse state to get user_id
        state_data = json.loads(state)
        user_id = state_data.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Exchange code for tokens
        flow = get_oauth_flow()
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        # Prepare token data for database
        token_data = {
            "user_id": user_id,
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
            "scopes": SCOPES,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Upsert into google_integrations table
        supabase = get_supabase_client()
        result = supabase.table("google_integrations").upsert(
            token_data,
            on_conflict="user_id"
        ).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to store OAuth tokens")
        
        return GoogleCallbackResponse(
            success=True,
            message="Google Drive connected successfully",
            user_id=user_id
        )
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid state parameter format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")


def get_credentials_for_user(user_id: str) -> Credentials:
    """
    Get and refresh Google credentials for a user
    
    Args:
        user_id: User ID to fetch credentials for
        
    Returns:
        Credentials: Valid Google OAuth credentials
        
    Raises:
        HTTPException: If credentials not found or refresh fails
    """
    try:
        supabase = get_supabase_client()
        result = supabase.table("google_integrations").select("*").eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail="Google Drive not connected. Please authenticate first."
            )
        
        integration = result.data[0]
        
        # Create credentials object
        credentials = Credentials(
            token=integration["access_token"],
            refresh_token=integration["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
            scopes=SCOPES,
        )
        
        # Check if token is expired and refresh if needed
        if integration.get("token_expiry"):
            expiry = datetime.fromisoformat(integration["token_expiry"])
            if expiry <= datetime.utcnow():
                credentials.refresh(Request())
                
                # Update tokens in database
                supabase.table("google_integrations").update({
                    "access_token": credentials.token,
                    "token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
                    "updated_at": datetime.utcnow().isoformat(),
                }).eq("user_id", user_id).execute()
        
        return credentials
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve credentials: {str(e)}")


@router.post("/drive/sync", response_model=DriveSyncResponse)
async def sync_drive_files(
    request: DriveSyncRequest,
    user_id: str = Query(..., description="User ID for file synchronization"),
):
    """
    Sync files from Google Drive to database
    
    Args:
        request: Sync request parameters
        user_id: User ID to sync files for
        
    Returns:
        DriveSyncResponse: Sync results with file metadata
    """
    try:
        # Get valid credentials
        credentials = get_credentials_for_user(user_id)
        
        # Build Drive API service
        service = build('drive', 'v3', credentials=credentials)
        
        # Query parameters for listing files
        query_parts = []
        
        # Filter by supported MIME types
        mime_type_query = " or ".join([f"mimeType='{mt}'" for mt in SUPPORTED_MIME_TYPES])
        query_parts.append(f"({mime_type_query})")
        
        # Filter by folder if specified
        if request.folder_id:
            query_parts.append(f"'{request.folder_id}' in parents")
        
        # Exclude trashed files
        query_parts.append("trashed=false")
        
        query = " and ".join(query_parts)
        
        # List files from Drive
        results = service.files().list(
            q=query,
            pageSize=100,
            fields="files(id, name, mimeType, size, webViewLink, createdTime, modifiedTime)"
        ).execute()
        
        files = results.get('files', [])
        
        # Prepare file data for database
        supabase = get_supabase_client()
        synced_files = []
        
        for file in files:
            file_data = {
                "google_file_id": file['id'],
                "user_id": user_id,
                "name": file['name'],
                "mime_type": file['mimeType'],
                "size": int(file.get('size', 0)) if file.get('size') else None,
                "web_view_link": file.get('webViewLink'),
                "created_time": file.get('createdTime'),
                "modified_time": file.get('modifiedTime'),
                "synced_at": datetime.utcnow().isoformat(),
                "is_processed": False,
            }
            
            # Upsert file metadata
            result = supabase.table("drive_files").upsert(
                file_data,
                on_conflict="google_file_id,user_id"
            ).execute()
            
            if result.data:
                synced_files.append(DriveFile(**result.data[0]))
        
        # TODO: Process files for RAG (placeholder)
        # for synced_file in synced_files:
        #     await process_file_for_rag(synced_file.google_file_id, credentials)
        
        return DriveSyncResponse(
            success=True,
            files_synced=len(synced_files),
            files_processed=0,  # Will be updated when RAG processing is implemented
            message=f"Successfully synced {len(synced_files)} files from Google Drive",
            files=synced_files
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drive sync failed: {str(e)}")


# Video MIME types for filtering
VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/mpeg',
    'video/3gpp',
    'video/x-matroska',
]


@router.get("/drive/files", response_model=DriveFilesResponse)
async def list_drive_video_files(
    user_id: str = Query(..., description="User ID for authentication"),
    page_token: Optional[str] = Query(None, description="Page token for pagination"),
):
    """
    List video files from user's Google Drive
    
    Args:
        user_id: User ID to fetch files for
        page_token: Optional page token for pagination
        
    Returns:
        DriveFilesResponse: List of video files from Google Drive
    """
    try:
        # Get valid credentials
        credentials = get_credentials_for_user(user_id)
        
        # Build Drive API service
        service = build('drive', 'v3', credentials=credentials)
        
        # Query for video files only
        mime_type_query = " or ".join([f"mimeType='{mt}'" for mt in VIDEO_MIME_TYPES])
        query = f"({mime_type_query}) and trashed=false"
        
        # List files from Drive
        request_params = {
            'q': query,
            'pageSize': 50,
            'fields': "nextPageToken, files(id, name, mimeType, size, thumbnailLink, webViewLink, modifiedTime)",
        }
        
        if page_token:
            request_params['pageToken'] = page_token
        
        results = service.files().list(**request_params).execute()
        files = results.get('files', [])
        
        # Convert to response model
        file_list = [
            DriveFileInfo(
                id=f['id'],
                name=f['name'],
                mime_type=f['mimeType'],
                size=int(f.get('size', 0)) if f.get('size') else None,
                thumbnail_link=f.get('thumbnailLink'),
                web_view_link=f.get('webViewLink'),
                modified_time=f.get('modifiedTime'),
            )
            for f in files
        ]
        
        return DriveFilesResponse(
            success=True,
            files=file_list,
            message=f"Found {len(file_list)} video files"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list Drive files: {str(e)}")


@router.post("/drive/import", response_model=DriveImportResponse)
async def import_from_drive(
    request: DriveImportRequest,
    user_id: str = Query(..., description="User ID for authentication"),
):
    """
    Import a video file from Google Drive to Supabase Storage
    
    1. Downloads the file from Google Drive
    2. Uploads to Supabase Storage 'reels' bucket
    3. Creates a record in the 'reels' table
    
    Args:
        request: Import request with file ID and reel metadata
        user_id: User ID performing the import
        
    Returns:
        DriveImportResponse: Result with public URL and reel ID
    """
    try:
        import io
        
        # Get valid credentials
        credentials = get_credentials_for_user(user_id)
        
        # Build Drive API service
        service = build('drive', 'v3', credentials=credentials)
        
        # Get file metadata first
        file_metadata = service.files().get(
            fileId=request.file_id,
            fields='id, name, mimeType, size'
        ).execute()
        
        file_name = file_metadata['name']
        mime_type = file_metadata['mimeType']
        
        # Validate it's a video file
        if mime_type not in VIDEO_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File is not a supported video format. Got: {mime_type}"
            )
        
        # Download file content
        file_request = service.files().get_media(fileId=request.file_id)
        file_content = io.BytesIO()
        
        from googleapiclient.http import MediaIoBaseDownload
        downloader = MediaIoBaseDownload(file_content, file_request)
        
        done = False
        while not done:
            _, done = downloader.next_chunk()
        
        file_content.seek(0)
        file_bytes = file_content.read()
        
        # Generate unique filename for Supabase storage
        file_ext = file_name.split('.')[-1] if '.' in file_name else 'mp4'
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        storage_filename = f"{user_id}/{timestamp}_{secrets.token_hex(4)}.{file_ext}"
        
        # Upload to Supabase Storage
        supabase = get_supabase_client()
        
        # Upload file to 'reels' bucket
        storage_result = supabase.storage.from_('reels').upload(
            path=storage_filename,
            file=file_bytes,
            file_options={"content-type": mime_type}
        )
        
        # Get public URL
        public_url_response = supabase.storage.from_('reels').get_public_url(storage_filename)
        public_url = public_url_response
        
        # Create reel record in database
        reel_data = {
            "title": request.title,
            "description": request.description or "",
            "video_url": public_url,
            "user_id": user_id,
            "folder_name": request.folder_name,
            "tags": request.tags,
            "likes": 0,
            "comments": 0,
            "source": "google_drive",
            "google_file_id": request.file_id,
        }
        
        reel_result = supabase.table("reels").insert(reel_data).execute()
        
        reel_id = None
        if reel_result.data:
            reel_id = reel_result.data[0].get('id')
        
        return DriveImportResponse(
            success=True,
            message=f"Successfully imported '{file_name}' from Google Drive",
            video_url=public_url,
            reel_id=str(reel_id) if reel_id else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drive import failed: {str(e)}")


async def process_file_for_rag(file_id: str, credentials: Credentials):
    """
    Placeholder function for RAG processing
    
    This function will use LangChain to:
    1. Download the file content from Google Drive
    2. Extract text content (handle different formats)
    3. Chunk the content appropriately
    4. Generate embeddings and store in vector database
    
    Args:
        file_id: Google Drive file ID
        credentials: Google OAuth credentials for file access
        
    TODO: Implement actual RAG processing logic
    """
    # Placeholder for future implementation
    # from langchain.document_loaders import GoogleDriveLoader
    # from langchain.text_splitter import RecursiveCharacterTextSplitter
    # from langchain.vectorstores import Chroma
    # from langchain.embeddings import GoogleGenerativeAIEmbeddings
    
    pass

