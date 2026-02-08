"""
Pydantic models for reels-related API endpoints
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from datetime import datetime


class QuizOption(BaseModel):
    """Single quiz option (e.g., A, B, C, D)"""
    key: str = Field(..., description="Option key (A, B, C, D, etc.)")
    text: str = Field(..., description="Option text content")


class Quiz(BaseModel):
    """Quiz data embedded in a reel"""
    question: str = Field(..., description="Quiz question text")
    options: List[QuizOption] = Field(..., description="List of answer options")
    answer: str = Field(..., description="Correct answer key (A, B, C, etc.)")
    explanation: Optional[str] = Field(None, description="Explanation for the correct answer")
    timestamp_seconds: Optional[float] = Field(None, description="When quiz appears in video (seconds)")


class Reel(BaseModel):
    """Model for video reel metadata"""
    id: Optional[str] = None
    user_id: str
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None  # Made optional for video-less reels
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = Field(None, description="Duration in seconds")
    views: int = Field(default=0)
    likes: int = Field(default=0)
    tags: list[str] = Field(default_factory=list, description="Hashtags for categorization and recommendation")
    folder_name: Optional[str] = Field(None, description="Folder name for auto-tagging")
    folder_id: Optional[str] = Field(None, description="Folder ID for explicit categorization")
    similarity: Optional[float] = Field(None, description="Similarity score for debugging")
    quiz: Optional[Quiz] = Field(None, description="Quiz data for interactive learning")
    color: Optional[str] = Field(None, description="Pastel background color for video-less reels (hex code)")
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


class ReelWithSimilarity(Reel):
    """Reel model with similarity score for recommendation results"""
    similarity: Optional[float] = Field(None, description="Cosine similarity score (0-1)")


class ReelRecommendResponse(BaseModel):
    """Response model for reel recommendation"""
    success: bool
    message: Optional[str] = None
    reel: Optional[ReelWithSimilarity] = None


class ReelCreateWithQuiz(BaseModel):
    """Request model for creating a reel with quiz data"""
    user_id: str
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None  # Made optional for video-less reels
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    folder_name: Optional[str] = None
    folder_id: Optional[str] = None
    quiz: Optional[Quiz] = None
    color: Optional[str] = Field(None, description="Pastel background color (auto-generated if not provided)")
