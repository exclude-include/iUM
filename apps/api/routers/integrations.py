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
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets

from models.integrations import (
    GoogleAuthUrlResponse,
    GoogleCallbackRequest,
    GoogleCallbackResponse,
    DriveSyncRequest,
    DriveSyncResponse,
    DriveFile,
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
            "updated_at": datetime.now(timezone.utc).isoformat(),
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
            if expiry <= datetime.now(timezone.utc):
                credentials.refresh(Request())
                
                # Update tokens in database
                supabase.table("google_integrations").update({
                    "access_token": credentials.token,
                    "token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
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
                "synced_at": datetime.now(timezone.utc).isoformat(),
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
