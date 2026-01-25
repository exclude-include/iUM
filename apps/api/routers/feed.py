from fastapi import APIRouter, Query
from typing import List, Optional
from models import LearningUnit, FeedResponse

router = APIRouter()


@router.get("", response_model=FeedResponse)
async def get_feed(
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    category: Optional[str] = None
):
    """
    Fetches the "Soft" mode short-form content feed.
    
    - **limit**: Number of items to return (1-50)
    - **offset**: Pagination offset
    - **category**: Optional category filter (e.g., "quiz", "reel", "discussion")
    """
    # TODO: Implement actual database query
    # For now, return mock data structure
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

