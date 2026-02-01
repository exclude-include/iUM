"""
Opik configuration and setup for tracing LangChain operations.
Provides a singleton OpikService for dependency injection.
"""
import os
import functools
import asyncio
from typing import Optional, Callable, Any, List, Dict


class OpikService:
    """
    Singleton service for managing Opik client.
    Initializes Opik client on app startup and provides it for dependency injection.
    """
    _instance: Optional["OpikService"] = None
    _client = None
    _initialized: bool = False

    def __new__(cls) -> "OpikService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self) -> None:
        """
        Initialize Opik client with environment variables.
        Should be called once at app startup.
        """
        if self._initialized:
            return

        api_key = os.getenv("OPIK_API_KEY")
        workspace = os.getenv("OPIK_WORKSPACE")
        project_name = os.getenv("OPIK_PROJECT_NAME", "iUM")

        if not api_key:
            print("[OpikService] OPIK_API_KEY not set. Opik tracing disabled.")
            self._initialized = True
            return

        try:
            from opik import Opik
            self._client = Opik(
                api_key=api_key,
                workspace=workspace,
                project_name=project_name,
            )
            self._initialized = True
            print(f"[OpikService] Initialized successfully. Project: {project_name}")
        except ImportError:
            print("[OpikService] opik package not installed. Tracing disabled.")
            self._initialized = True
        except Exception as e:
            print(f"[OpikService] Failed to initialize: {e}")
            self._initialized = True

    @property
    def client(self):
        """Get the Opik client instance."""
        if not self._initialized:
            self.initialize()
        return self._client

    @property
    def is_enabled(self) -> bool:
        """Check if Opik tracing is enabled."""
        return self._client is not None

    def shutdown(self) -> None:
        """Cleanup on app shutdown."""
        if self._client is not None:
            try:
                self._client.flush()
            except Exception:
                pass
            self._client = None
        self._initialized = False
        print("[OpikService] Shutdown complete.")


# Global singleton instance
opik_service = OpikService()


def get_opik_service() -> OpikService:
    """
    Dependency injection function for FastAPI.
    Usage: opik = Depends(get_opik_service)
    """
    return opik_service


def get_opik_client():
    """
    Get the raw Opik client for direct usage.
    Returns None if Opik is not configured.
    """
    return opik_service.client


# Opik track decorator - supports both sync and async functions
def track(
    name: Optional[str] = None,
    type: str = "general",
    tags: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    capture_input: bool = True,
    capture_output: bool = True,
):
    """
    Decorator for tracing functions with Opik.
    Works with both sync and async functions.
    If Opik is not configured, returns the function unchanged.

    Args:
        name: Custom name for the trace (defaults to function name)
        type: Trace type - 'general', 'tool', 'llm', or 'guardrail'
        tags: Optional list of tags for categorization
        metadata: Optional metadata dict to attach to trace
        capture_input: Whether to capture function inputs
        capture_output: Whether to capture function outputs
    """
    def decorator(func: Callable) -> Callable:
        # Check if Opik is available at decoration time
        try:
            from opik import track as opik_track
        except ImportError:
            return func

        # Check if API key is set
        if not os.getenv("OPIK_API_KEY"):
            return func

        # Apply Opik's track decorator
        trace_name = name or func.__name__
        tracked_func = opik_track(
            name=trace_name,
            type=type,
            tags=tags,
            metadata=metadata,
            capture_input=capture_input,
            capture_output=capture_output,
        )(func)

        return tracked_func

    return decorator


# Legacy trace decorator for backward compatibility
def trace(func):
    """
    Legacy decorator for tracing functions with Opik.
    Works with the existing @trace syntax in rag_chain.py.
    Use @track() instead for more options.
    """
    if os.getenv("OPIK_API_KEY"):
        try:
            from opik import track as opik_track
            return opik_track(name=func.__name__)(func)
        except ImportError:
            return func
    return func


# Legacy support: OpikWrapper for backward compatibility
class OpikWrapper:
    """Wrapper class for Opik compatibility (legacy)"""
    @staticmethod
    def trace(func):
        return trace(func)

opik = OpikWrapper()
