"""
Opik configuration and setup for tracing LangChain operations
"""
import os
import functools

# Initialize Opik with API key from environment
OPIK_API_KEY = os.getenv("OPIK_API_KEY")

# Opik tracing decorator
def trace(func):
    """
    Decorator for tracing functions with Opik.
    If Opik is not configured, returns the function unchanged.
    """
    if OPIK_API_KEY:
        try:
            from opik import Opik
            opik_client = Opik(api_key=OPIK_API_KEY)
            # Opik typically uses context managers or callbacks
            # For now, we'll use a simple wrapper that preserves function metadata
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                # In a real implementation, you'd set up Opik tracing here
                # For now, just call the function
                return func(*args, **kwargs)
            return wrapper
        except ImportError:
            # Opik not installed, return function as-is
            return func
    else:
        # No API key, return function as-is
        return func

# Export trace decorator and a mock Opik object for compatibility
class OpikWrapper:
    """Wrapper class for Opik compatibility"""
    @staticmethod
    def trace(func):
        return trace(func)

opik = OpikWrapper()
