"""
Pydantic models for integration-related API endpoints
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GoogleAuthUrlResponse(BaseModel):
    """Response model for Google OAuth URL generation"""
    authorization_url: str = Field(..., description="Google OAuth authorization URL")
    state: str = Field(..., description="State parameter for CSRF protection")


class GoogleCallbackRequest(BaseModel):
    """Request model for Google OAuth callback"""
    code: str = Field(..., description="Authorization code from Google")
    state: str = Field(..., description="State parameter for CSRF verification")


class GoogleIntegration(BaseModel):
    """Model for Google integration stored in database"""
    id: Optional[str] = None
    user_id: str
    access_token: str
    refresh_token: Optional[str] = None
    token_expiry: Optional[datetime] = None
    scopes: list[str]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DriveFile(BaseModel):
    """Model for Google Drive file metadata"""
    id: Optional[str] = None
    google_file_id: str
    user_id: str
    name: str
    mime_type: str
    size: Optional[int] = None
    web_view_link: Optional[str] = None
    created_time: Optional[datetime] = None
    modified_time: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    is_processed: bool = False


class DriveSyncRequest(BaseModel):
    """Request model for Drive sync operation"""
    folder_id: Optional[str] = Field(None, description="Optional Google Drive folder ID to sync from")


class DriveSyncResponse(BaseModel):
    """Response model for Drive sync operation"""
    success: bool
    files_synced: int
    files_processed: int
    message: str
    files: list[DriveFile] = Field(default_factory=list)


class GoogleCallbackResponse(BaseModel):
    """Response model for Google OAuth callback"""
    success: bool
    message: str
    user_id: str
