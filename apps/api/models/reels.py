"""
Pydantic models for reels-related API endpoints
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime


class Reel(BaseModel):
    """Model for video reel metadata"""
    id: Optional[str] = None
    user_id: str
    title: str
    description: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = Field(None, description="Duration in seconds")
    views: int = Field(default=0)
    likes: int = Field(default=0)
    tags: list[str] = Field(default_factory=list, description="Hashtags for categorization and recommendation")
    folder_name: Optional[str] = Field(None, description="Folder name for auto-tagging")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ReelUploadResponse(BaseModel):
    """Response model for reel upload"""
    success: bool
    message: str
    reel: Reel


class ReelListResponse(BaseModel):
    """Response model for listing reels"""
    reels: list[Reel]
    total: int
    offset: int
    limit: int
