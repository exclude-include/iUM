"""
Reels Upload Router
Handles video upload and management for the reels feature
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import os
import re
import requests
from pathlib import Path

from models.reels import Reel, ReelUploadResponse, ReelListResponse
from utils.supabase_client import get_supabase_client, get_storage_client

router = APIRouter()


# Request model for Drive import
class DriveImportRequest(BaseModel):
    drive_url: str
    user_id: str
    title: str
    description: Optional[str] = None
    folder_name: Optional[str] = None
    tags: Optional[list[str]] = None

# Supabase storage bucket name
REELS_BUCKET = "reels"

# Supported video MIME types
SUPPORTED_VIDEO_TYPES = [
    "video/mp4",
    "video/quicktime",  # .mov
    "video/x-msvideo",  # .avi
    "video/webm",
]

# Max file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024


@router.post("/upload", response_model=ReelUploadResponse)
async def upload_reel(
    file: UploadFile = File(..., description="Video file to upload"),
    user_id: str = Form(..., description="User ID uploading the reel"),
    title: str = Form(..., description="Title of the reel"),
    description: Optional[str] = Form(None, description="Description of the reel"),
):
    """
    Upload a video reel to Supabase Storage
    
    Args:
        file: Video file to upload
        user_id: User ID uploading the video
        title: Title of the reel
        description: Optional description
        
    Returns:
        ReelUploadResponse: Upload result with reel metadata
        
    Raises:
        HTTPException: If upload fails or file is invalid
    """
    try:
        # Validate file type
        if file.content_type not in SUPPORTED_VIDEO_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Supported types: {', '.join(SUPPORTED_VIDEO_TYPES)}"
            )
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Validate file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024 * 1024)}MB"
            )
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix if file.filename else ".mp4"
        unique_filename = f"{user_id}/{uuid.uuid4()}{file_extension}"
        
        # Upload to Supabase Storage
        supabase = get_supabase_client()
        storage = get_storage_client()
        
        # Ensure bucket exists (create if not)
        try:
            buckets = storage.list_buckets()
            bucket_exists = any(bucket.name == REELS_BUCKET for bucket in buckets)
            
            if not bucket_exists:
                storage.create_bucket(
                    REELS_BUCKET,
                    options={"public": True}
                )
        except Exception as bucket_error:
            print(f"Bucket check/creation warning: {bucket_error}")
            # Continue anyway - bucket might already exist
        
        # Upload file to storage
        upload_result = storage.from_(REELS_BUCKET).upload(
            path=unique_filename,
            file=file_content,
            file_options={
                "content-type": file.content_type,
                "cache-control": "3600",
            }
        )
        
        # Get public URL for the uploaded file
        public_url = storage.from_(REELS_BUCKET).get_public_url(unique_filename)
        
        # Insert reel metadata into database
        reel_data = {
            "user_id": user_id,
            "title": title,
            "description": description,
            "video_url": public_url,
            "duration": None,  # TODO: Extract video duration
            "views": 0,
            "likes": 0,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        result = supabase.table("reels").insert(reel_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save reel metadata")
        
        reel = Reel(**result.data[0])
        
        return ReelUploadResponse(
            success=True,
            message="Reel uploaded successfully",
            reel=reel
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload reel: {str(e)}")


@router.get("/list", response_model=ReelListResponse)
async def list_reels(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    limit: int = Query(20, ge=1, le=100, description="Number of reels to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    List reels with optional filtering and pagination
    
    Args:
        user_id: Optional user ID to filter by
        limit: Number of reels to return
        offset: Offset for pagination
        
    Returns:
        ReelListResponse: List of reels with pagination info
    """
    try:
        supabase = get_supabase_client()
        
        # Build query
        query = supabase.table("reels").select("*", count="exact")
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        # Order by creation date (newest first) and apply pagination
        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        reels = [Reel(**reel_data) for reel_data in result.data]
        total = result.count if result.count is not None else len(reels)
        
        return ReelListResponse(
            reels=reels,
            total=total,
            offset=offset,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reels: {str(e)}")


@router.get("/{reel_id}", response_model=Reel)
async def get_reel(reel_id: str):
    """
    Get a specific reel by ID
    
    Args:
        reel_id: Reel ID to fetch
        
    Returns:
        Reel: Reel metadata
    """
    try:
        supabase = get_supabase_client()
        result = supabase.table("reels").select("*").eq("id", reel_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        return Reel(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reel: {str(e)}")


@router.delete("/{reel_id}")
async def delete_reel(
    reel_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
):
    """
    Delete a reel (only by owner)
    
    Args:
        reel_id: Reel ID to delete
        user_id: User ID for authorization
        
    Returns:
        Success message
    """
    try:
        supabase = get_supabase_client()
        
        # Get reel to verify ownership
        reel_result = supabase.table("reels").select("*").eq("id", reel_id).execute()
        
        if not reel_result.data:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        reel = reel_result.data[0]
        
        # Verify ownership
        if reel["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this reel")
        
        # Extract file path from video URL
        video_url = reel["video_url"]
        # Parse the storage path from URL (this depends on your Supabase setup)
        # Example: https://your-project.supabase.co/storage/v1/object/public/reels/user_id/file.mp4
        path_parts = video_url.split(f"/{REELS_BUCKET}/")
        if len(path_parts) > 1:
            file_path = path_parts[1]
            
            # Delete from storage
            storage = get_storage_client()
            try:
                storage.from_(REELS_BUCKET).remove([file_path])
            except Exception as storage_error:
                print(f"Storage deletion warning: {storage_error}")
                # Continue with database deletion even if storage deletion fails
        
        # Delete from database
        supabase.table("reels").delete().eq("id", reel_id).execute()
        
        return {"success": True, "message": "Reel deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete reel: {str(e)}")


def extract_drive_file_id(url: str) -> str:
    """
    Extract Google Drive file ID from various URL formats
    Supports:
    - https://drive.google.com/file/d/FILE_ID/view
    - https://drive.google.com/open?id=FILE_ID
    - https://drive.google.com/uc?id=FILE_ID
    """
    patterns = [
        r'/file/d/([a-zA-Z0-9_-]+)',
        r'[?&]id=([a-zA-Z0-9_-]+)',
        r'/folders/([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise ValueError("Could not extract file ID from Google Drive URL")


@router.post("/import-from-drive", response_model=ReelUploadResponse)
async def import_reel_from_drive(request: DriveImportRequest):
    """
    Import a video from Google Drive shared URL
    
    The URL must be a publicly shared Google Drive link.
    Supported formats:
    - https://drive.google.com/file/d/FILE_ID/view
    - https://drive.google.com/open?id=FILE_ID
    
    Args:
        request: DriveImportRequest with URL, user_id, title, etc.
        
    Returns:
        ReelUploadResponse: Upload result with reel metadata
    """
    try:
        # Extract file ID from URL
        file_id = extract_drive_file_id(request.drive_url)
        
        # Google Drive direct download URL for public files
        download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
        
        # Download file from Google Drive
        response = requests.get(download_url, stream=True, allow_redirects=True)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Failed to download file from Google Drive. Make sure the file is publicly shared."
            )
        
        # Get content type and file content
        content_type = response.headers.get('Content-Type', 'video/mp4')
        file_content = response.content
        file_size = len(file_content)
        
        # Validate file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024 * 1024)}MB"
            )
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Downloaded file is empty")
        
        # Determine file extension
        if 'video/mp4' in content_type:
            file_ext = '.mp4'
        elif 'video/quicktime' in content_type:
            file_ext = '.mov'
        elif 'video/webm' in content_type:
            file_ext = '.webm'
        else:
            file_ext = '.mp4'  # Default to mp4
        
        # Generate unique filename
        unique_filename = f"{request.user_id}/{uuid.uuid4()}{file_ext}"
        
        # Upload to Supabase Storage
        supabase = get_supabase_client()
        storage = get_storage_client()
        
        # Ensure bucket exists
        try:
            buckets = storage.list_buckets()
            bucket_exists = any(bucket.name == REELS_BUCKET for bucket in buckets)
            if not bucket_exists:
                storage.create_bucket(REELS_BUCKET, options={"public": True})
        except Exception as bucket_error:
            print(f"Bucket check/creation warning: {bucket_error}")
        
        # Upload file to storage
        storage.from_(REELS_BUCKET).upload(
            path=unique_filename,
            file=file_content,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
            }
        )
        
        # Get public URL
        public_url = storage.from_(REELS_BUCKET).get_public_url(unique_filename)
        
        # Insert reel metadata into database
        reel_data = {
            "user_id": request.user_id,
            "title": request.title,
            "description": request.description,
            "video_url": public_url,
            "folder_name": request.folder_name,
            "tags": request.tags or [],
            "views": 0,
            "likes": 0,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        result = supabase.table("reels").insert(reel_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save reel metadata")
        
        reel = Reel(**result.data[0])
        
        return ReelUploadResponse(
            success=True,
            message="Reel imported from Google Drive successfully",
            reel=reel
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import from Google Drive: {str(e)}")

