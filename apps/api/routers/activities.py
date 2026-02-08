"""
Activities Router - Learning activity tracking and statistics
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from utils.supabase_client import get_supabase_client, get_user_id_from_token

router = APIRouter()


class ActivityLog(BaseModel):
    event_type: str  # cell_created, quiz_submitted, chat_message, document_uploaded, session_start, session_end
    metadata: Optional[dict] = {}


class ActivityStatsResponse(BaseModel):
    total_activities: int
    cells_created: int
    quizzes_submitted: int
    chat_messages: int
    documents_uploaded: int
    quiz_average_score: Optional[float]
    study_time_today_minutes: int
    study_time_week_minutes: int
    cell_type_distribution: dict  # { "concept": 10, "quiz": 5, "math": 3, ... }
    daily_activity: List[dict]  # Last 7 days: [{ "date": "2026-02-09", "count": 15 }, ...]


class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_study_date: Optional[str]
    streak_history: List[str]  # List of dates with activity


@router.post("/log")
async def log_activity(
    activity: ActivityLog,
    authorization: str = Header(...)
):
    """
    Log a learning activity event.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()

    try:
        response = supabase.table("activities").insert({
            "user_id": user_id,
            "event_type": activity.event_type,
            "metadata": activity.metadata or {}
        }).execute()

        if response.data and len(response.data) > 0:
            return {"success": True, "activity_id": response.data[0]["id"]}
        
        raise HTTPException(status_code=500, detail="Failed to log activity")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error logging activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=ActivityStatsResponse)
async def get_activity_stats(
    authorization: str = Header(...)
):
    """
    Get aggregated activity statistics for the authenticated user.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()

    try:
        # Get all activities for this user
        response = supabase.table("activities").select("*").eq("user_id", user_id).execute()
        activities = response.data or []

        # Calculate time boundaries
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)

        # Initialize counters
        total_activities = len(activities)
        cells_created = 0
        quizzes_submitted = 0
        chat_messages = 0
        documents_uploaded = 0
        quiz_scores = []
        cell_types = {}
        daily_counts = {}

        # Calculate study time (estimate based on events)
        study_time_today = 0
        study_time_week = 0

        for activity in activities:
            event_type = activity.get("event_type", "")
            metadata = activity.get("metadata", {}) or {}
            created_at_str = activity.get("created_at", "")

            # Parse timestamp
            try:
                # Handle ISO format with timezone
                created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00").replace("+00:00", ""))
            except:
                continue

            # Count by event type
            if event_type == "cell_created":
                cells_created += 1
                cell_type = metadata.get("cell_type", "unknown")
                cell_types[cell_type] = cell_types.get(cell_type, 0) + 1
            elif event_type == "quiz_submitted":
                quizzes_submitted += 1
                score = metadata.get("quiz_score")
                if score is not None:
                    quiz_scores.append(score)
            elif event_type == "chat_message":
                chat_messages += 1
            elif event_type == "document_uploaded":
                documents_uploaded += 1

            # Estimate study time (each activity ≈ 2 minutes)
            activity_minutes = metadata.get("duration_seconds", 120) / 60
            if created_at >= today_start:
                study_time_today += activity_minutes
            if created_at >= week_start:
                study_time_week += activity_minutes

            # Daily activity for last 7 days
            date_key = created_at.strftime("%Y-%m-%d")
            if created_at >= week_start:
                daily_counts[date_key] = daily_counts.get(date_key, 0) + 1

        # Calculate quiz average
        quiz_average = sum(quiz_scores) / len(quiz_scores) if quiz_scores else None

        # Format daily activity
        daily_activity = []
        for i in range(7):
            day = (today_start - timedelta(days=i))
            date_str = day.strftime("%Y-%m-%d")
            daily_activity.append({
                "date": date_str,
                "count": daily_counts.get(date_str, 0)
            })
        daily_activity.reverse()

        return ActivityStatsResponse(
            total_activities=total_activities,
            cells_created=cells_created,
            quizzes_submitted=quizzes_submitted,
            chat_messages=chat_messages,
            documents_uploaded=documents_uploaded,
            quiz_average_score=quiz_average,
            study_time_today_minutes=int(study_time_today),
            study_time_week_minutes=int(study_time_week),
            cell_type_distribution=cell_types,
            daily_activity=daily_activity
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching activity stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/streak", response_model=StreakResponse)
async def get_streak(
    authorization: str = Header(...)
):
    """
    Get streak information for the authenticated user.
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()

    try:
        # Get activities ordered by date, limited to recent 90 days
        ninety_days_ago = (datetime.utcnow() - timedelta(days=90)).isoformat()
        response = supabase.table("activities")\
            .select("created_at")\
            .eq("user_id", user_id)\
            .gte("created_at", ninety_days_ago)\
            .order("created_at", desc=True)\
            .execute()
        
        activities = response.data or []

        if not activities:
            return StreakResponse(
                current_streak=0,
                longest_streak=0,
                last_study_date=None,
                streak_history=[]
            )

        # Extract unique dates with activity
        activity_dates = set()
        for activity in activities:
            try:
                created_at = datetime.fromisoformat(
                    activity["created_at"].replace("Z", "+00:00").replace("+00:00", "")
                )
                activity_dates.add(created_at.strftime("%Y-%m-%d"))
            except:
                continue

        sorted_dates = sorted(activity_dates, reverse=True)
        
        if not sorted_dates:
            return StreakResponse(
                current_streak=0,
                longest_streak=0,
                last_study_date=None,
                streak_history=[]
            )

        last_study_date = sorted_dates[0]

        # Calculate current streak
        today = datetime.utcnow().strftime("%Y-%m-%d")
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        current_streak = 0
        # Start counting if there's activity today or yesterday
        if last_study_date == today or last_study_date == yesterday:
            check_date = datetime.strptime(last_study_date, "%Y-%m-%d")
            while check_date.strftime("%Y-%m-%d") in activity_dates:
                current_streak += 1
                check_date -= timedelta(days=1)

        # Calculate longest streak
        longest_streak = 0
        temp_streak = 0
        prev_date = None
        
        for date_str in sorted(activity_dates):
            current_date = datetime.strptime(date_str, "%Y-%m-%d")
            if prev_date is None:
                temp_streak = 1
            elif (current_date - prev_date).days == 1:
                temp_streak += 1
            else:
                temp_streak = 1
            
            longest_streak = max(longest_streak, temp_streak)
            prev_date = current_date

        return StreakResponse(
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_study_date=last_study_date,
            streak_history=sorted_dates[:30]  # Last 30 days with activity
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching streak: {e}")
        raise HTTPException(status_code=500, detail=str(e))
