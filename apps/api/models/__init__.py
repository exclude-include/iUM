"""
Pydantic models for API endpoints
"""

from models.integrations import (
    GoogleAuthUrlResponse,
    GoogleCallbackRequest,
    GoogleCallbackResponse,
    GoogleIntegration,
    DriveFile,
    DriveSyncRequest,
    DriveSyncResponse,
)

from models.reels import (
    Reel,
    ReelUploadResponse,
    ReelListResponse,
)

__all__ = [
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
