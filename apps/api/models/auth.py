"""
Pydantic models for authentication-related API endpoints
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class GoogleLoginUrlResponse(BaseModel):
    """Response model for Google OAuth login URL generation"""
    authorization_url: str = Field(..., description="Google OAuth authorization URL")
    state: str = Field(..., description="State parameter for CSRF protection")


class UserInfo(BaseModel):
    """User information model"""
    id: str = Field(..., description="User UUID")
    google_id: str = Field(..., description="Google unique ID")
    email: str = Field(..., description="User email")
    name: str = Field(..., description="User display name")
    picture: Optional[str] = Field(None, description="Profile picture URL")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    """JWT token response model"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration time in seconds")


class GoogleLoginCallbackResponse(BaseModel):
    """Response model for Google OAuth login callback"""
    success: bool
    message: str
    user: UserInfo
    tokens: TokenResponse


class RefreshTokenRequest(BaseModel):
    """Request model for token refresh"""
    refresh_token: str = Field(..., description="JWT refresh token")


class TokenData(BaseModel):
    """JWT token payload data"""
    user_id: str = Field(..., description="User UUID")
    email: Optional[str] = None
    exp: Optional[datetime] = None
    type: str = Field(default="access", description="Token type: access or refresh")
