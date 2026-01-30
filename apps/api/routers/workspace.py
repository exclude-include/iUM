from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from models import Workspace, Folder, Tab, HistoryItem, Document
from utils.supabase_client import get_supabase_client

router = APIRouter()

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
async def get_folders(workspace_id: str):
    """
    Get all files from Supabase DB to sync with frontend.
    Returns a flat list of files which frontend maps to folders.
    """
    supabase = get_supabase_client()
    
    try:
        # 'files' 테이블에서 모든 파일 메타데이터 조회
        response = supabase.table("files").select("*").execute()
        files = response.data
        
        # 프론트엔드 store의 fetchFiles 액션이 기대하는 포맷: { "files": [...] }
        return {
            "files": files
        }
        
    except Exception as e:
        print(f"Error fetching files from DB: {e}")
        # 에러 발생 시 빈 목록 반환하여 앱이 멈추지 않게 함
        return {"files": []}