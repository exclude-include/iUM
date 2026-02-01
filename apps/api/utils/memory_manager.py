"""
Memory Manager for iUM Agent
Phase 1: Working Memory (Conversation Buffer Window)

Provides context from recent messages to enable multi-turn conversations.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import json


@dataclass
class ChatMessage:
    """Represents a single chat message."""
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    sources: Optional[List[Dict[str, Any]]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "sources": self.sources
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatMessage":
        return cls(
            role=data.get("role", "user"),
            content=data.get("content", ""),
            timestamp=data.get("timestamp", datetime.now().isoformat()),
            sources=data.get("sources")
        )


class WorkingMemory:
    """
    Phase 1: Working Memory
    
    Maintains a sliding window of the most recent K messages.
    This enables multi-turn conversation context without excessive token usage.
    
    Usage:
        memory = WorkingMemory(k=10)
        memory.add_message(ChatMessage(role="user", content="What is RAG?"))
        memory.add_message(ChatMessage(role="assistant", content="RAG stands for..."))
        context = memory.get_context_string()
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


class MemoryManager:
    """
    Unified Memory Manager for iUM Agent (Phase 1)
    
    Currently implements:
    - Working Memory: Recent N messages for multi-turn context
    
    Future phases will add:
    - Episodic Memory: Session summaries (Supabase)
    - Semantic Memory: Long-term user profiles
    """
    
    # In-memory store for session memories (keyed by folder_id)
    _sessions: Dict[str, WorkingMemory] = {}
    
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
            user_id: User ID for future personalization (optional)
            window_size: Number of recent messages to keep
        """
        self.folder_id = folder_id or "default"
        self.user_id = user_id
        self.window_size = window_size
        
        # Get or create working memory for this folder
        if self.folder_id not in MemoryManager._sessions:
            MemoryManager._sessions[self.folder_id] = WorkingMemory(k=window_size)
        
        self.working_memory = MemoryManager._sessions[self.folder_id]
    
    def add_user_message(self, content: str) -> ChatMessage:
        """Add a user message to memory."""
        return self.working_memory.add_user_message(content)
    
    def add_assistant_message(self, content: str, sources: Optional[List[Dict]] = None) -> ChatMessage:
        """Add an assistant message to memory."""
        return self.working_memory.add_assistant_message(content, sources)
    
    def get_conversation_context(self) -> str:
        """
        Get the conversation context for RAG chain.
        This returns a formatted string of recent messages.
        """
        return self.working_memory.get_context_string(include_current=False)
    
    def get_messages(self) -> List[ChatMessage]:
        """Get all messages in working memory."""
        return self.working_memory.get_messages()
    
    def clear_session(self) -> None:
        """Clear the current session's memory."""
        self.working_memory.clear()
    
    @classmethod
    def get_or_create(cls, folder_id: Optional[str] = None, user_id: Optional[str] = None) -> "MemoryManager":
        """Factory method to get or create a memory manager."""
        return cls(folder_id=folder_id, user_id=user_id)
    
    @classmethod
    def clear_all_sessions(cls) -> None:
        """Clear all session memories (useful for testing)."""
        cls._sessions.clear()


# Singleton accessor for dependency injection
_default_manager: Optional[MemoryManager] = None


def get_memory_manager(folder_id: Optional[str] = None, user_id: Optional[str] = None) -> MemoryManager:
    """
    Get a memory manager instance.
    
    Usage in FastAPI:
        memory = get_memory_manager(folder_id=request.folder_id)
    """
    return MemoryManager.get_or_create(folder_id=folder_id, user_id=user_id)
