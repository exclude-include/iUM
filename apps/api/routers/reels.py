"""
Reels Upload Router
Handles video upload and management for the reels feature
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
import uuid
import os
import re
import json
import requests
from datetime import datetime, timezone
import numpy as np
from pathlib import Path

from models.reels import (
    Reel,
    ReelUploadResponse,
    ReelListResponse,
    ReelRecommendResponse,
    ReelWithSimilarity,
    ReelCreateWithQuiz,
    Quiz,
    QuizOption,
)
from utils.supabase_client import get_supabase_client, get_storage_client
from utils.vector_store import get_vector_store, embeddings

router = APIRouter()


class GenerateFromCellRequest(BaseModel):
    """Request to create a reel from a notebook cell (auto hashtags + quiz from content)"""
    user_id: str
    cell_content: str = Field(..., min_length=1)
    cell_title: Optional[str] = None
    quiz_data: Optional[List[dict]] = Field(None, description="Optional existing quiz from cell (frontend QuizQuestion[])")


# Request model for Drive import
class DriveImportRequest(BaseModel):
    drive_url: str
    user_id: str
    title: str
    description: Optional[str] = None
    folder_name: Optional[str] = None
    tags: Optional[list[str]] = None


def _cell_quiz_to_reel_quiz(quiz_data: List[dict]) -> Optional[Quiz]:
    """Convert frontend QuizQuestion (first one) to API Quiz model."""
    if not quiz_data or len(quiz_data) == 0:
        return None
    q = quiz_data[0]
    question_text = q.get("question_text") or q.get("question") or ""
    options_raw = q.get("options") or []
    if not question_text or not options_raw:
        return None
    # options: [{ id, text, is_correct }] -> [{ key, text }], answer = id of is_correct
    options = []
    answer_key = None
    for i, opt in enumerate(options_raw):
        key = opt.get("id") or opt.get("key") or chr(65 + i)
        text = opt.get("text") or ""
        options.append(QuizOption(key=str(key), text=text))
        if opt.get("is_correct"):
            answer_key = str(key)
    if not answer_key and options:
        answer_key = options[0].key
    explanation = q.get("explanation")
    return Quiz(question=question_text, options=options, answer=answer_key or "A", explanation=explanation)


async def _generate_tags_and_quiz_from_content(cell_content: str, cell_title: Optional[str]) -> tuple[List[str], Optional[Quiz]]:
    """Use LLM to generate hashtags and one quiz from cell content. Returns (tags, quiz)."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return (["study", "learning"], None)

    llm = ChatGoogleGenerativeAI(
        model=os.getenv("LLM_MODEL", "models/gemini-2.5-flash"),
        temperature=0.3,
        google_api_key=api_key,
    )

    title_part = f"Title: {cell_title}\n\n" if cell_title else ""
    prompt = f"""You are helping create a short study reel from this notebook cell content.

{title_part}Content (excerpt):
{cell_content[:4000]}

Tasks:
1. Output 3-5 hashtags that describe the topic (without #, comma-separated, e.g. chemistry,organic,reaction).
2. Create exactly ONE multiple-choice quiz question based on this content. Output valid JSON only, in this exact shape:
{{"question": "...", "options": [{{"key": "A", "text": "..."}}, {{"key": "B", "text": "..."}}, ...], "answer": "A", "explanation": "..."}}
Use 2-4 options. "answer" must be one of the option keys (A, B, C, D).

Reply in this exact format (no other text):
HASHTAGS: tag1, tag2, tag3
QUIZ: {{"question": "...", "options": [...], "answer": "A", "explanation": "..."}}
"""

    try:
        response = await llm.ainvoke(prompt)
        text = (response.content or "").strip()
        tags = ["study", "learning"]
        quiz = None

        if "HASHTAGS:" in text:
            tag_line = text.split("HASHTAGS:")[1].split("QUIZ:")[0].strip() if "QUIZ:" in text else text.split("HASHTAGS:")[1].strip()
            tags = [t.strip().strip("#") for t in tag_line.split(",") if t.strip()][:6]
        if "QUIZ:" in text:
            try:
                json_str = text.split("QUIZ:")[1].strip()
                json_str = json_str.strip()
                if json_str.startswith("```"):
                    json_str = re.sub(r"^```\w*\n?", "", json_str).strip()
                    json_str = re.sub(r"\n?```$", "", json_str).strip()
                obj = json.loads(json_str)
                q = obj.get("question") or ""
                opts = obj.get("options") or []
                ans = obj.get("answer") or "A"
                exp = obj.get("explanation")
                if q and opts:
                    options = [QuizOption(key=o.get("key", chr(65 + i)), text=o.get("text", "")) for i, o in enumerate(opts)]
                    quiz = Quiz(question=q, options=options, answer=str(ans), explanation=exp)
            except (json.JSONDecodeError, KeyError) as e:
                print(f"Reel generate-from-cell quiz parse error: {e}")
        return (tags, quiz)
    except Exception as e:
        print(f"Reel generate-from-cell LLM error: {e}")
        return (["study", "learning"], None)


# Supabase storage bucket name
REELS_BUCKET = "reels"

# Supported video MIME types
SUPPORTED_VIDEO_TYPES = [
    "video/mp4",
    "video/quicktime",  # .mov
    "video/x-msvideo",  # .avi
    "video/webm",
]

# Max file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024


@router.post("/upload", response_model=ReelUploadResponse)
async def upload_reel(
    file: UploadFile = File(..., description="Video file to upload"),
    user_id: str = Form(..., description="User ID uploading the reel"),
    title: str = Form(..., description="Title of the reel"),
    description: Optional[str] = Form(None, description="Description of the reel"),
):
    """
    Upload a video reel to Supabase Storage
    
    Args:
        file: Video file to upload
        user_id: User ID uploading the video
        title: Title of the reel
        description: Optional description
        
    Returns:
        ReelUploadResponse: Upload result with reel metadata
        
    Raises:
        HTTPException: If upload fails or file is invalid
    """
    try:
        # Validate file type
        if file.content_type not in SUPPORTED_VIDEO_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Supported types: {', '.join(SUPPORTED_VIDEO_TYPES)}"
            )
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Validate file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024 * 1024)}MB"
            )
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix if file.filename else ".mp4"
        unique_filename = f"{user_id}/{uuid.uuid4()}{file_extension}"
        
        # Upload to Supabase Storage
        supabase = get_supabase_client()
        storage = get_storage_client()
        
        # Ensure bucket exists (create if not)
        try:
            buckets = storage.list_buckets()
            bucket_exists = any(bucket.name == REELS_BUCKET for bucket in buckets)
            
            if not bucket_exists:
                storage.create_bucket(
                    REELS_BUCKET,
                    options={"public": True}
                )
        except Exception as bucket_error:
            print(f"Bucket check/creation warning: {bucket_error}")
            # Continue anyway - bucket might already exist
        
        # Upload file to storage
        upload_result = storage.from_(REELS_BUCKET).upload(
            path=unique_filename,
            file=file_content,
            file_options={
                "content-type": file.content_type,
                "cache-control": "3600",
            }
        )
        
        # Get public URL for the uploaded file
        public_url = storage.from_(REELS_BUCKET).get_public_url(unique_filename)
        
        # Insert reel metadata into database
        reel_data = {
            "user_id": user_id,
            "title": title,
            "description": description,
            "video_url": public_url,
            "duration": None,  # TODO: Extract video duration
            "views": 0,
            "likes": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        
        result = supabase.table("reels").insert(reel_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save reel metadata")
        
        reel = Reel(**result.data[0])
        
        return ReelUploadResponse(
            success=True,
            message="Reel uploaded successfully",
            reel=reel
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload reel: {str(e)}")


@router.get("/list", response_model=ReelListResponse)
async def list_reels(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    limit: int = Query(20, ge=1, le=100, description="Number of reels to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    List reels with optional filtering and pagination
    
    Args:
        user_id: Optional user ID to filter by
        limit: Number of reels to return
        offset: Offset for pagination
        
    Returns:
        ReelListResponse: List of reels with pagination info
    """
    try:
        supabase = get_supabase_client()
        
        # Build query
        query = supabase.table("reels").select("*", count="exact")
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        # Order by creation date (newest first) and apply pagination
        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        reels = [Reel(**reel_data) for reel_data in result.data]
        total = result.count if result.count is not None else len(reels)
        
        return ReelListResponse(
            reels=reels,
            total=total,
            offset=offset,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reels: {str(e)}")


@router.get("/{reel_id}", response_model=Reel)
async def get_reel(reel_id: str):
    """
    Get a specific reel by ID
    
    Args:
        reel_id: Reel ID to fetch
        
    Returns:
        Reel: Reel metadata
    """
    try:
        supabase = get_supabase_client()
        result = supabase.table("reels").select("*").eq("id", reel_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        return Reel(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reel: {str(e)}")


@router.delete("/{reel_id}")
async def delete_reel(
    reel_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
):
    """
    Delete a reel (only by owner)
    
    Args:
        reel_id: Reel ID to delete
        user_id: User ID for authorization
        
    Returns:
        Success message
    """
    try:
        supabase = get_supabase_client()
        
        # Get reel to verify ownership
        reel_result = supabase.table("reels").select("*").eq("id", reel_id).execute()
        
        if not reel_result.data:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        reel = reel_result.data[0]
        
        # Verify ownership
        if reel["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this reel")
        
        # Extract file path from video URL
        video_url = reel["video_url"]
        # Parse the storage path from URL (this depends on your Supabase setup)
        # Example: https://your-project.supabase.co/storage/v1/object/public/reels/user_id/file.mp4
        path_parts = video_url.split(f"/{REELS_BUCKET}/")
        if len(path_parts) > 1:
            file_path = path_parts[1]
            
            # Delete from storage
            storage = get_storage_client()
            try:
                storage.from_(REELS_BUCKET).remove([file_path])
            except Exception as storage_error:
                print(f"Storage deletion warning: {storage_error}")
                # Continue with database deletion even if storage deletion fails
        
        # Delete from database
        supabase.table("reels").delete().eq("id", reel_id).execute()
        
        return {"success": True, "message": "Reel deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete reel: {str(e)}")


def extract_drive_file_id(url: str) -> str:
    """
    Extract Google Drive file ID from various URL formats
    Supports:
    - https://drive.google.com/file/d/FILE_ID/view
    - https://drive.google.com/open?id=FILE_ID
    - https://drive.google.com/uc?id=FILE_ID
    """
    patterns = [
        r'/file/d/([a-zA-Z0-9_-]+)',
        r'[?&]id=([a-zA-Z0-9_-]+)',
        r'/folders/([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise ValueError("Could not extract file ID from Google Drive URL")


@router.post("/import-from-drive", response_model=ReelUploadResponse)
async def import_reel_from_drive(request: DriveImportRequest):
    """
    Import a video from Google Drive shared URL
    
    The URL must be a publicly shared Google Drive link.
    Supported formats:
    - https://drive.google.com/file/d/FILE_ID/view
    - https://drive.google.com/open?id=FILE_ID
    
    Args:
        request: DriveImportRequest with URL, user_id, title, etc.
        
    Returns:
        ReelUploadResponse: Upload result with reel metadata
    """
    try:
        # Extract file ID from URL
        file_id = extract_drive_file_id(request.drive_url)
        
        # Google Drive direct download URL for public files
        download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
        
        # Download file from Google Drive
        response = requests.get(download_url, stream=True, allow_redirects=True)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Failed to download file from Google Drive. Make sure the file is publicly shared."
            )
        
        # Get content type and file content
        content_type = response.headers.get('Content-Type', 'video/mp4')
        file_content = response.content
        file_size = len(file_content)
        
        # Validate file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024 * 1024)}MB"
            )
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Downloaded file is empty")
        
        # Determine file extension
        if 'video/mp4' in content_type:
            file_ext = '.mp4'
        elif 'video/quicktime' in content_type:
            file_ext = '.mov'
        elif 'video/webm' in content_type:
            file_ext = '.webm'
        else:
            file_ext = '.mp4'  # Default to mp4
        
        # Generate unique filename
        unique_filename = f"{request.user_id}/{uuid.uuid4()}{file_ext}"
        
        # Upload to Supabase Storage
        supabase = get_supabase_client()
        storage = get_storage_client()
        
        # Ensure bucket exists
        try:
            buckets = storage.list_buckets()
            bucket_exists = any(bucket.name == REELS_BUCKET for bucket in buckets)
            if not bucket_exists:
                storage.create_bucket(REELS_BUCKET, options={"public": True})
        except Exception as bucket_error:
            print(f"Bucket check/creation warning: {bucket_error}")
        
        # Upload file to storage
        storage.from_(REELS_BUCKET).upload(
            path=unique_filename,
            file=file_content,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
            }
        )
        
        # Get public URL
        public_url = storage.from_(REELS_BUCKET).get_public_url(unique_filename)
        
        # Insert reel metadata into database
        reel_data = {
            "user_id": request.user_id,
            "title": request.title,
            "description": request.description,
            "video_url": public_url,
            "folder_name": request.folder_name,
            "tags": request.tags or [],
            "views": 0,
            "likes": 0,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        result = supabase.table("reels").insert(reel_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save reel metadata")
        
        reel = Reel(**result.data[0])
        
        return ReelUploadResponse(
            success=True,
            message="Reel imported from Google Drive successfully",
            reel=reel
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import from Google Drive: {str(e)}")

def generate_quiz_text(quiz: Quiz) -> str:
    """
    Generate searchable text from quiz data for embedding.
    Combines question and all option texts.
    """
    parts = [quiz.question]
    for opt in quiz.options:
        parts.append(f"{opt.key}. {opt.text}")
    return " ".join(parts)


@router.post("/generate-from-cell", response_model=ReelUploadResponse)
async def generate_reel_from_cell(request: GenerateFromCellRequest):
    """
    Create a reel from a notebook cell: auto-generate hashtags and quiz from cell content,
    then create a video-less reel and add it to the reels feed (Soft mode).
    """
    try:
        from utils.video_generator import choose_random_pastel

        supabase = get_supabase_client()
        # Reel title kept short for feed display (e.g. 50 chars)
        title = (request.cell_title or "From notebook").strip()[:50]
        description = (request.cell_content or "").strip()[:500]

        # 1. Quiz: use existing cell quiz if provided, else generate from content (one LLM call for tags + quiz)
        tags, quiz = await _generate_tags_and_quiz_from_content(request.cell_content, request.cell_title)
        if not tags:
            tags = ["study", "learning"]
        if request.quiz_data and len(request.quiz_data) > 0:
            cell_quiz = _cell_quiz_to_reel_quiz(request.quiz_data)
            if cell_quiz:
                quiz = cell_quiz
        # Show quiz after 3 seconds in the reel
        if quiz:
            quiz = quiz.model_copy(update={"timestamp_seconds": 3.0})

        # 3. Create reel (same logic as create-with-quiz, no video)
        color = choose_random_pastel()
        insert_data = {
            "user_id": request.user_id,
            "title": title,
            "description": description or None,
            "video_url": None,
            "thumbnail_url": None,
            "duration": None,
            "tags": tags,
            "folder_name": None,
            "folder_id": None,
            "color": color,
            "views": 0,
            "likes": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if quiz:
            insert_data["quiz"] = quiz.model_dump()
            quiz_text = generate_quiz_text(quiz)
            insert_data["quiz_embedding"] = embeddings.embed_query(quiz_text)

        result = supabase.table("reels").insert(insert_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create reel")

        reel = Reel(**result.data[0])
        return ReelUploadResponse(
            success=True,
            message="Reel created from cell (hashtags and quiz generated).",
            reel=reel,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create reel from cell: {str(e)}")


@router.post("/create-with-quiz", response_model=ReelUploadResponse)
async def create_reel_with_quiz(reel_data: ReelCreateWithQuiz):
    """
    Create a reel with quiz data and generate quiz embedding.

    This endpoint:
    1. Creates the reel record
    2. If quiz is provided, generates embedding from quiz text
    3. Stores embedding in pgvector column
    4. If no video_url provided, generates pastel background color

    Args:
        reel_data: Reel data including optional quiz and optional video_url

    Returns:
        ReelUploadResponse: Created reel with quiz
    """
    try:
        from utils.video_generator import choose_random_pastel
        
        supabase = get_supabase_client()

        # Generate pastel color if no video URL provided
        color = reel_data.color
        if not reel_data.video_url and not color:
            color = choose_random_pastel()

        # Prepare reel data for insertion
        insert_data = {
            "user_id": reel_data.user_id,
            "title": reel_data.title,
            "description": reel_data.description,
            "video_url": reel_data.video_url,
            "thumbnail_url": reel_data.thumbnail_url,
            "duration": reel_data.duration,
            "tags": reel_data.tags,
            "folder_name": reel_data.folder_name,
            "folder_id": reel_data.folder_id,
            "color": color,  # Add color field
            "views": 0,
            "likes": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Add quiz data if provided
        if reel_data.quiz:
            insert_data["quiz"] = reel_data.quiz.model_dump()

            # Generate embedding from quiz text
            quiz_text = generate_quiz_text(reel_data.quiz)
            quiz_embedding = embeddings.embed_query(quiz_text)
            insert_data["quiz_embedding"] = quiz_embedding

        # Insert into database
        result = supabase.table("reels").insert(insert_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create reel")

        reel = Reel(**result.data[0])

        return ReelUploadResponse(
            success=True,
            message="Reel created successfully" + (" with quiz" if reel_data.quiz else "") + (" (video-less)" if not reel_data.video_url else ""),
            reel=reel
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create reel: {str(e)}"
        )


@router.patch("/{reel_id}/quiz", response_model=ReelUploadResponse)
async def update_reel_quiz(
    reel_id: str,
    quiz: Quiz,
    user_id: str = Query(..., description="User ID for authorization"),
):
    """
    Add or update quiz for an existing reel.
    Generates new embedding for the quiz text.

    Args:
        reel_id: Reel ID to update
        quiz: Quiz data to add/update
        user_id: User ID for authorization

    Returns:
        ReelUploadResponse: Updated reel
    """
    try:
        supabase = get_supabase_client()

        # Verify reel exists and user owns it
        existing = supabase.table("reels").select("*").eq("id", reel_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Reel not found")

        if existing.data[0]["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Generate embedding from quiz text
        quiz_text = generate_quiz_text(quiz)
        quiz_embedding = embeddings.embed_query(quiz_text)

        # Update reel with quiz and embedding
        update_data = {
            "quiz": quiz.model_dump(),
            "quiz_embedding": quiz_embedding,
        }

        result = supabase.table("reels").update(update_data).eq("id", reel_id).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update quiz")

        reel = Reel(**result.data[0])

        return ReelUploadResponse(
            success=True,
            message="Quiz updated successfully",
            reel=reel
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update quiz: {str(e)}"
        )


@router.get("/recommend", response_model=ReelRecommendResponse)
async def recommend_reel(
    user_id: str = Query(..., description="User ID requesting recommendation"),
    folder_ids: str = Query(..., description="Comma-separated list of active folder IDs"),
    limit: int = Query(1, ge=1, le=10, description="Number of reels to recommend"),
):
    """
    Recommend a reel based on user's active folders.

    The algorithm:
    1. Get document embeddings from active folders (Supabase pgvector)
    2. Calculate centroid (average) of document embeddings
    3. Find most similar reel using pgvector cosine similarity

    Args:
        user_id: User ID for context
        folder_ids: Comma-separated folder IDs (e.g., "folder-1,folder-2")
        limit: Number of reels to return

    Returns:
        ReelRecommendResponse: Recommended reel with similarity score
    """
    try:
        # Parse folder IDs from comma-separated string
        folder_id_list = [fid.strip() for fid in folder_ids.split(",") if fid.strip()]

        if not folder_id_list:
            return ReelRecommendResponse(
                success=False,
                message="No active folders provided"
            )

        # Step 1: Get document embeddings from Supabase for active folders
        vector_store = get_vector_store("user_knowledge")
        collection = vector_store._collection

        # Build filter for multiple folders
        if len(folder_id_list) == 1:
            where_filter = {"folder_id": folder_id_list[0]}
        else:
            where_filter = {"folder_id": {"$in": folder_id_list}}

        # Get embeddings from Supabase
        results = collection.get(
            where=where_filter,
            include=["embeddings"]
        )

        if not results["embeddings"] or len(results["embeddings"]) == 0:
            return ReelRecommendResponse(
                success=False,
                message="No documents found in the active folders"
            )

        # Step 2: Calculate centroid (average) of document embeddings
        doc_embeddings = np.array(results["embeddings"])
        centroid = doc_embeddings.mean(axis=0).tolist()

        # Step 3: Query Supabase pgvector for similar reels
        supabase = get_supabase_client()

        # Call the RPC function for vector similarity search
        reel_result = supabase.rpc(
            "match_reels_by_embedding",
            {
                "query_embedding": centroid,
                "match_count": limit,
                "similarity_threshold": 0.0
            }
        ).execute()

        if not reel_result.data or len(reel_result.data) == 0:
            return ReelRecommendResponse(
                success=False,
                message="No matching reels found"
            )

        # Step 4: Return the most similar reel
        reel_data = reel_result.data[0]
        reel = ReelWithSimilarity(**reel_data)

        return ReelRecommendResponse(
            success=True,
            reel=reel
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to recommend reel: {str(e)}"
        )

@router.post("/backfill-embeddings")
async def backfill_embeddings(force: bool = Query(False, description="Force update even if embedding exists")):
    """
    Backfill quiz embeddings for existing reels.
    Iterates over all reels with quizzes and generates embeddings if missing.
    """
    try:
        supabase = get_supabase_client()
        
        # Fetch all reels with a quiz
        # Note: 'not_.is_' might need specific syntax depending on client version, 
        # but eq("quiz", "null") inverse logic is tricky.
        # Alternatively, fetch all and filter in python.
        result = supabase.table("reels").select("*").not_.is_("quiz", "null").execute()
        
        if not result.data:
            return {"message": "No reels with quizzes found.", "updated": 0}
            
        count = 0
        updated = 0
        errors = []
        
        for reel in result.data:
            count += 1
            
            # Skip if embedding exists and not forcing update
            if reel.get("quiz_embedding") and not force:
                continue
                
            try:
                # Parse quiz data
                quiz_data = reel["quiz"]
                if not quiz_data:
                    continue
                    
                # Convert to Quiz model
                quiz_obj = Quiz(**quiz_data)
                
                # Generate text and embedding
                quiz_text = generate_quiz_text(quiz_obj)
                embedding = embeddings.embed_query(quiz_text)
                
                # Update reel
                supabase.table("reels").update({
                    "quiz_embedding": embedding
                }).eq("id", reel["id"]).execute()
                
                updated += 1
            except Exception as e:
                error_msg = f"Failed to update reel {reel.get('id')}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
                
        return {
            "total_checked": count, 
            "updated": updated, 
            "errors": errors
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Backfill failed: {str(e)}"
        )
