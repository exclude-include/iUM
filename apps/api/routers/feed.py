from fastapi import APIRouter, Query, Depends, HTTPException
from typing import List, Optional
from models import LearningUnit, FeedResponse
from utils.supabase_client import get_supabase
from supabase import Client
from db.services import ReelService
from db.models import ReelCreate

router = APIRouter()


def get_reel_service(db: Client = Depends(get_supabase)) -> ReelService:
    return ReelService(db)


@router.get("", response_model=FeedResponse)
async def get_feed(
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    category: Optional[str] = None,
    reel_service: ReelService = Depends(get_reel_service)
):
    """
    Fetches the "Soft" mode short-form content feed from Supabase.
    
    - **limit**: Number of items to return (1-50)
    - **offset**: Pagination offset
    - **category**: Optional category filter
    """
    try:
        # Get reels from database
        reels = reel_service.get_all(limit=limit, offset=offset, category=category)
        total = reel_service.count()
        
        # Convert to LearningUnit format
        learning_units = [
            LearningUnit(
                id=reel.id or "",
                title=reel.title,
                description=reel.description or "",
                type="reel",
                author=reel.author or "Unknown",
                tags=reel.tags or [],
                content_url=reel.content_url,
                thumbnail_url=reel.thumbnail_url,
                duration_seconds=reel.duration_seconds,
                quiz_content=reel.quiz_content,
                created_at=reel.created_at.isoformat() if reel.created_at else None
            )
            for reel in reels
        ]
        
        return FeedResponse(
            items=learning_units,
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + limit < total
        )
    except Exception as e:
        # Fallback to mock data if database fails
        print(f"Error fetching reels from database: {e}")
        mock_units = [
            LearningUnit(
                id="1",
                title="Epsilon-Delta Identity",
                description="Understanding the fundamental identity: εᵢⱼₖεₘₙₖ = δᵢₘδⱼₙ - δᵢₙδⱼₘ",
                type="reel",
                author="Math Tutor",
                tags=["Linear Algebra", "Tensor Calculus"],
                content_url="https://example.com/video1.mp4",
                thumbnail_url="https://example.com/thumb1.jpg",
                duration_seconds=120,
                quiz_content={
                    "title": "Epsilon-Delta Identity",
                    "explanation": "In the simplest terms, εᵢⱼₖεₘₙₖ is called the Epsilon-Delta Identity. Here is the 'short and sweet' version:\n\n1. What is it?\nName: The Epsilon-Delta Identity\nPurpose: It is a shortcut used to turn Cross Products(ε) into Dot Products(δ)."
                }
            ),
            LearningUnit(
                id="2",
                title="Vector Product Properties",
                description="Exploring further properties of the vector product",
                type="reel",
                author="Physics Prof",
                tags=["Vector Calculus", "Physics"],
                content_url="https://example.com/video2.mp4",
                thumbnail_url="https://example.com/thumb2.jpg",
                duration_seconds=90,
                quiz_content={
                    "title": "Vector Product Properties",
                    "explanation": "The vector product has several important properties including anticommutativity and distributivity over addition."
                }
            ),
        ]
        
        # Apply category filter if provided
        if category:
            mock_units = [unit for unit in mock_units if category.lower() in [t.lower() for t in unit.tags]]
        
        # Apply pagination
        paginated_units = mock_units[offset:offset + limit]
        
        return FeedResponse(
            items=paginated_units,
            total=len(mock_units),
            limit=limit,
            offset=offset,
            has_more=offset + limit < len(mock_units)
        )


@router.post("/reels", response_model=LearningUnit)
async def create_reel(
    reel: ReelCreate,
    reel_service: ReelService = Depends(get_reel_service)
):
    """Create a new reel"""
    try:
        created_reel = reel_service.create(reel)
        return LearningUnit(
            id=created_reel.id or "",
            title=created_reel.title,
            description=created_reel.description or "",
            type="reel",
            author=created_reel.author or "Unknown",
            tags=created_reel.tags or [],
            content_url=created_reel.content_url,
            thumbnail_url=created_reel.thumbnail_url,
            duration_seconds=created_reel.duration_seconds,
            quiz_content=created_reel.quiz_content
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating reel: {str(e)}")

