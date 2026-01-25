# 1. 가장 먼저 환경 변수 로드 (순서 중요!)
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 2. 환경 변수가 로드된 후에 라우터 import
from routers import feed, workspace, agent, ingest, accounts, google_drive
import os

app = FastAPI(
    title="iUM API",
    description="Backend API for iUM learning platform",
    version="0.1.0"
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
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(feed.router, prefix="/api/feed", tags=["feed"])
app.include_router(workspace.router, prefix="/api/workspace", tags=["workspace"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(google_drive.router, prefix="/api/google-drive", tags=["google-drive"])


@app.get("/")
async def root():
    # API 키 설정 상태 확인용
    gemini_key = os.getenv("GOOGLE_GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    drive_key = os.getenv("GOOGLE_DRIVE_API_KEY") or os.getenv("GOOGLE_API_KEY")
    supabase_status = "Set" if (os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY")) else "Missing"
    
    return {
        "message": "iUM API is running",
        "google_gemini_api_key": "Set" if gemini_key else "Missing",
        "google_drive_api_key": "Set" if drive_key else "Missing",
        "supabase": supabase_status,
        "version": "0.1.0"
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}