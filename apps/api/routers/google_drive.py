"""
Google Drive integration router

Environment Variables:
- GOOGLE_DRIVE_API_KEY: API key for Google Drive operations
- GOOGLE_API_KEY: Legacy fallback key
"""
import os
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel
from utils.supabase_client import get_supabase
from supabase import Client
from db.services import GoogleIntegrationService, DriveFileService
from db.models import DriveFileCreate

router = APIRouter()

# Get Drive API key (Priority: GOOGLE_DRIVE_API_KEY > GOOGLE_API_KEY)
def get_drive_api_key() -> Optional[str]:
    return os.getenv("GOOGLE_DRIVE_API_KEY") or os.getenv("GOOGLE_API_KEY")


def get_google_service(db: Client = Depends(get_supabase)) -> GoogleIntegrationService:
    return GoogleIntegrationService(db)


def get_drive_service(db: Client = Depends(get_supabase)) -> DriveFileService:
    return DriveFileService(db)


class GoogleAuthRequest(BaseModel):
    account_id: str
    access_token: str
    refresh_token: Optional[str] = None
    scope: Optional[str] = None


class DriveFileSyncRequest(BaseModel):
    account_id: str
    files: List[DriveFileCreate]


@router.post("/auth")
async def save_google_auth(
    auth: GoogleAuthRequest,
    google_service: GoogleIntegrationService = Depends(get_google_service)
):
    """
    Save Google OAuth tokens for an account
    """
    try:
        integration = google_service.create_or_update(
            account_id=auth.account_id,
            access_token=auth.access_token,
            refresh_token=auth.refresh_token,
            scope=auth.scope
        )
        return {
            "message": "Google integration saved successfully",
            "account_id": integration.account_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving Google auth: {str(e)}")


@router.get("/auth/{account_id}")
async def get_google_auth(
    account_id: str,
    google_service: GoogleIntegrationService = Depends(get_google_service)
):
    """
    Get Google integration status for an account
    """
    integration = google_service.get_by_account(account_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Google integration not found")
    
    # Don't return the actual tokens for security
    return {
        "account_id": integration.account_id,
        "has_access_token": bool(integration.access_token),
        "has_refresh_token": bool(integration.refresh_token),
        "scope": integration.scope,
        "created_at": integration.created_at
    }


@router.delete("/auth/{account_id}")
async def revoke_google_auth(
    account_id: str,
    google_service: GoogleIntegrationService = Depends(get_google_service)
):
    """
    Revoke Google integration for an account
    """
    success = google_service.delete(account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Google integration not found")
    return {"message": "Google integration revoked successfully"}


@router.post("/files/sync")
async def sync_drive_files(
    sync_request: DriveFileSyncRequest,
    drive_service: DriveFileService = Depends(get_drive_service)
):
    """
    Sync Google Drive files to database.
    This endpoint should be called after fetching files from Google Drive API.
    """
    try:
        synced_files = []
        for file_data in sync_request.files:
            # Check if file already exists
            existing = drive_service.get_by_drive_id(file_data.google_drive_id)
            
            if existing:
                # Update sync timestamp
                updated = drive_service.update_sync(existing.id)
                synced_files.append(updated)
            else:
                # Create new record
                created = drive_service.create(file_data)
                synced_files.append(created)
        
        return {
            "message": f"Synced {len(synced_files)} files",
            "synced_count": len(synced_files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing Drive files: {str(e)}")


@router.get("/files")
async def get_drive_files(
    account_id: str = Query(..., description="Account ID"),
    folder_id: Optional[str] = Query(None, description="Filter by folder ID"),
    drive_service: DriveFileService = Depends(get_drive_service)
):
    """
    Get Google Drive files for an account
    """
    try:
        files = drive_service.get_by_account(account_id, folder_id)
        return {
            "files": files,
            "count": len(files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Drive files: {str(e)}")


@router.delete("/files/{file_id}")
async def delete_drive_file(
    file_id: str,
    drive_service: DriveFileService = Depends(get_drive_service)
):
    """
    Delete a Google Drive file record from database
    (Does not delete from Google Drive itself)
    """
    success = drive_service.delete(file_id)
    if not success:
        raise HTTPException(status_code=404, detail="Drive file not found")
    return {"message": "Drive file record deleted successfully"}
