from fastapi import APIRouter, HTTPException, Header
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from models import Workspace, Folder, Tab, HistoryItem, Document
from utils.supabase_client import get_supabase_client, get_storage_client, get_user_id_from_token

router = APIRouter()


class FolderCreate(BaseModel):
    name: str
    color: str = "#3B82F6"


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class FileUpdate(BaseModel):
    name: Optional[str] = None


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
        # Use service_role so RLS is bypassed; user already verified via get_user_id_from_token
        supabase = get_supabase_client()

        # Get user's folders from DB
        folders_response = supabase.table("folders").select("*").eq("user_id", user_id).execute()
        folders = folders_response.data or []

        # Get user's files from DB (filter by user_id)
        files_response = supabase.table("files").select("*").eq("user_id", user_id).execute()
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
    # Use service_role so RLS is bypassed; user already verified via get_user_id_from_token
    supabase = get_supabase_client()

    try:
        response = supabase.table("folders").insert({
            "user_id": user_id,
            "name": folder.name,
            "color": folder.color
        }).execute()

        if response.data and len(response.data) > 0:
            return response.data[0]
        raise HTTPException(status_code=500, detail="Failed to create folder (no data returned)")

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        print(f"Error creating folder: {e}")
        if "relation \"folders\" does not exist" in err_msg or "does not exist" in err_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="Folders table not set up. Run Supabase migration: apps/web/supabase/migrations/003_create_folders_table.sql",
            )
        if "42501" in err_msg or "row-level security" in err_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="RLS violation: set SUPABASE_SERVICE_KEY to the service_role (secret) key in Render, not the anon key. Supabase Dashboard > Project Settings > API > service_role.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {err_msg}")


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


@router.delete("/file/{file_id}")
async def delete_file(
    file_id: str,
    authorization: str = Header(...)
):
    """
    Delete a file from both Supabase Storage and DB.
    Also cleans up vector store entries for the file.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()

    try:
        # 1. Get file metadata to find storage_path
        # First try to find file by id (user_id might be null for older files)
        file_response = supabase.table("files").select("*").eq("id", file_id).execute()

        if not file_response.data or len(file_response.data) == 0:
            raise HTTPException(status_code=404, detail="File not found")

        file_data = file_response.data[0]

        # Verify ownership if user_id exists on the file
        file_owner = file_data.get("user_id")
        if file_owner and file_owner != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this file")

        storage_path = file_data.get("storage_path")

        # 2. Delete from Supabase Storage
        if storage_path:
            try:
                supabase.storage.from_("documents").remove([storage_path])
            except Exception as e:
                print(f"Warning: Failed to delete from storage: {e}")
                # Continue even if storage delete fails

        # 3. Delete from files table (DB)
        supabase.table("files").delete().eq("id", file_id).execute()

        # 4. Clean up vector store entries for this file
        try:
            from utils.vector_store import get_vector_store
            vector_store = get_vector_store(collection_name="user_knowledge")
            # Delete all chunks with this document_id
            vector_store._collection.delete(where={"document_id": file_id})
        except Exception as e:
            print(f"Warning: Failed to clean up vector store: {e}")
            # Continue even if vector cleanup fails

        return {
            "success": True,
            "deleted_id": file_id,
            "storage_path": storage_path
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{file_id}/content")
async def get_file_content(file_id: str):
    """
    Get the content of a file from Supabase Storage.
    Used for opening .ium notebook files.
    """
    supabase = get_supabase_client()

    try:
        # First get file metadata from DB to get storage_path
        file_response = supabase.table("files").select("*").eq("id", file_id).execute()

        if not file_response.data or len(file_response.data) == 0:
            raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

        file_data = file_response.data[0]
        storage_path = file_data.get("storage_path")

        if not storage_path:
            raise HTTPException(status_code=404, detail="File storage path not found")

        # Download file content from Supabase Storage
        file_content = supabase.storage.from_("documents").download(storage_path)

        # For .ium files, parse as JSON and return
        if storage_path.endswith(".ium") or file_data.get("name", "").endswith(".ium"):
            import json
            return json.loads(file_content.decode("utf-8"))

        # For other files, return as text
        return {"content": file_content.decode("utf-8")}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching file content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch file content: {str(e)}")


@router.get("/file/{file_id}/download")
async def download_file(file_id: str):
    """
    Download a file from Supabase Storage as a binary stream.
    Returns the file with Content-Disposition header for browser download.
    """
    from fastapi.responses import StreamingResponse
    import io
    
    supabase = get_supabase_client()

    try:
        # Get file metadata from DB
        file_response = supabase.table("files").select("*").eq("id", file_id).execute()

        if not file_response.data or len(file_response.data) == 0:
            raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

        file_data = file_response.data[0]
        storage_path = file_data.get("storage_path")
        file_name = file_data.get("name", "download")

        if not storage_path:
            raise HTTPException(status_code=404, detail="File storage path not found")

        # Download file bytes from Supabase Storage
        file_bytes = supabase.storage.from_("documents").download(storage_path)

        # Determine content type based on extension
        ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
        content_types = {
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'md': 'text/markdown',
            'json': 'application/json',
            'ium': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
        }
        content_type = content_types.get(ext, 'application/octet-stream')

        # Return as streaming response with download header
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{file_name}"',
                "Content-Length": str(len(file_bytes))
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")



@router.put("/{workspace_id}/files/{file_id}")
async def update_file(
    workspace_id: str,
    file_id: str,
    file_update: FileUpdate,
    authorization: str = Header(...)
):
    """
    Update a file (e.g. rename) for the authenticated user.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        update_data = {}
        if file_update.name is not None:
            update_data["name"] = file_update.name
            
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")
            
        # RLS will enforce user_id check, but good to be explicit/safe
        response = supabase.table("files").update(update_data).eq("id", file_id).eq("user_id", user_id).execute()
        
        if response.data:
            return response.data[0]
        
        # If no data returned, item might not exist or belong to user
        raise HTTPException(status_code=404, detail="File not found or access denied")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{workspace_id}/files/{file_id}")
async def delete_file(
    workspace_id: str,
    file_id: str,
    authorization: str = Header(...)
):
    """
    Delete a file for the authenticated user (DB record + Storage).
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    storage = get_storage_client()
    
    try:
        # 1. Get file metadata to find storage path
        file_res = supabase.table("files").select("storage_path").eq("id", file_id).eq("user_id", user_id).execute()
        if not file_res.data:
            # Idempotent delete: If file doesn't exist, consider it deleted.
            return {"success": True, "deleted_id": file_id, "message": "File already deleted or not found"}
        
        storage_path = file_res.data[0]['storage_path']
        
        # 2. Delete from DB
        supabase.table("files").delete().eq("id", file_id).eq("user_id", user_id).execute()
        
        # 3. Delete from Storage (Best effort)
        try:
            storage.from_("documents").remove([storage_path])
        except Exception as e:
            print(f"Storage delete warning: {e}")
            
        return {"success": True, "deleted_id": file_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))