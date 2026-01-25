from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from models import Workspace, Folder, Tab, HistoryItem, Document
from utils.supabase_client import get_supabase
from supabase import Client
from db.services import HistoryService, FileService
from db.models import HistoryCreate
import json

router = APIRouter()


def get_history_service(db: Client = Depends(get_supabase)) -> HistoryService:
    return HistoryService(db)


def get_file_service(db: Client = Depends(get_supabase)) -> FileService:
    return FileService(db)


@router.get("/{workspace_id}", response_model=Workspace)
async def get_workspace(workspace_id: str):
    """
    Fetches the "Hard" mode content for a specific workspace.
    
    - **workspace_id**: Unique identifier for the workspace
    """
    # TODO: Implement actual database query
    # For now, return mock data structure
    if workspace_id != "default":
        raise HTTPException(status_code=404, detail="Workspace not found")
    
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
                        name="tab 1",
                        document=Document(
                            id="doc-1",
                            title="S.L4.2.4 Levi-Civita tensor",
                            content_type="text",
                            content="The Levi-Civita symbol is a mathematical object used in tensor calculus. It is true that the Levi-Civita tensor has important properties in vector algebra.",
                            sections=[
                                {
                                    "title": "S.L4.2.4 Levi-Civita tensor",
                                    "content": "The Levi-Civita symbol is a mathematical object used in tensor calculus."
                                },
                                {
                                    "title": "S.L4.3 Further properties of the vector product",
                                    "content": "Additional properties and applications of the vector product will be explored in this section."
                                }
                            ],
                            equations=[
                                "εᵢⱼₖεₘₙₖ = δᵢₘδⱼₙ - δᵢₙδⱼₘ",
                                "εᵢⱼₖεᵢⱼₗ = 2δₖₗ",
                                "εᵢⱼₖεᵢⱼₖ = 6",
                                "εᵢⱼₖεₘⱼₖ = 2δᵢₘ"
                            ]
                        )
                    ),
                    Tab(
                        id="tab-2",
                        name="tab 2",
                        document=None
                    )
                ]
            )
        ],
        history=[
            HistoryItem(
                id="hist-1",
                title="Timeline for Tab1",
                timestamp="2024-01-20T10:00:00Z",
                type="timeline"
            ),
            HistoryItem(
                id="hist-2",
                title="RAG study",
                timestamp="2024-01-19T15:30:00Z",
                type="study"
            ),
            HistoryItem(
                id="hist-3",
                title="LangChain study",
                timestamp="2024-01-18T09:15:00Z",
                type="study"
            )
        ]
    )
    
    return mock_workspace


@router.get("/{workspace_id}/folders", response_model=List[Folder])
async def get_folders(workspace_id: str):
    """Get all folders in a workspace"""
    workspace = await get_workspace(workspace_id)
    return workspace.folders


@router.get("/{workspace_id}/history", response_model=List[HistoryItem])
async def get_workspace_history(
    workspace_id: str,
    account_id: str,
    folder_id: Optional[str] = None,
    history_type: Optional[str] = None,
    limit: int = 50,
    history_service: HistoryService = Depends(get_history_service)
):
    """
    Get history for a workspace from Supabase.
    History is stored as JSON in the database.
    """
    try:
        histories = history_service.get_by_account(
            account_id=account_id,
            folder_id=folder_id,
            history_type=history_type,
            limit=limit
        )
        
        return [
            HistoryItem(
                id=h.id or "",
                title=h.title,
                timestamp=h.created_at.isoformat() if h.created_at else "",
                type=h.history_type,
                metadata=h.content
            )
            for h in histories
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching history: {str(e)}")


@router.post("/{workspace_id}/history")
async def create_history_item(
    workspace_id: str,
    history: HistoryCreate,
    history_service: HistoryService = Depends(get_history_service)
):
    """
    Create a new history item.
    The content field stores JSON data about the learning session.
    
    Example content:
    {
        "messages": [...],
        "sources": [...],
        "duration_seconds": 300,
        "topics": ["Linear Algebra", "Tensors"]
    }
    """
    try:
        created = history_service.create(history)
        return {
            "id": created.id,
            "message": "History item created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating history: {str(e)}")

