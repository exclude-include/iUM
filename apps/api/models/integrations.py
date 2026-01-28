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


class DriveFileInfo(BaseModel):
    """Model for Drive file info returned to frontend"""
    id: str = Field(..., description="Google Drive file ID")
    name: str = Field(..., description="File name")
    mime_type: str = Field(..., description="MIME type")
    size: Optional[int] = Field(None, description="File size in bytes")
    thumbnail_link: Optional[str] = Field(None, description="Thumbnail URL")
    web_view_link: Optional[str] = Field(None, description="Web view URL")
    modified_time: Optional[str] = Field(None, description="Last modified time")


class DriveFilesResponse(BaseModel):
    """Response for listing Drive files"""
    success: bool
    files: list[DriveFileInfo] = Field(default_factory=list)
    message: str = ""


class DriveImportRequest(BaseModel):
    """Request model for importing a file from Google Drive"""
    file_id: str = Field(..., description="Google Drive file ID to import")
    title: str = Field(..., description="Title for the reel")
    description: Optional[str] = Field(None, description="Description for the reel")
    folder_name: Optional[str] = Field(None, description="Folder/category name")
    tags: list[str] = Field(default_factory=list, description="Hashtags for the reel")


class DriveImportResponse(BaseModel):
    """Response model for Drive import operation"""
    success: bool
    message: str
    video_url: Optional[str] = Field(None, description="Public URL of uploaded video")
    reel_id: Optional[str] = Field(None, description="ID of created reel record")

