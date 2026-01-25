"""
Database models matching Supabase schema
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class Account(BaseModel):
    """Account model matching Supabase accounts table"""
    id: Optional[str] = None
    email: str
    name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GoogleIntegration(BaseModel):
    """Google integration model for OAuth tokens"""
    id: Optional[str] = None
    account_id: str
    access_token: str
    refresh_token: Optional[str] = None
    token_expiry: Optional[datetime] = None
    scope: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DriveFile(BaseModel):
    """Drive file model for Google Drive integration"""
    id: Optional[str] = None
    account_id: str
    google_drive_id: str
    name: str
    mime_type: str
    size: Optional[int] = None
    web_view_link: Optional[str] = None
    thumbnail_link: Optional[str] = None
    folder_id: Optional[str] = None
    synced_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class File(BaseModel):
    """File model for uploaded files"""
    id: Optional[str] = None
    account_id: str
    folder_id: Optional[str] = None
    name: str
    content_type: str
    size: int
    storage_path: str
    vectorized: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class History(BaseModel):
    """History model for storing learning history as JSON"""
    id: Optional[str] = None
    account_id: str
    folder_id: Optional[str] = None
    title: str
    history_type: str  # 'timeline', 'study', 'quiz', 'document'
    content: Dict[str, Any]  # JSON content
    created_at: Optional[datetime] = None


class Reel(BaseModel):
    """Reel model for short-form learning content"""
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    content_url: str
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    author: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    quiz_content: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Request/Response models
class AccountCreate(BaseModel):
    email: str
    name: str


class DriveFileCreate(BaseModel):
    account_id: str
    google_drive_id: str
    name: str
    mime_type: str
    size: Optional[int] = None
    web_view_link: Optional[str] = None
    thumbnail_link: Optional[str] = None
    folder_id: Optional[str] = None


class HistoryCreate(BaseModel):
    account_id: str
    folder_id: Optional[str] = None
    title: str
    history_type: str
    content: Dict[str, Any]


class ReelCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content_url: str
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    author: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    quiz_content: Optional[Dict[str, Any]] = None
