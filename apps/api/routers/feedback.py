"""
Feedback API router for logging user feedback scores to Opik traces.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os

router = APIRouter()


class FeedbackRequest(BaseModel):
    """Request model for submitting feedback."""
    trace_id: str = Field(..., alias="traceId", description="The Opik trace ID to log feedback for")
    score: int = Field(..., ge=0, le=1, description="Feedback score: 1 for positive (thumbs up), 0 for negative (thumbs down)")
    reason: Optional[str] = Field(None, description="Optional reason for the feedback")

    class Config:
        populate_by_name = True


class FeedbackResponse(BaseModel):
    """Response model for feedback submission."""
    success: bool
    message: str
    trace_id: str


@router.post("", response_model=FeedbackResponse)
async def log_feedback(request: FeedbackRequest):
    """
    Log user feedback for a specific trace.

    - **traceId**: The Opik trace ID to associate feedback with
    - **score**: 1 for positive feedback (thumbs up), 0 for negative (thumbs down)
    - **reason**: Optional explanation for the feedback
    """
    # Check if Opik is configured
    if not os.getenv("OPIK_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Please set OPIK_API_KEY environment variable."
        )

    try:
        import opik

        # Initialize Opik client
        client = opik.Opik(
            api_key=os.getenv("OPIK_API_KEY"),
            workspace=os.getenv("OPIK_WORKSPACE"),
            project_name=os.getenv("OPIK_PROJECT_NAME", "iUM"),
        )

        # Log feedback score to the trace
        # Convert binary score to descriptive category
        category_name = "positive" if request.score == 1 else "negative"

        client.log_traces_feedback_scores(
            scores=[
                {
                    "id": request.trace_id,
                    "name": "user_feedback",
                    "value": float(request.score),
                    "category_name": category_name,
                    "reason": request.reason,
                }
            ]
        )

        # Flush to ensure the feedback is sent
        client.flush()

        return FeedbackResponse(
            success=True,
            message=f"Feedback logged successfully: {category_name}",
            trace_id=request.trace_id
        )

    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Opik package is not installed."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to log feedback: {str(e)}"
        )
