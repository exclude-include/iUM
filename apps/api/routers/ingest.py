"""
Document ingestion endpoint with Supabase Storage integration
Updated: Persists files to Supabase Storage & DB before VectorDB ingestion
Includes summary generation for RAG context
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Header
from fastapi.responses import JSONResponse
from typing import List, Optional
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_google_genai import ChatGoogleGenerativeAI
from utils.vector_store import add_documents_to_vector_store
from utils.opik_config import trace
from utils.supabase_client import get_supabase_client
import os
import tempfile

router = APIRouter()


async def generate_file_summary(content: str, filename: str, max_content_length: int = 10000) -> str:
    """
    Generate AI summary for uploaded file content.
    Used for RAG context in agent system prompts.
    """
    try:
        # Truncate if content is too long
        truncated_content = content[:max_content_length]
        if len(content) > max_content_length:
            truncated_content += f"\n\n[... Content truncated. Total length: {len(content)} characters]"
        
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.3,
            max_output_tokens=500
        )
        
        prompt = f"""Summarize the following document concisely in 2-4 sentences.
Focus on: main topic, key concepts, and what information can be found in this document.
This summary will be used to help an AI agent decide whether to read this file for answering user questions.

Filename: {filename}

Content:
{truncated_content}

Summary (2-4 sentences, be specific about what information this file contains):"""

        response = await llm.ainvoke(prompt)
        return response.content.strip()
    except Exception as e:
        print(f"Error generating summary: {e}")
        return f"File: {filename} (summary generation failed)"


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
        
        # ✨ 4. Summary 생성 및 DB 업데이트
        file_summary = None
        if documents:
            try:
                # Combine all document contents for summary
                full_content = "\n".join([doc.page_content for doc in documents if doc.page_content])
                if full_content.strip():
                    print(f"DTO [3.5/5] Generating AI summary for file...")
                    file_summary = await generate_file_summary(full_content, file.filename)
                    print(f"DTO [3.5/5] Summary generated: {file_summary[:100]}...")
                    
                    # Update DB with summary
                    supabase.table("files").update({"summary": file_summary}).eq("id", new_file_id).execute()
                    print(f"DTO [3.5/5] Summary saved to DB")
            except Exception as e:
                print(f"Error generating/saving summary: {e}")
                # Summary 실패해도 업로드는 성공 처리
            
        # ✨ 내용이 있는 경우에만 Vector DB 저장
        if documents:
            # 빈 문서 필터링
            documents = [doc for doc in documents if doc.page_content and doc.page_content.strip()]
            
            if documents:
                # 5. 메타데이터 주입
                for doc in documents:
                    doc.metadata["source"] = file.filename
                    doc.metadata["folder_id"] = folder_id
                    doc.metadata["type"] = "pdf" if file.filename.endswith(".pdf") else "text"
                    doc.metadata["document_id"] = new_file_id 

                # 6. 벡터 스토어(Supabase pgvector)에 저장
                print(f"DTO [4/5] Adding to Vector Store (Supabase)...")
                add_documents_to_vector_store(
                    documents=documents,
                    collection_name=collection_name
                )
                print(f"DTO [4/5] Vector Store add complete")
        
        print("DTO [5/5] All steps complete. Returning response.")
        return JSONResponse(
            status_code=200,
            content={
                "message": "File processed and saved successfully",
                "filename": file.filename,
                "document_ids": [new_file_id],
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