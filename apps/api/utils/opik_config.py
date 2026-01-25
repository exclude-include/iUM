"""
Opik configuration and setup for tracing LangChain operations.

This module provides:
1. `track` decorator - for tracing any Python function
2. `get_opik_tracer()` - for LangChain callback integration
3. `opik_configured` - flag to check if Opik is available
"""
import os
import functools
from typing import Optional, List

# Initialize Opik with API key from environment
OPIK_API_KEY = os.getenv("OPIK_API_KEY")

# Flag to track if Opik is properly configured
opik_configured = False

# Try to configure Opik
try:
    import opik
    if OPIK_API_KEY:
        opik.configure(api_key=OPIK_API_KEY)
        opik_configured = True
        print("[Opik] OK - Configured successfully with API key")
    else:
        print("[Opik] WARNING - OPIK_API_KEY not set - tracing disabled")
except ImportError:
    print("[Opik] WARNING - opik package not installed - tracing disabled")
except Exception as e:
    print(f"[Opik] ERROR - Configuration error: {e}")


def track(name: Optional[str] = None, tags: Optional[List[str]] = None):
    """
    Decorator for tracing functions with Opik.
    
    Usage:
        @track(name="my_function", tags=["rag", "tutor"])
        def my_function():
            pass
            
        # Or without arguments:
        @track()
        def my_function():
            pass
    
    If Opik is not configured, returns the function unchanged.
    """
    def decorator(func):
        if opik_configured:
            try:
                # Use Opik's official track decorator
                tracked_func = opik.track(name=name or func.__name__)(func)
                return tracked_func
            except Exception as e:
                print(f"[Opik] Warning: Could not apply tracking to {func.__name__}: {e}")
                return func
        else:
            # No Opik, return function as-is
            return func
    return decorator


def get_opik_tracer(tags: Optional[List[str]] = None):
    """
    Get an OpikTracer instance for LangChain callback integration.
    
    Usage:
        tracer = get_opik_tracer(tags=["rag", "tutor"])
        chain.invoke(question, config={"callbacks": [tracer]})
    
    Returns:
        OpikTracer instance if Opik is configured, None otherwise
    """
    if not opik_configured:
        return None
    
    try:
        from opik.integrations.langchain import OpikTracer
        return OpikTracer(tags=tags or ["ium-tutor"])
    except ImportError:
        print("[Opik] Warning: opik.integrations.langchain not available")
        return None
    except Exception as e:
        print(f"[Opik] Warning: Could not create OpikTracer: {e}")
        return None


# Legacy compatibility: keep the old 'trace' name as an alias
def trace(func):
    """
    Legacy decorator for backward compatibility.
    Use @track() for new code.
    """
    return track()(func)


# Export for backward compatibility
class OpikWrapper:
    """Wrapper class for Opik compatibility (legacy)"""
    @staticmethod
    def trace(func):
        return trace(func)
    
    @staticmethod
    def track(*args, **kwargs):
        return track(*args, **kwargs)
    
    @staticmethod
    def get_tracer(tags=None):
        return get_opik_tracer(tags)

opik_wrapper = OpikWrapper()
