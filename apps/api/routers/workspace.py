from fastapi import APIRouter, HTTPException
from typing import List
from models import Workspace, Folder, Tab, HistoryItem, Document

router = APIRouter()


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

