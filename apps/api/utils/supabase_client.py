"""
Supabase client configuration for backend API
"""

import os
from supabase import create_client, Client
from typing import Optional

_supabase_client: Optional[Client] = None


def get_user_id_from_token(authorization: str) -> str:
    """
    Extract user_id from Supabase JWT token.
    Prefer local JWT decode (SUPABASE_JWT_SECRET); fallback to auth.get_user().
    """
    if not authorization or not authorization.startswith("Bearer "):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "").strip()
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET")

    if jwt_secret:
        try:
            import jwt
            # Only HS256 here: symmetric secret. RS256/ES256 need PEM and cause "Unable to load PEM file"
            payload = jwt.decode(
                token,
                jwt_secret,
                audience="authenticated",
                algorithms=["HS256"],
                options={"verify_exp": True},
            )
            user_id = payload.get("sub")
            if user_id:
                return user_id
        except jwt.InvalidAlgorithmError:
            # Token uses RS256/ES256 -> fall back to Auth API (no PEM error)
            pass
        except Exception as e:
            # Local verify failed -> fall back to Auth API
            print(f"JWT decode error: {e}, falling back to auth.get_user")

    # Fallback: use Supabase auth.get_user (works with service role; supports any Supabase JWT alg)
    supabase = get_supabase_client()
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_response.user.id
    except Exception as e:
        # Only log unexpected errors, not common session expiry (reduce log noise)
        error_str = str(e)
        if "session" not in error_str.lower() and "expired" not in error_str.lower():
            print(f"Token verification error: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_supabase_client() -> Client:
    """
    Get or create Supabase client instance. Must use service_role key so folder/files APIs bypass RLS.
    
    Returns:
        Client: Supabase client instance
        
    Raises:
        ValueError: If required environment variables are missing
    """
    global _supabase_client
    
    if _supabase_client is None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError(
                "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY (Dashboard > API > service_role secret). "
                "Do not use the anon key here or folder create will fail with RLS (42501)."
            )
        
        _supabase_client = create_client(supabase_url, supabase_key)
    
    return _supabase_client


def get_supabase_client_with_user_jwt(jwt_token: str) -> Client:
    """
    Create a Supabase client that sends the user's JWT so RLS sees auth.uid().
    Must use anon key: with service_role key PostgREST may ignore JWT and RLS blocks insert.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not anon_key:
        raise ValueError(
            "For folder/files APIs with RLS, set SUPABASE_ANON_KEY (Dashboard > API > anon public). "
            "SUPABASE_SERVICE_KEY alone causes RLS violation because auth.uid() is not set."
        )
    client = create_client(supabase_url, anon_key)
    # Use postgrest.auth() so RLS sees auth.uid() from the user JWT (session.headers can be overwritten on request)
    if hasattr(client, "postgrest") and hasattr(client.postgrest, "auth"):
        client.postgrest.auth(f"Bearer {jwt_token}")
    return client


def get_storage_client():
    """
    Get Supabase storage client
    
    Returns:
        Storage client instance
    """
    client = get_supabase_client()
    return client.storage


def get_user_metadata(user_id: str) -> dict:
    """
    Get user metadata from Supabase auth using admin API
    
    Args:
        user_id: User ID to fetch metadata for
        
    Returns:
        dict: User metadata with keys: name, avatar_url, email
    """
    try:
        client = get_supabase_client()
        
        # Use admin API to get user by ID
        user_response = client.auth.admin.get_user_by_id(user_id)
        
        if not user_response or not user_response.user:
            return {
                "name": f"User {user_id[:8]}",
                "avatar_url": None,
                "email": None
            }
        
        user = user_response.user
        user_metadata = user.user_metadata or {}
        
        # Try to get name from various metadata fields
        name = (
            user_metadata.get("full_name") or 
            user_metadata.get("display_name") or 
            user_metadata.get("name") or
            (user.email.split("@")[0] if user.email else None) or
            f"User {user_id[:8]}"
        )
        
        avatar_url = user_metadata.get("avatar_url") or user_metadata.get("picture")
        
        return {
            "name": name,
            "avatar_url": avatar_url,
            "email": user.email
        }
        
    except Exception as e:
        print(f"Error fetching user metadata for {user_id}: {e}")
        # Return fallback data
        return {
            "name": f"User {user_id[:8]}",
            "avatar_url": None,
            "email": None
        }
