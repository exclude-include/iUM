from fastapi import APIRouter, HTTPException, Header
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from models import Workspace, Folder, Tab, HistoryItem, Document
from utils.supabase_client import get_supabase_client

router = APIRouter()


class FolderCreate(BaseModel):
    name: str
    color: str = "#3B82F6"


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


def get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from Supabase JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    supabase = get_supabase_client()
    
    try:
        # Verify and decode the JWT token
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_response.user.id
    except Exception as e:
        print(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/{workspace_id}", response_model=Workspace)
async def get_workspace(workspace_id: str):
    """
    Fetches the workspace structure.
    (Currently keeps mock structure for folders/history, 
     but files will be synced via the get_folders endpoint)
    """
    if workspace_id != "default":
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # 기본 폴더 구조 (프론트엔드와 동기화됨)
    mock_workspace = Workspace(
        id="default",
        name="My Workspace",
        folders=[
            Folder(
                id="folder-1",
                name="Folder 1",
                icon="crown",
                tabs=[
                    Tab(
                        id="tab-1",
                        name="Welcome",
                        document=Document(
                            id="doc-1",
                            title="Welcome Note",
                            content_type="text",
                            content="Welcome to iUM! Upload your files to start.",
                            sections=[],
                            equations=[]
                        )
                    )
                ]
            )
        ],
        history=[]
    )
    
    return mock_workspace


@router.get("/{workspace_id}/folders")
async def get_folders(
    workspace_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Get folders and files for the authenticated user.
    Returns folders with their associated files.
    """
    supabase = get_supabase_client()
    
    # If no auth header, return empty (user not logged in)
    if not authorization:
        return {"folders": [], "files": []}
    
    try:
        user_id = get_user_id_from_token(authorization)
        
        # Get user's folders from DB
        folders_response = supabase.table("folders").select("*").eq("user_id", user_id).execute()
        folders = folders_response.data or []
        
        # Get user's files from DB
        files_response = supabase.table("files").select("*").execute()
        files = files_response.data or []
        
        return {
            "folders": folders,
            "files": files
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching folders from DB: {e}")
        return {"folders": [], "files": []}


@router.post("/{workspace_id}/folders")
async def create_folder(
    workspace_id: str,
    folder: FolderCreate,
    authorization: str = Header(...)
):
    """
    Create a new folder for the authenticated user.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        response = supabase.table("folders").insert({
            "user_id": user_id,
            "name": folder.name,
            "color": folder.color
        }).execute()
        
        if response.data:
            return response.data[0]
        raise HTTPException(status_code=500, detail="Failed to create folder")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{workspace_id}/folders/{folder_id}")
async def update_folder(
    workspace_id: str,
    folder_id: str,
    folder: FolderUpdate,
    authorization: str = Header(...)
):
    """
    Update a folder for the authenticated user.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        update_data = {}
        if folder.name is not None:
            update_data["name"] = folder.name
        if folder.color is not None:
            update_data["color"] = folder.color
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        response = supabase.table("folders").update(update_data).eq("id", folder_id).eq("user_id", user_id).execute()
        
        if response.data:
            return response.data[0]
        raise HTTPException(status_code=404, detail="Folder not found")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{workspace_id}/folders/{folder_id}")
async def delete_folder(
    workspace_id: str,
    folder_id: str,
    authorization: str = Header(...)
):
    """
    Delete a folder for the authenticated user.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        response = supabase.table("folders").delete().eq("id", folder_id).eq("user_id", user_id).execute()
        
        return {"success": True, "deleted_id": folder_id}
        
    except Exception as e:
        print(f"Error deleting folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))