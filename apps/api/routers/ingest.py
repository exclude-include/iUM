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
import re
import tempfile

router = APIRouter()


def _normalize_page_text(text: str) -> str:
    """Collapse whitespace and strip; preserve line breaks for readability."""
    if not text or not isinstance(text, str):
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_pdf_with_pdfplumber(file_path: str, original_filename: str) -> List[Document]:
    """Extract text using pdfplumber (better for layout/tables)."""
    import pdfplumber
    documents = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    text = _normalize_page_text(text)
                if not text:
                    text = ""
                documents.append(
                    Document(
                        page_content=text,
                        metadata={"source": original_filename, "page": i + 1},
                    )
                )
    except Exception as e:
        print(f"pdfplumber extraction failed: {e}")
    return documents


def _extract_pdf_with_pypdf(file_path: str, original_filename: str) -> List[Document]:
    """Extract text using PyPDFLoader (pypdf)."""
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    for doc in documents:
        doc.page_content = _normalize_page_text(doc.page_content or "")
    return documents


@trace
async def process_pdf_file(file_path: str, original_filename: str) -> List[Document]:
    """
    Process a PDF file: try pdfplumber first (better recognition), then PyPDF fallback.
    Normalizes text for consistent embedding.
    """
    import asyncio
    loop = asyncio.get_event_loop()

    # 1) Try pdfplumber first (better for many PDFs and tables)
    docs_plumber = await loop.run_in_executor(
        None, _extract_pdf_with_pdfplumber, file_path, original_filename
    )
    total_plumber = sum(len(d.page_content or "") for d in docs_plumber)

    # 2) If little or no text, try PyPDF as fallback (different parser)
    if total_plumber < 50 and os.path.getsize(file_path) > 500:
        docs_pypdf = await loop.run_in_executor(
            None, _extract_pdf_with_pypdf, file_path, original_filename
        )
        total_pypdf = sum(len(d.page_content or "") for d in docs_pypdf)
        if total_pypdf > total_plumber:
            return docs_pypdf

    return docs_plumber if docs_plumber else await loop.run_in_executor(
        None, _extract_pdf_with_pypdf, file_path, original_filename
    )


@trace
async def process_text_file(file_path: str, original_filename: str) -> List[Document]:
    """
    Process a text file content and create LangChain Documents (UTF-8 for Korean etc.).
    """
    loader = TextLoader(file_path, encoding="utf-8", autodetect_encoding=True)
    documents = loader.load()
    for doc in documents:
        doc.page_content = _normalize_page_text(doc.page_content or "")
    return documents


@router.post("/upload") # ✨ 프론트엔드 경로(/api/ingest/upload)에 맞춤
async def ingest_document(
    file: UploadFile = File(...),
    collection_name: str = Form("user_knowledge"),
    folder_id: Optional[str] = Form(None),
    file_id: Optional[str] = Form(None),  # ✨ 기존 파일 ID (업데이트 시 사용)
    update_existing: Optional[str] = Form(None),  # ✨ "true"면 기존 파일 업데이트
    is_temp: Optional[str] = Form(None), # ✨ 임시 저장 여부 ("true" / "false")
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
        # 한글 파일명은 Storage에서 InvalidKey 오류 발생하므로 UUID 사용
        # 원래 파일명은 DB에 저장
        import uuid
        safe_filename = f"{uuid.uuid4().hex}{file_ext}"
        storage_path = f"{folder_id}/{safe_filename}" if folder_id else safe_filename

        try:
            # upsert='true'로 설정하여 덮어쓰기 허용
            print(f"DTO [1/5] Uploading to Supabase Storage: {storage_path}")
            supabase.storage.from_("documents").upload(
                path=storage_path,
                file=content,
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
            print("DTO [1/5] Storage upload complete")
        except Exception as e:
            print(f"Storage upload warning (might exist): {e}")

        # 3. Supabase DB (files 테이블)에 메타데이터 저장 또는 업데이트
        is_update = update_existing == "true" and file_id
        is_temp_bool = is_temp == "true"

        print(f"DTO [2/5] Saving to Supabase DB (files table)")
        if is_update:
            # ✨ 기존 파일 업데이트 (이름 변경, 내용 변경 등)
            update_data = {
                "name": file.filename,
                "storage_path": storage_path,
                "content_type": file.content_type,
                "size": len(content),
                "is_temp": is_temp_bool # ✨ 업데이트 시 임시 저장 상태 반영
            }
            db_res = supabase.table("files").update(update_data).eq("id", file_id).execute()
            new_file_id = file_id
        else:
            # 새 파일 생성
            file_data = {
                "name": file.filename,
                "folder_id": folder_id or "root",
                "storage_path": storage_path,
                "content_type": file.content_type,
                "size": len(content),
                "user_id": user_id,  # ✨ user_id 추가 (None일 수 있음)
                "is_temp": is_temp_bool # ✨ 새 파일 임시 저장 여부
            }

            # DB Insert & Return ID
            db_res = supabase.table("files").insert(file_data).execute()

            # 새로 생성된 파일 ID (이것이 NotebookLM 기능의 핵심 ID가 됨)
            new_file_id = db_res.data[0]['id'] if db_res.data else f"temp-{os.urandom(4).hex()}"
        print(f"DTO [2/5] DB save complete. File ID: {new_file_id}")

        # 4. 문서 처리 (텍스트 추출)
        documents: List[Document] = []
        try:
            print(f"DTO [3/5] extracting text from file: {file.filename}")
            # Explicitly check for image content to skip text processing
            if file.content_type.startswith("image/") or file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg")):
                 print(f"Skipping text extraction for image file: {file.filename}")
            
            elif file.content_type == "application/pdf" or file.filename.endswith(".pdf"):
                documents = await process_pdf_file(tmp_file_path, file.filename)
            
            elif file.content_type.startswith("text/") or file.filename.endswith((".txt", ".md", ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json", ".csv")):
                 # Only process explicitly text-like files
                documents = await process_text_file(tmp_file_path, file.filename)
            
            else:
                print(f"Skipping text extraction for unsupported type: {file.filename} ({file.content_type})")
            
            print(f"DTO [3/5] Extraction complete. {len(documents)} documents found.")
        except Exception as e:
            print(f"Error processing document: {e}")
            # 에러가 나도 파일 업로드는 성공으로 처리 (Vector DB만 스킵)
            pass
            
        # ✨ 내용이 있는 경우에만 Vector DB 저장
        if documents:
            # 빈 문서 필터링
            documents = [doc for doc in documents if doc.page_content and doc.page_content.strip()]
            
            if documents:
                # 5. 메타데이터 주입 (document_id·folder_id는 문자열로 통일해 벡터 DB 필터 일치 보장)
                file_id_str = str(new_file_id)
                folder_id_str = str(folder_id) if folder_id else "root"
                for doc in documents:
                    doc.metadata["source"] = file.filename
                    doc.metadata["folder_id"] = folder_id_str
                    doc.metadata["type"] = "pdf" if file.filename.endswith(".pdf") else "text"
                    doc.metadata["document_id"] = file_id_str

                # 6. 벡터 스토어(Supabase pgvector)에 저장
                print(f"DTO [4/5] Adding to Vector Store (Supabase)...")
                add_documents_to_vector_store(
                    documents=documents,
                    collection_name=collection_name
                )
                print(f"DTO [4/5] Vector Store add complete")

                # 7. 저장 직후 검증: document_id로 검색 가능한지 확인
                try:
                    from utils.vector_store import get_retriever
                    retriever = get_retriever(
                        collection_name=collection_name,
                        k=1,
                        folder_id=folder_id or None,
                        document_ids=[file_id_str],
                    )
                    verify_docs = retriever.invoke(" ")
                    if not verify_docs:
                        print(f"DTO [WARN] Vector verify: no chunks found for document_id={file_id_str}. Filter may not match stored metadata.")
                    else:
                        print(f"DTO [4/5] Vector verify OK: {len(verify_docs)} chunk(s) accessible for document_id={file_id_str}")
                except Exception as verify_err:
                    print(f"DTO [WARN] Vector verify failed: {verify_err}")
        
        print("DTO [5/5] All steps complete. Returning response.")
        return JSONResponse(
            status_code=200,
            content={
                "message": "File processed and saved successfully",
                "filename": file.filename,
                "document_ids": [str(new_file_id)],
                "chunks_created": len(documents) if documents else 0,
                "collection": collection_name,
                "storage_path": storage_path
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document (Outer): {str(e)}"
        )
    
    finally:
        # 임시 파일 정리
        if 'tmp_file_path' in locals() and os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


@router.get("/status")
async def get_ingestion_status(collection_name: str = "user_knowledge"):
    """
    Get status of the vector store collection (Supabase: no count, returns active if reachable).
    """
    try:
        from utils.vector_store import get_vector_store
        get_vector_store(collection_name=collection_name)
        return {
            "collection_name": collection_name,
            "status": "active"
        }
    except Exception as e:
        return {
            "collection_name": collection_name,
            "document_count": 0,
            "status": "error",
            "error": str(e)
        }


@router.get("/verify")
async def verify_file_in_vector_db(file_id: str, collection_name: str = "user_knowledge"):
    """
    Verify that an uploaded file's chunks are stored and reachable in the vector DB.
    Returns chunks_found and ok=True if at least one chunk is accessible for the given document_id.
    """
    try:
        from utils.vector_store import get_retriever
        file_id_str = str(file_id)
        retriever = get_retriever(
            collection_name=collection_name,
            k=10,
            document_ids=[file_id_str],
        )
        docs = retriever.invoke(" ")
        count = len(docs)
        return {
            "ok": count > 0,
            "file_id": file_id_str,
            "chunks_found": count,
            "message": f"{count} chunk(s) accessible" if count > 0 else "No chunks found for this document_id. Check that the file was embedded and metadata.document_id matches.",
        }
    except Exception as e:
        return {
            "ok": False,
            "file_id": str(file_id),
            "chunks_found": 0,
            "error": str(e),
            "message": "Verification failed.",
        }