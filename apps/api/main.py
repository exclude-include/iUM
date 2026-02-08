# 1. 가장 먼저 환경 변수 로드 (순서 중요!)
import os
os.environ["USE_TF"] = "0"  # Disable TensorFlow in transformers
os.environ["TRANSFORMERS_VERBOSITY"] = "error"  # Suppress warnings
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# 2. 환경 변수가 로드된 후에 라우터 import
from routers import feed, workspace, agent, ingest, integrations, reels, evaluate, comments, reel_interactions, users
from utils.opik_config import opik_service
import os


# Lifecycle management for Opik
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Opik
    opik_service.initialize()
    yield
    # Shutdown: Cleanup Opik
    opik_service.shutdown()


app = FastAPI(
    title="iUM API",
    description="Backend API for iUM learning platform",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
# Allow all origins in production, or specific origins in development
# Set ALLOWED_ORIGINS environment variable to "*" for all origins, or comma-separated list for specific origins
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_env == "*":
    # Allow all origins (for production flexibility)
    allow_origins = ["*"]
else:
    # Use specific origins from environment variable
    allow_origins = [origin.strip() for origin in allowed_origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins if allow_origins != ["*"] else ["*"],
    allow_credentials=False if allow_origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(feed.router, prefix="/api/feed", tags=["feed"])
app.include_router(workspace.router, prefix="/api/workspace", tags=["workspace"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(reels.router, prefix="/api/reels", tags=["reels"])
app.include_router(evaluate.router, prefix="/api/evaluate", tags=["evaluation"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(reel_interactions.router, prefix="/api/reel-interactions", tags=["reel-interactions"])
app.include_router(users.router, prefix="/api/users", tags=["users"])


@app.get("/")
async def root():
    # API 키 설정 상태 확인용 (보안상 앞 3글자만 노출하거나 확인 메시지만 출력)
    api_key_status = "Set" if os.getenv("GOOGLE_API_KEY") else "Missing"
    return {
        "message": "iUM API is running",
        "google_api_key": api_key_status
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}