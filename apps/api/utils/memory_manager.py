"""
Memory Manager for iUM Agent
Implements a 3-layer hybrid memory architecture:
1. Working Memory: Short-term context (recent N messages)
2. Episodic Memory: Session-based permanent storage (Supabase)
3. Semantic Memory: User profile and long-term knowledge (Planned)
"""

import logging
from typing import List, Dict, Optional, Any
from uuid import uuid4
from datetime import datetime
from utils.supabase_client import get_supabase_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EpisodicMemory:
    """
    Layer 2: Episodic Memory
    Manages permanent storage of chat sessions and messages in Supabase.
    """
    def __init__(self):
        self.supabase = get_supabase_client()

    async def create_session(self, user_id: str, folder_id: Optional[str] = None, title: Optional[str] = None) -> str:
        """Create a new chat session."""
        try:
            data = {
                "user_id": user_id,
                "folder_id": folder_id,
                "title": title or "New Conversation",
                "metadata": {}
            }
            response = self.supabase.table("chat_sessions").insert(data).execute()
            if response.data:
                return response.data[0]["id"]
            raise Exception("Failed to create session")
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return str(uuid4()) # Fallback to local UUID if DB fails

    async def add_message(self, session_id: str, role: str, content: str, metadata: Optional[Dict] = None) -> bool:
        """Add a message to the session history."""
        try:
            data = {
                "session_id": session_id,
                "role": role,
                "content": content,
                "metadata": metadata or {}
            }
            self.supabase.table("chat_messages").insert(data).execute()
            return True
        except Exception as e:
            logger.error(f"Error adding message: {e}")
            return False

    async def get_messages(self, session_id: str, limit: int = 10) -> List[Dict]:
        """Get recent messages from a session."""
        try:
            response = self.supabase.table("chat_messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("created_at", desc=True)\
                .limit(limit)\
                .execute()
            
            # Return in chronological order (oldest first)
            return sorted(response.data, key=lambda x: x["created_at"]) if response.data else []
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            return []

    async def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session details."""
        try:
            response = self.supabase.table("chat_sessions").select("*").eq("id", session_id).single().execute()
            return response.data
        except Exception as e:
            logger.error(f"Error getting session: {e}")
            return None


class WorkingMemory:
    """
    Layer 1: Working Memory
    Manages immediate context for the LLM.
    Currently backed by EpisodicMemory (Supabase) to ensure persistence across requests.
    """
    def __init__(self, episodic_memory: EpisodicMemory, k: int = 10):
        self.episodic = episodic_memory
        self.k = k

    async def get_context(self, session_id: str) -> str:
        """Get recent conversation history formatted for LLM context."""
        messages = await self.episodic.get_messages(session_id, limit=self.k)
        
        if not messages:
            return ""

        context_str = ""
        for msg in messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            context_str += f"{role}: {msg['content']}\n"
        
        return context_str


class SemanticMemory:
    """
    Layer 3: Semantic Memory (Placeholder)
    Will manage long-term user profile and knowledge.
    """
    def __init__(self, user_id: str):
        self.user_id = user_id

    async def get_relevant_info(self, query: str) -> str:
        # TODO: Implement vector search for user profile
        return ""


class MemoryManager:
    """
    Main Interface for Memory System
    Orchestrates Working, Episodic, and Semantic memory layers.
    """
    def __init__(self):
        self.episodic = EpisodicMemory()
        self.working = WorkingMemory(self.episodic, k=10)
    
    async def create_session(self, user_id: str, folder_id: Optional[str] = None) -> str:
        return await self.episodic.create_session(user_id, folder_id)

    async def add_user_message(self, session_id: str, content: str):
        await self.episodic.add_message(session_id, "user", content)

    async def add_assistant_message(self, session_id: str, content: str, metadata: Optional[Dict] = None):
        await self.episodic.add_message(session_id, "assistant", content, metadata)

    async def get_context(self, session_id: str) -> str:
        """Get combined context from all memory layers."""
        # 1. Get working memory context (recent history)
        working_context = await self.working.get_context(session_id)
        
        # 2. Get semantic memory context (TODO)
        # semantic_context = await self.semantic.get_relevant_info(...)
        
        return working_context


# Singleton instance
memory_manager = MemoryManager()


def get_memory_manager() -> MemoryManager:
    """Dependency injection helper"""
    return memory_manager
