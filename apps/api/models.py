from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from datetime import datetime


# Learning Unit Types (For Feeds/Reels)
class LearningUnit(BaseModel):
    """Represents a learning unit that can be displayed as a Reel or Document"""
    id: str
    title: str
    description: str
    type: Literal["reel", "document", "quiz", "discussion"]
    author: str
    tags: List[str] = []
    content_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    quiz_content: Optional[Dict[str, str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class FeedResponse(BaseModel):
    """Response model for the feed endpoint"""
    items: List[LearningUnit]
    total: int
    limit: int
    offset: int
    has_more: bool


# Workspace Types
class Document(BaseModel):
    """Represents a document in the workspace"""
    id: str
    title: str
    content_type: Literal["text", "pdf", "markdown"]
    content: Optional[str] = None
    file_url: Optional[str] = None
    sections: Optional[List[Dict[str, str]]] = None
    equations: Optional[List[str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class Tab(BaseModel):
    """Represents a tab within a folder"""
    id: str
    name: str
    document: Optional[Document] = None


class Folder(BaseModel):
    """Represents a folder containing tabs"""
    id: str
    name: str
    icon: Optional[str] = None  # e.g., "crown", "folder", etc.
    tabs: List[Tab] = []


class HistoryItem(BaseModel):
    """Represents a history item"""
    id: str
    title: str
    timestamp: str
    type: Literal["timeline", "study", "quiz", "document"]
    metadata: Optional[Dict[str, str]] = None


class Workspace(BaseModel):
    """Represents a workspace in Hard-Basic View"""
    id: str
    name: str
    folders: List[Folder] = []
    history: List[HistoryItem] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# User Progress Types
class Mission(BaseModel):
    """Represents a learning mission"""
    id: str
    title: str
    description: str
    type: Literal["streak", "quiz", "study", "community"]
    target: int  # Target value (e.g., days for streak, points for quiz)
    current: int = 0
    completed: bool = False
    reward: Optional[str] = None


class UserProgress(BaseModel):
    """Tracks user progress including streaks and mission completion"""
    user_id: str
    current_streak: int = 0
    longest_streak: int = 0
    total_learning_days: int = 0
    last_activity: Optional[str] = None
    missions: List[Mission] = []
    total_points: int = 0
    level: int = 1


# Chat/Agent Types
class Source(BaseModel):
    """Represents a source document used in RAG responses"""
    id: str
    title: str
    content: str
    relevance_score: Optional[float] = None


# Quiz Models for Interactive Learning Units
class QuizOption(BaseModel):
    """Represents a single option in a quiz question"""
    id: str = Field(..., description="Option identifier, e.g., 'A', 'B', 'C', 'D'")
    text: str = Field(..., description="The option text/content")
    is_correct: bool = Field(..., description="Whether this option is the correct answer")


class QuizQuestion(BaseModel):
    """Represents a single quiz question with multiple choice options"""
    id: str = Field(..., description="Unique identifier for the question")
    question_text: str = Field(..., description="The question text")
    options: List[QuizOption] = Field(..., description="List of answer options")
    explanation: str = Field(..., description="Explanation for why the correct answer is correct")


# ✨✨ [새로 추가된 클래스] Flashcard 모델 ✨✨
class FlashcardItem(BaseModel):
    """Represents a single flashcard"""
    front: str
    back: str


# ✨✨ [수정됨] 이름 충돌 방지를 위해 이름을 변경했습니다 (LearningUnit -> LearningUnitResponse) ✨✨
class LearningUnitResponse(BaseModel):
    """Represents a structured learning unit that can be displayed in the workspace"""
    title: str
    type: Literal["concept", "math", "code", "summary", "quiz", "flashcard"] = Field(..., description="Type of learning unit")
    
    # ✨ 여기에 content 필드가 확실하게 존재합니다!
    content: str = Field(..., description="Markdown content for the learning unit")
    
    equations: Optional[List[str]] = Field(None, description="LaTeX equation strings for mathematical concepts")
    diagram_description: Optional[str] = Field(None, description="Description for generating diagrams (deprecated - use graph_data)")
    quiz_data: Optional[List[QuizQuestion]] = Field(None, description="Structured quiz questions (required when type is 'quiz')")
    flashcard_data: Optional[List[FlashcardItem]] = Field(None, description="Structured flashcards (required when type is 'flashcard')")
    graph_data: Optional[Dict] = Field(None, description="ReactFlow graph data")


class ChatMessage(BaseModel):
    """Represents a chat message"""
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: str
    sources: Optional[List[Source]] = None


class ChatResponse(BaseModel):
    """Response from the AI agent"""
    message: str
    conversation_id: str
    sources: Optional[List[Source]] = None
    reasoning_chain: Optional[List[str]] = None
    confidence_score: Optional[float] = None
    
    # ✨✨ [새로 추가된 클래스] Flashcard 모델 ✨✨
    flashcards: Optional[List[FlashcardItem]] = None # Added this line to ChatResponse
    
    # ✨✨ [수정됨] 위에서 정의한 LearningUnitResponse를 사용하도록 변경 ✨✨
    learning_unit: Optional[LearningUnitResponse] = None