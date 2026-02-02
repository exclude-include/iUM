"""
Semantic Memory for iUM Agent
Phase 3: Long-term user profile management

Tracks user learning preferences, interests, and expertise level
to provide personalized learning experiences.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class TopicCount:
    """Represents a topic with its occurrence count."""
    topic: str
    count: int = 1
    last_seen: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "topic": self.topic,
            "count": self.count,
            "last_seen": self.last_seen
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TopicCount":
        return cls(
            topic=data.get("topic", ""),
            count=data.get("count", 1),
            last_seen=data.get("last_seen", datetime.now().isoformat())
        )


@dataclass
class UserProfile:
    """Represents a user's learning profile."""
    user_id: str
    learning_style: str = "textual"  # visual | textual | interactive
    expertise_level: str = "beginner"  # beginner | intermediate | advanced
    preferred_language: str = "ko"
    interests: List[str] = field(default_factory=list)
    frequent_topics: List[TopicCount] = field(default_factory=list)
    preferences: Dict[str, Any] = field(default_factory=dict)
    total_sessions: int = 0
    total_messages: int = 0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "learning_style": self.learning_style,
            "expertise_level": self.expertise_level,
            "preferred_language": self.preferred_language,
            "interests": self.interests,
            "frequent_topics": [t.to_dict() for t in self.frequent_topics],
            "preferences": self.preferences,
            "total_sessions": self.total_sessions,
            "total_messages": self.total_messages
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UserProfile":
        frequent_topics = []
        if data.get("frequent_topics"):
            frequent_topics = [TopicCount.from_dict(t) for t in data["frequent_topics"]]
        
        return cls(
            user_id=data.get("user_id", ""),
            learning_style=data.get("learning_style", "textual"),
            expertise_level=data.get("expertise_level", "beginner"),
            preferred_language=data.get("preferred_language", "ko"),
            interests=data.get("interests", []),
            frequent_topics=frequent_topics,
            preferences=data.get("preferences", {}),
            total_sessions=data.get("total_sessions", 0),
            total_messages=data.get("total_messages", 0),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat())
        )
    
    def get_context_string(self) -> str:
        """Generate a context string for LLM prompts."""
        if not self.user_id or self.user_id == "anonymous":
            return ""
        
        lines = ["## User Profile"]
        
        # Expertise level affects response complexity
        level_desc = {
            "beginner": "초보자 - 기본 개념부터 쉽게 설명",
            "intermediate": "중급자 - 적절한 깊이로 설명",
            "advanced": "고급자 - 심화 내용 포함 가능"
        }
        lines.append(f"- **전문성 수준**: {level_desc.get(self.expertise_level, self.expertise_level)}")
        
        # Learning style affects presentation
        style_desc = {
            "visual": "시각적 학습 선호 - 다이어그램, 도표 활용",
            "textual": "텍스트 학습 선호 - 상세한 설명 제공",
            "interactive": "상호작용 선호 - 퀴즈, 예제 포함"
        }
        lines.append(f"- **학습 스타일**: {style_desc.get(self.learning_style, self.learning_style)}")
        
        # Interests for relevance
        if self.interests:
            lines.append(f"- **관심 분야**: {', '.join(self.interests[:5])}")
        
        # Recent topics
        if self.frequent_topics:
            top_topics = sorted(self.frequent_topics, key=lambda x: x.count, reverse=True)[:3]
            topics_str = ", ".join([f"{t.topic}({t.count}회)" for t in top_topics])
            lines.append(f"- **자주 묻는 주제**: {topics_str}")
        
        return "\n".join(lines)


class SemanticMemory:
    """
    Phase 3: Semantic Memory
    
    Manages long-term user profiles stored in Supabase.
    Provides personalized context for LLM prompts.
    
    Usage:
        semantic = SemanticMemory(user_id="user-123")
        await semantic.load_profile()
        context = semantic.get_context_string()
    """
    
    def __init__(self, user_id: str):
        """
        Initialize semantic memory for a user.
        
        Args:
            user_id: User identifier
        """
        self.user_id = user_id
        self.profile: Optional[UserProfile] = None
        self._supabase = None
        self._loaded = False
    
    def _get_supabase(self):
        """Lazy load Supabase client to avoid circular imports."""
        if self._supabase is None:
            try:
                from utils.supabase_client import get_supabase_client
                self._supabase = get_supabase_client()
            except Exception as e:
                logger.warning(f"Failed to initialize Supabase client: {e}")
                self._supabase = None
        return self._supabase
    
    async def load_profile(self) -> Optional[UserProfile]:
        """
        Load user profile from Supabase.
        Creates a new profile if none exists.
        
        Returns:
            UserProfile if successful, None otherwise
        """
        if self._loaded and self.profile:
            return self.profile
        
        if not self.user_id or self.user_id == "anonymous":
            self._loaded = True
            return None
        
        supabase = self._get_supabase()
        if not supabase:
            self._loaded = True
            return None
        
        try:
            # Try to find existing profile
            result = supabase.table("user_profiles").select("*").eq(
                "user_id", self.user_id
            ).limit(1).execute()
            
            if result.data and len(result.data) > 0:
                self.profile = UserProfile.from_dict(result.data[0])
                logger.info(f"Loaded profile for user: {self.user_id}")
            else:
                # Create new profile
                self.profile = await self._create_profile()
            
            self._loaded = True
            return self.profile
            
        except Exception as e:
            logger.error(f"Error loading profile: {e}")
            self._loaded = True
            return None
    
    async def _create_profile(self) -> Optional[UserProfile]:
        """
        Create a new user profile.
        
        Returns:
            New UserProfile if successful, None otherwise
        """
        supabase = self._get_supabase()
        if not supabase:
            return None
        
        try:
            new_profile = UserProfile(user_id=self.user_id)
            
            result = supabase.table("user_profiles").insert({
                "user_id": self.user_id,
                "learning_style": new_profile.learning_style,
                "expertise_level": new_profile.expertise_level,
                "preferred_language": new_profile.preferred_language,
                "interests": new_profile.interests,
                "frequent_topics": [],
                "preferences": new_profile.preferences,
                "total_sessions": 0,
                "total_messages": 0
            }).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Created new profile for user: {self.user_id}")
                return UserProfile.from_dict(result.data[0])
            
            return new_profile
            
        except Exception as e:
            logger.error(f"Error creating profile: {e}")
            return UserProfile(user_id=self.user_id)
    
    async def update_profile(self, updates: Dict[str, Any]) -> bool:
        """
        Update specific profile fields.
        
        Args:
            updates: Dictionary of fields to update
            
        Returns:
            True if successful, False otherwise
        """
        if not self.user_id or self.user_id == "anonymous":
            return False
        
        supabase = self._get_supabase()
        if not supabase:
            return False
        
        try:
            supabase.table("user_profiles").update(updates).eq(
                "user_id", self.user_id
            ).execute()
            
            # Update local profile
            if self.profile:
                for key, value in updates.items():
                    if hasattr(self.profile, key):
                        setattr(self.profile, key, value)
            
            logger.debug(f"Updated profile for user: {self.user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating profile: {e}")
            return False
    
    async def increment_stats(self, sessions: int = 0, messages: int = 0) -> bool:
        """
        Increment session/message counters.
        
        Args:
            sessions: Number of sessions to add
            messages: Number of messages to add
            
        Returns:
            True if successful
        """
        if not self.profile:
            await self.load_profile()
        
        if not self.profile:
            return False
        
        new_sessions = self.profile.total_sessions + sessions
        new_messages = self.profile.total_messages + messages
        
        return await self.update_profile({
            "total_sessions": new_sessions,
            "total_messages": new_messages
        })
    
    async def add_interest(self, interest: str) -> bool:
        """
        Add an interest to the user's profile.
        
        Args:
            interest: Interest to add
            
        Returns:
            True if successful
        """
        if not self.profile:
            await self.load_profile()
        
        if not self.profile:
            return False
        
        if interest not in self.profile.interests:
            self.profile.interests.append(interest)
            return await self.update_profile({
                "interests": self.profile.interests
            })
        
        return True
    
    async def add_topic(self, topic: str) -> bool:
        """
        Add or increment a topic in frequent_topics.
        
        Args:
            topic: Topic to add/increment
            
        Returns:
            True if successful
        """
        if not self.profile:
            await self.load_profile()
        
        if not self.profile:
            return False
        
        # Find existing topic
        existing = None
        for t in self.profile.frequent_topics:
            if t.topic.lower() == topic.lower():
                existing = t
                break
        
        if existing:
            existing.count += 1
            existing.last_seen = datetime.now().isoformat()
        else:
            self.profile.frequent_topics.append(TopicCount(topic=topic))
        
        return await self.update_profile({
            "frequent_topics": [t.to_dict() for t in self.profile.frequent_topics]
        })
    
    def get_context_string(self) -> str:
        """
        Get profile context string for LLM prompts.
        
        Returns:
            Formatted profile context or empty string
        """
        if self.profile:
            return self.profile.get_context_string()
        return ""
    
    def get_expertise_level(self) -> str:
        """Get user's expertise level."""
        if self.profile:
            return self.profile.expertise_level
        return "beginner"
    
    def get_learning_style(self) -> str:
        """Get user's learning style."""
        if self.profile:
            return self.profile.learning_style
        return "textual"


# Factory function
async def get_semantic_memory(user_id: str, load: bool = True) -> SemanticMemory:
    """
    Get a SemanticMemory instance for a user.
    
    Args:
        user_id: User identifier
        load: Whether to load the profile immediately
        
    Returns:
        SemanticMemory instance
    """
    memory = SemanticMemory(user_id=user_id)
    if load:
        await memory.load_profile()
    return memory
