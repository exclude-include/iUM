# 1. 가장 먼저 환경 변수 로드 (순서 중요!)
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 2. 환경 변수가 로드된 후에 라우터 import
from routers import feed, workspace, agent, ingest, integrations, reels
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
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(reels.router, prefix="/api/reels", tags=["reels"])


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