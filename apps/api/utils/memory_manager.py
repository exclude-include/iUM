"""
Memory Manager for iUM Agent
Phase 1: Working Memory (Conversation Buffer Window)
Phase 2: Episodic Memory (Supabase Persistent Storage)
Phase 3: Semantic Memory (Long-term User Profiles)

Provides context from recent messages to enable multi-turn conversations,
persists conversation history to Supabase, and personalizes responses
based on user learning profiles.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import json
import logging
import os

# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class ChatMessage:
    """Represents a single chat message."""
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    sources: Optional[List[Dict[str, Any]]] = None
    id: Optional[str] = None  # Database ID (for persisted messages)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "sources": self.sources,
            "id": self.id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatMessage":
        return cls(
            role=data.get("role", "user"),
            content=data.get("content", ""),
            timestamp=data.get("timestamp") or data.get("created_at") or datetime.now().isoformat(),
            sources=data.get("sources"),
            id=data.get("id")
        )


class WorkingMemory:
    """
    Phase 1: Working Memory
    
    Maintains a sliding window of the most recent K messages.
    This enables multi-turn conversation context without excessive token usage.
    """
    
    def __init__(self, k: int = 10):
        """
        Initialize working memory with window size k.
        
        Args:
            k: Number of recent messages to keep (default: 10)
        """
        self.k = k
        self._messages: List[ChatMessage] = []
    
    def add_message(self, message: ChatMessage) -> None:
        """Add a message to the buffer, maintaining window size."""
        self._messages.append(message)
        
        # Keep only the most recent k messages
        if len(self._messages) > self.k:
            self._messages = self._messages[-self.k:]
    
    def add_user_message(self, content: str) -> ChatMessage:
        """Convenience method to add a user message."""
        msg = ChatMessage(role="user", content=content)
        self.add_message(msg)
        return msg
    
    def add_assistant_message(self, content: str, sources: Optional[List[Dict]] = None) -> ChatMessage:
        """Convenience method to add an assistant message."""
        msg = ChatMessage(role="assistant", content=content, sources=sources)
        self.add_message(msg)
        return msg
    
    def get_messages(self) -> List[ChatMessage]:
        """Get all messages in the buffer."""
        return self._messages.copy()
    
    def set_messages(self, messages: List[ChatMessage]) -> None:
        """Set messages (used when loading from Supabase)."""
        self._messages = messages[-self.k:] if len(messages) > self.k else messages
    
    def get_context_string(self, include_current: bool = False) -> str:
        """
        Generate a formatted context string for LLM prompts.
        
        Args:
            include_current: If False, excludes the last user message 
                            (useful when the current question is added separately)
        
        Returns:
            Formatted conversation history string
        """
        messages = self._messages
        
        if not include_current and messages and messages[-1].role == "user":
            messages = messages[:-1]
        
        if not messages:
            return ""
        
        lines = ["## Previous Conversation"]
        for msg in messages:
            role_label = "User" if msg.role == "user" else "iUM Agent"
            # Truncate long messages for context efficiency
            content = msg.content
            if len(content) > 500:
                content = content[:500] + "..."
            lines.append(f"**{role_label}**: {content}")
        
        return "\n".join(lines)
    
    def get_last_n_messages(self, n: int) -> List[ChatMessage]:
        """Get the last n messages."""
        return self._messages[-n:] if n <= len(self._messages) else self._messages.copy()
    
    def clear(self) -> None:
        """Clear all messages from memory."""
        self._messages = []
    
    def to_json(self) -> str:
        """Serialize memory to JSON string."""
        return json.dumps([msg.to_dict() for msg in self._messages], ensure_ascii=False)
    
    def from_json(self, json_str: str) -> None:
        """Load memory from JSON string."""
        try:
            data = json.loads(json_str)
            self._messages = [ChatMessage.from_dict(msg) for msg in data]
        except json.JSONDecodeError:
            self._messages = []
    
    @property
    def message_count(self) -> int:
        """Get the number of messages in memory."""
        return len(self._messages)
    
    @property
    def is_empty(self) -> bool:
        """Check if memory is empty."""
        return len(self._messages) == 0


class EpisodicMemory:
    """
    Phase 2: Episodic Memory
    
    Persists conversation sessions and messages to Supabase.
    Enables conversation history to survive browser refreshes.
    
    Usage:
        episodic = EpisodicMemory(user_id="user-123", folder_id="folder-456")
        await episodic.load_or_create_session()
        await episodic.save_message(ChatMessage(role="user", content="Hello"))
    """
    
    def __init__(self, user_id: str, folder_id: str):
        """
        Initialize episodic memory for a user/folder combination.
        
        Args:
            user_id: User identifier
            folder_id: Folder identifier (scopes the conversation)
        """
        self.user_id = user_id
        self.folder_id = folder_id
        self.session_id: Optional[str] = None
        self._supabase = None
    
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
    
    async def load_or_create_session(self) -> Optional[str]:
        """
        Load the most recent session for this user/folder, or create a new one.
        
        Returns:
            Session ID if successful, None otherwise
        """
        supabase = self._get_supabase()
        if not supabase:
            logger.warning("Supabase not available, skipping session load")
            return None
        
        try:
            # Try to find an existing recent session (within last 24 hours)
            result = supabase.table("chat_sessions").select("*").eq(
                "user_id", self.user_id
            ).eq(
                "folder_id", self.folder_id
            ).order(
                "updated_at", desc=True
            ).limit(1).execute()
            
            if result.data and len(result.data) > 0:
                self.session_id = result.data[0]["id"]
                logger.info(f"Loaded existing session: {self.session_id}")
                return self.session_id
            
            # Create a new session
            return await self.create_session()
            
        except Exception as e:
            logger.error(f"Error loading session: {e}")
            return None
    
    async def create_session(self) -> Optional[str]:
        """
        Create a new chat session.
        
        Returns:
            New session ID if successful, None otherwise
        """
        supabase = self._get_supabase()
        if not supabase:
            return None
        
        try:
            result = supabase.table("chat_sessions").insert({
                "user_id": self.user_id,
                "folder_id": self.folder_id,
                "metadata": {}
            }).execute()
            
            if result.data and len(result.data) > 0:
                self.session_id = result.data[0]["id"]
                logger.info(f"Created new session: {self.session_id}")
                return self.session_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return None
    
    async def load_messages(self, limit: int = 20) -> List[ChatMessage]:
        """
        Load messages from the current session.
        
        Args:
            limit: Maximum number of messages to load
            
        Returns:
            List of ChatMessage objects
        """
        if not self.session_id:
            return []
        
        supabase = self._get_supabase()
        if not supabase:
            return []
        
        try:
            result = supabase.table("chat_messages").select("*").eq(
                "session_id", self.session_id
            ).order(
                "created_at", desc=False
            ).limit(limit).execute()
            
            if result.data:
                messages = [ChatMessage.from_dict(msg) for msg in result.data]
                logger.info(f"Loaded {len(messages)} messages from session")
                return messages
            
            return []
            
        except Exception as e:
            logger.error(f"Error loading messages: {e}")
            return []
    
    async def save_message(self, message: ChatMessage) -> Optional[str]:
        """
        Save a message to the current session.
        
        Args:
            message: ChatMessage to save
            
        Returns:
            Message ID if successful, None otherwise
        """
        if not self.session_id:
            # Try to create a session first
            await self.load_or_create_session()
            if not self.session_id:
                logger.warning("No session available, cannot save message")
                return None
        
        supabase = self._get_supabase()
        if not supabase:
            return None
        
        try:
            result = supabase.table("chat_messages").insert({
                "session_id": self.session_id,
                "role": message.role,
                "content": message.content,
                "sources": message.sources
            }).execute()
            
            if result.data and len(result.data) > 0:
                message_id = result.data[0]["id"]
                logger.debug(f"Saved message: {message_id}")
                return message_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return None
    
    async def update_session_summary(self, summary: str) -> bool:
        """
        Update the session summary.
        
        Args:
            summary: Summary text
            
        Returns:
            True if successful, False otherwise
        """
        if not self.session_id:
            return False
        
        supabase = self._get_supabase()
        if not supabase:
            return False
        
        try:
            supabase.table("chat_sessions").update({
                "summary": summary
            }).eq("id", self.session_id).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating session summary: {e}")
            return False


class MemoryManager:
    """
    Unified Memory Manager for iUM Agent
    
    Phase 1: Working Memory - Recent N messages for multi-turn context
    Phase 2: Episodic Memory - Supabase persistent storage
    Phase 3: Semantic Memory - Long-term user profiles
    """
    
    # In-memory store for session memories (keyed by user_id:folder_id)
    _sessions: Dict[str, WorkingMemory] = {}
    _episodic: Dict[str, EpisodicMemory] = {}
    _semantic: Dict[str, Any] = {}  # SemanticMemory instances
    
    def __init__(
        self, 
        folder_id: Optional[str] = None,
        user_id: Optional[str] = None,
        window_size: int = 10
    ):
        """
        Initialize memory manager for a session.
        
        Args:
            folder_id: Folder ID to scope the memory (optional)
            user_id: User ID for personalization and persistence (optional)
            window_size: Number of recent messages to keep
        """
        self.folder_id = folder_id or "default"
        self.user_id = user_id or "anonymous"
        self.window_size = window_size
        self._session_loaded = False
        
        # Create a unique key for this user/folder combination
        self._session_key = f"{self.user_id}:{self.folder_id}"
        
        # Get or create working memory
        if self._session_key not in MemoryManager._sessions:
            MemoryManager._sessions[self._session_key] = WorkingMemory(k=window_size)
        self.working_memory = MemoryManager._sessions[self._session_key]
        
        # Get or create episodic memory (for Supabase persistence)
        if self._session_key not in MemoryManager._episodic:
            MemoryManager._episodic[self._session_key] = EpisodicMemory(
                user_id=self.user_id,
                folder_id=self.folder_id
            )
        self.episodic_memory = MemoryManager._episodic[self._session_key]
        
        # Get or create semantic memory (for user profiles - Phase 3)
        self.semantic_memory = None  # Lazy loaded to avoid import issues
    
    async def load_session(self) -> bool:
        """
        Load existing session from Supabase (Phase 2 + Phase 3).
        Call this when starting a chat to restore previous conversation
        and load user profile.
        
        Returns:
            True if session was loaded, False otherwise
        """
        if self._session_loaded:
            return True
        
        try:
            # Initialize Supabase session (Phase 2)
            session_id = await self.episodic_memory.load_or_create_session()
            
            if session_id:
                # Load previous messages
                messages = await self.episodic_memory.load_messages(limit=self.window_size)
                if messages:
                    self.working_memory.set_messages(messages)
                    logger.info(f"Restored {len(messages)} messages from Supabase")
            
            # Load user profile (Phase 3)
            await self._load_semantic_memory()
            
            self._session_loaded = True
            return bool(session_id)
            
        except Exception as e:
            logger.error(f"Error loading session: {e}")
            self._session_loaded = True  # Mark as loaded to prevent retry loops
            return False
    
    async def _load_semantic_memory(self) -> None:
        """Load semantic memory (user profile) - Phase 3."""
        try:
            from utils.semantic_memory import SemanticMemory
            
            if self._session_key not in MemoryManager._semantic:
                MemoryManager._semantic[self._session_key] = SemanticMemory(
                    user_id=self.user_id
                )
            
            self.semantic_memory = MemoryManager._semantic[self._session_key]
            await self.semantic_memory.load_profile()
            
        except Exception as e:
            logger.warning(f"Failed to load semantic memory: {e}")
            self.semantic_memory = None
    
    async def add_user_message_async(self, content: str) -> ChatMessage:
        """
        Add a user message to memory and persist to Supabase.
        
        Args:
            content: Message content
            
        Returns:
            ChatMessage object
        """
        msg = self.working_memory.add_user_message(content)
        
        # Persist to Supabase (non-blocking)
        try:
            await self.episodic_memory.save_message(msg)
        except Exception as e:
            logger.warning(f"Failed to persist user message: {e}")
        
        return msg
    
    async def add_assistant_message_async(
        self, 
        content: str, 
        sources: Optional[List[Dict]] = None
    ) -> ChatMessage:
        """
        Add an assistant message to memory and persist to Supabase.
        
        Args:
            content: Message content
            sources: Optional list of source references
            
        Returns:
            ChatMessage object
        """
        msg = self.working_memory.add_assistant_message(content, sources)
        
        # Persist to Supabase (non-blocking)
        try:
            await self.episodic_memory.save_message(msg)
        except Exception as e:
            logger.warning(f"Failed to persist assistant message: {e}")
        
        return msg
    
    def add_user_message(self, content: str) -> ChatMessage:
        """Add a user message to working memory (synchronous, no persistence)."""
        return self.working_memory.add_user_message(content)
    
    def add_assistant_message(self, content: str, sources: Optional[List[Dict]] = None) -> ChatMessage:
        """Add an assistant message to working memory (synchronous, no persistence)."""
        return self.working_memory.add_assistant_message(content, sources)
    
    def get_conversation_context(self) -> str:
        """
        Get the conversation context for RAG chain.
        This returns a formatted string of recent messages.
        """
        return self.working_memory.get_context_string(include_current=False)
    
    def get_full_context(self) -> str:
        """
        Get full context including user profile and conversation history.
        This combines semantic memory (profile) with working memory (messages).
        
        Returns:
            Combined context string for LLM prompts
        """
        parts = []
        
        # Add user profile context (Phase 3)
        if self.semantic_memory:
            profile_context = self.semantic_memory.get_context_string()
            if profile_context:
                parts.append(profile_context)
        
        # Add conversation history (Phase 1)
        conversation_context = self.working_memory.get_context_string(include_current=False)
        if conversation_context:
            parts.append("## Previous Conversation\n" + conversation_context)
        
        return "\n\n".join(parts) if parts else ""
    
    def get_user_profile(self) -> Optional[Any]:
        """Get the user profile if loaded."""
        if self.semantic_memory:
            return self.semantic_memory.profile
        return None
    
    def get_expertise_level(self) -> str:
        """Get user's expertise level for response customization."""
        if self.semantic_memory:
            return self.semantic_memory.get_expertise_level()
        return "beginner"
    
    def get_messages(self) -> List[ChatMessage]:
        """Get all messages in working memory."""
        return self.working_memory.get_messages()
    
    def clear_session(self) -> None:
        """Clear the current session's memory."""
        self.working_memory.clear()
    
    @classmethod
    def get_or_create(
        cls, 
        folder_id: Optional[str] = None, 
        user_id: Optional[str] = None
    ) -> "MemoryManager":
        """Factory method to get or create a memory manager."""
        return cls(folder_id=folder_id, user_id=user_id)
    
    @classmethod
    def clear_all_sessions(cls) -> None:
        """Clear all session memories (useful for testing)."""
        cls._sessions.clear()
        cls._episodic.clear()
        cls._semantic.clear()


# Singleton accessor for dependency injection
_default_manager: Optional[MemoryManager] = None


def get_memory_manager(
    folder_id: Optional[str] = None, 
    user_id: Optional[str] = None
) -> MemoryManager:
    """
    Get a memory manager instance.
    
    Usage in FastAPI:
        memory = get_memory_manager(folder_id=request.folder_id, user_id=request.user_id)
    """
    return MemoryManager.get_or_create(folder_id=folder_id, user_id=user_id)


async def get_memory_manager_async(
    folder_id: Optional[str] = None, 
    user_id: Optional[str] = None,
    load_session: bool = True
) -> MemoryManager:
    """
    Get a memory manager instance with session loading.
    
    This async version will load existing session data from Supabase.
    
    Usage in FastAPI:
        memory = await get_memory_manager_async(
            folder_id=request.folder_id, 
            user_id=request.user_id
        )
    """
    manager = MemoryManager.get_or_create(folder_id=folder_id, user_id=user_id)
    
    if load_session:
        await manager.load_session()
    
    return manager
