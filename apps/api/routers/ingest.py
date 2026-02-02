"""
Document ingestion endpoint with Supabase Storage integration
Updated: Persists files to Supabase Storage & DB before VectorDB ingestion
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Header
from fastapi.responses import JSONResponse
from typing import List, Optional
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from utils.vector_store import add_documents_to_vector_store
from utils.opik_config import trace
from utils.supabase_client import get_supabase_client
import os
import tempfile

router = APIRouter()

@trace
async def process_pdf_file(file_path: str, original_filename: str) -> List[Document]:
    """
    Process a PDF file and extract text as LangChain Documents.
    """
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    return documents


@trace
async def process_text_file(file_path: str, original_filename: str) -> List[Document]:
    """
    Process a text file content and create LangChain Documents.
    """
    loader = TextLoader(file_path)
    documents = loader.load()
    return documents


@router.post("/upload") # ✨ 프론트엔드 경로(/api/ingest/upload)에 맞춤
async def ingest_document(
    file: UploadFile = File(...),
    collection_name: str = Form("user_knowledge"),
    folder_id: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None) # ✨ 인증 토큰 추가
):
    """
    Ingest a document:
    1. Upload to Supabase Storage (Persistence)
    2. Save metadata to Supabase DB (Persistence)
    3. Process & Embed into VectorDB (Search)
    """
    supabase = get_supabase_client()
    user_id = None
    
    # ✨ JWT 토큰에서 user_id 추출
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.replace("Bearer ", "")
            user_response = supabase.auth.get_user(token)
            if user_response and user_response.user:
                user_id = user_response.user.id
        except Exception as e:
            print(f"Token verification warning: {e}")
            # 인증 실패해도 업로드는 허용할지, 막을지 결정 필요.
            # 현재는 RLS 때문에 user_id 없으면 DB insert 실패할 수 있음.
            # 하지만 로컬/비로그인 테스트를 위해 예외 처리.
    
    # 1. 파일 내용을 메모리에 읽기 (Storage 업로드 및 처리용)
    content = await file.read()
    
    # 임시 파일 생성 (LangChain Loader용)
    # suffix를 붙여야 Loader가 파일 타입을 인식함
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if not file_ext and file.content_type == "application/pdf":
        file_ext = ".pdf"
    elif not file_ext:
        file_ext = ".txt"

    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
        tmp_file.write(content)
        tmp_file_path = tmp_file.name

    try:
        # 2. Supabase Storage에 영구 저장
        # 경로: folder_id/filename (폴더가 없으면 root/filename)
        storage_path = f"{folder_id}/{file.filename}" if folder_id else file.filename
        
        try:
            # upsert='true'로 설정하여 덮어쓰기 허용
            supabase.storage.from_("documents").upload(
                path=storage_path,
                file=content,
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
        except Exception as e:
            print(f"Storage upload warning (might exist): {e}")

        # 3. Supabase DB (files 테이블)에 메타데이터 저장
        file_data = {
            "name": file.filename,
            "folder_id": folder_id or "root",
            "storage_path": storage_path,
            "content_type": file.content_type,
            "size": len(content),
            "user_id": user_id  # ✨ user_id 추가 (None일 수 있음)
        }
        
        # DB Insert & Return ID
        db_res = supabase.table("files").insert(file_data).execute()
        
        # 새로 생성된 파일 ID (이것이 NotebookLM 기능의 핵심 ID가 됨)
        new_file_id = db_res.data[0]['id'] if db_res.data else f"temp-{os.urandom(4).hex()}"

        # 4. 문서 처리 (텍스트 추출)
        documents: List[Document] = []
        if file.content_type == "application/pdf" or file.filename.endswith(".pdf"):
            documents = await process_pdf_file(tmp_file_path, file.filename)
        else:
            documents = await process_text_file(tmp_file_path, file.filename)
            
        if not documents:
            raise HTTPException(status_code=400, detail="No content extracted from the file")

        # 5. 메타데이터 주입 (검색 필터링을 위해 document_id 필수)
        for doc in documents:
            doc.metadata["source"] = file.filename
            doc.metadata["folder_id"] = folder_id
            doc.metadata["type"] = "pdf" if file.filename.endswith(".pdf") else "text"
            # ✨ 중요: 이 ID로 나중에 "이 파일에서만 검색해줘" 기능 구현
            doc.metadata["document_id"] = new_file_id 

        # 6. 벡터 스토어(Chroma)에 저장
        ids = add_documents_to_vector_store(
            documents=documents,
            collection_name=collection_name
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "File processed and saved successfully",
                "filename": file.filename,
                "document_ids": [new_file_id], # 프론트엔드는 이 DB ID를 추적함
                "chunks_created": len(ids),
                "collection": collection_name,
                "storage_path": storage_path
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document: {str(e)}"
        )
    
    finally:
        # 임시 파일 정리
        if 'tmp_file_path' in locals() and os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


@router.get("/status")
async def get_ingestion_status(collection_name: str = "user_knowledge"):
    """
    Get status of the vector store collection.
    """
    try:
        from utils.vector_store import get_vector_store
        
        vector_store = get_vector_store(collection_name=collection_name)
        # Chroma collection count
        count = vector_store._collection.count()
        
        return {
            "collection_name": collection_name,
            "document_count": count,
            "status": "active"
        }
    except Exception as e:
        return {
            "collection_name": collection_name,
            "document_count": 0,
            "status": "error",
            "error": str(e)
        }