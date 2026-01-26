"""
Pydantic models for API endpoints
"""

# Import core models (previously in models.py)
from .core import (
    LearningUnit,
    FeedResponse,
    Document,
    Tab,
    Folder,
    HistoryItem,
    Workspace,
    Mission,
    UserProgress,
    Source,
    QuizOption,
    QuizQuestion,
    ChatMessage,
    ChatResponse,
)

# Import integration models
from .integrations import (
    GoogleAuthUrlResponse,
    GoogleCallbackRequest,
    GoogleCallbackResponse,
    GoogleIntegration,
    DriveFile,
    DriveSyncRequest,
    DriveSyncResponse,
)

# Import reel models
from .reels import (
    Reel,
    ReelUploadResponse,
    ReelListResponse,
)

__all__ = [
    # Core models (from models/core.py)
    "LearningUnit",
    "FeedResponse",
    "Document",
    "Tab",
    "Folder",
    "HistoryItem",
    "Workspace",
    "Mission",
    "UserProgress",
    "Source",
    "QuizOption",
    "QuizQuestion",
    "ChatMessage",
    "ChatResponse",
    # Integration models
    "GoogleAuthUrlResponse",
    "GoogleCallbackRequest",
    "GoogleCallbackResponse",
    "GoogleIntegration",
    "DriveFile",
    "DriveSyncRequest",
    "DriveSyncResponse",
    # Reel models
    "Reel",
    "ReelUploadResponse",
    "ReelListResponse",
]
