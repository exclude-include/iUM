"""
Google OAuth Authentication Router
Handles user login/logout with Google OAuth and JWT token management
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import os
import json
import secrets
from datetime import datetime

from models.auth import (
    GoogleLoginUrlResponse,
    GoogleLoginCallbackResponse,
    UserInfo,
    TokenResponse,
    RefreshTokenRequest,
)
from utils.supabase_client import get_supabase_client
from utils.jwt_utils import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    get_access_token_expire_seconds,
)

router = APIRouter()

# Google OAuth scopes for login (user profile + email)
LOGIN_SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
]

# Redirect URI for login (separate from Drive integration)
LOGIN_REDIRECT_URI = os.getenv(
    "GOOGLE_AUTH_REDIRECT_URI",
    "http://localhost:8000/api/auth/google/callback"
)


def get_login_oauth_flow(state: str = None) -> Flow:
    """
    Create Google OAuth flow instance for login
    
    Args:
        state: Optional state parameter for CSRF protection
        
    Returns:
        Flow: Google OAuth flow instance
        
    Raises:
        HTTPException: If OAuth credentials are not configured
    """
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [LOGIN_REDIRECT_URI],
        }
    }
    
    if not client_config["web"]["client_id"] or not client_config["web"]["client_secret"]:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
        )
    
    flow = Flow.from_client_config(
        client_config,
        scopes=LOGIN_SCOPES,
        redirect_uri=LOGIN_REDIRECT_URI,
    )
    
    if state:
        flow.state = state
    
    return flow


@router.get("/google/login", response_model=GoogleLoginUrlResponse)
async def google_login():
    """
    Generate Google OAuth authorization URL for login
    
    Returns:
        GoogleLoginUrlResponse: Authorization URL and state parameter
    """
    try:
        # Generate state parameter for CSRF protection
        state = secrets.token_urlsafe(32)
        
        flow = get_login_oauth_flow()
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='select_account',  # Allow user to select account
        )
        
        return GoogleLoginUrlResponse(
            authorization_url=authorization_url,
            state=state
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate authorization URL: {str(e)}"
        )


@router.get("/google/callback", response_model=GoogleLoginCallbackResponse)
async def google_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="State parameter for verification"),
):
    """
    Handle Google OAuth callback, create/update user, and issue JWT tokens
    
    Args:
        code: Authorization code from Google
        state: State parameter for CSRF verification
        
    Returns:
        GoogleLoginCallbackResponse: User info and JWT tokens
    """
    try:
        # Exchange code for tokens
        flow = get_login_oauth_flow()
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        # Get user info from Google
        oauth2_service = build('oauth2', 'v2', credentials=credentials)
        user_info = oauth2_service.userinfo().get().execute()
        
        google_id = user_info.get('id')
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0])
        picture = user_info.get('picture')
        
        if not google_id or not email:
            raise HTTPException(
                status_code=400,
                detail="Failed to retrieve user information from Google"
            )
        
        # Upsert user in database
        supabase = get_supabase_client()
        
        user_data = {
            "google_id": google_id,
            "email": email,
            "name": name,
            "picture": picture,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Try to find existing user by google_id
        existing_user = supabase.table("users").select("*").eq("google_id", google_id).execute()
        
        if existing_user.data:
            # Update existing user
            result = supabase.table("users").update(user_data).eq("google_id", google_id).execute()
            user = result.data[0]
        else:
            # Create new user
            result = supabase.table("users").insert(user_data).execute()
            user = result.data[0]
        
        if not user:
            raise HTTPException(
                status_code=500,
                detail="Failed to create or update user"
            )
        
        # Create JWT tokens
        token_payload = {
            "user_id": user["id"],
            "email": user["email"],
        }
        
        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token(token_payload)
        
        return GoogleLoginCallbackResponse(
            success=True,
            message="Login successful",
            user=UserInfo(
                id=user["id"],
                google_id=user["google_id"],
                email=user["email"],
                name=user["name"],
                picture=user.get("picture"),
                created_at=user.get("created_at"),
                updated_at=user.get("updated_at"),
            ),
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_in=get_access_token_expire_seconds(),
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OAuth callback failed: {str(e)}"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token
    
    Args:
        request: Refresh token request
        
    Returns:
        TokenResponse: New JWT tokens
    """
    try:
        # Verify refresh token
        token_data = verify_token(request.refresh_token, expected_type="refresh")
        
        # Verify user still exists
        supabase = get_supabase_client()
        result = supabase.table("users").select("*").eq("id", token_data.user_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        user = result.data[0]
        
        # Create new tokens
        token_payload = {
            "user_id": user["id"],
            "email": user["email"],
        }
        
        new_access_token = create_access_token(token_payload)
        new_refresh_token = create_refresh_token(token_payload)
        
        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=get_access_token_expire_seconds(),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Token refresh failed: {str(e)}"
        )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: UserInfo = Depends(get_current_user)):
    """
    Get current authenticated user information
    
    Args:
        current_user: Current authenticated user (from JWT)
        
    Returns:
        UserInfo: Current user information
    """
    return current_user


@router.post("/logout")
async def logout(current_user: UserInfo = Depends(get_current_user)):
    """
    Logout current user
    
    Note: Since JWT is stateless, actual logout is handled client-side
    by removing the tokens. This endpoint exists for API consistency
    and could be extended to implement token blacklisting if needed.
    
    Returns:
        dict: Logout success message
    """
    return {
        "success": True,
        "message": "Logged out successfully. Please remove tokens from client storage."
    }
