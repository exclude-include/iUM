# Supabase 연동 완료

FastAPI 백엔드가 Supabase와 성공적으로 연동되었습니다.

## 🎯 구현된 기능

### 1. **계정 시스템 (Accounts)**
- 계정 생성, 조회, 수정, 삭제
- 이메일 기반 계정 검색
- 엔드포인트: `/api/accounts`

### 2. **파일 & 히스토리 저장**
- 파일 업로드 시 Supabase에 메타데이터 저장
- 학습 히스토리를 **JSON 형식**으로 저장
- 폴더별 히스토리 필터링
- 엔드포인트: `/api/workspace/{id}/history`

### 3. **Google Drive 연동**
- OAuth 토큰 저장 및 관리
- Drive 파일 동기화
- Drive 파일 메타데이터 저장
- 엔드포인트: `/api/google-drive/*`

### 4. **Reels (숏폼 콘텐츠)**
- Reels 생성 및 조회
- 카테고리별 필터링
- 태그 기반 검색
- 엔드포인트: `/api/feed`

## 📁 생성된 파일들

### 데이터베이스 레이어
- `db/models.py` - Pydantic 모델 (Supabase 스키마 매핑)
- `db/services.py` - 데이터베이스 서비스 레이어
- `db/__init__.py`

### 라우터
- `routers/accounts.py` - 계정 관리
- `routers/google_drive.py` - Google Drive 연동
- `routers/feed.py` - Reels 피드 (Supabase 연동 완료)
- `routers/workspace.py` - 히스토리 저장 (Supabase 연동 완료)
- `routers/ingest.py` - 파일 메타데이터 저장 (Supabase 연동 완료)

### 유틸리티
- `utils/supabase_client.py` - Supabase 클라이언트 싱글톤

### 문서
- `SUPABASE_SCHEMA.md` - 데이터베이스 스키마 가이드
- `README.md` - 업데이트된 사용 가이드
- `.env.example` - 환경 변수 템플릿

## 🗄️ 데이터베이스 스키마

다음 테이블들이 연동되었습니다:
1. **accounts** - 사용자 계정
2. **files** - 업로드 파일 메타데이터
3. **google_integrations** - Google OAuth 토큰
4. **drive_files** - Google Drive 파일
5. **history** - 학습 히스토리 (JSONB)
6. **reels** - 숏폼 학습 콘텐츠

자세한 스키마는 `SUPABASE_SCHEMA.md` 참조

## 🚀 사용 방법

### 1. 환경 변수 설정
`.env` 파일에 다음 추가:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
GOOGLE_API_KEY=your_google_api_key
```

### 2. Supabase 스키마 생성
`SUPABASE_SCHEMA.md`의 SQL을 Supabase SQL Editor에서 실행

### 3. 서버 실행
```bash
cd apps/api
uvicorn main:app --reload
```

### 4. API 사용 예제

#### 계정 생성
```bash
curl -X POST "http://localhost:8000/api/accounts" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John Doe"}'
```

#### 파일 업로드 (메타데이터 자동 저장)
```bash
curl -X POST "http://localhost:8000/api/ingest" \
  -F "file=@document.pdf" \
  -F "account_id=your-account-id" \
  -F "folder_id=optional-folder-id"
```

#### 학습 히스토리 저장 (JSON)
```bash
curl -X POST "http://localhost:8000/api/workspace/default/history" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "account-id",
    "title": "Linear Algebra Study",
    "history_type": "study",
    "content": {
      "duration_seconds": 1800,
      "topics": ["Levi-Civita tensor", "Vector product"],
      "messages": [],
      "summary": "Studied tensor properties"
    }
  }'
```

#### Google Drive 연동
```bash
curl -X POST "http://localhost:8000/api/google-drive/auth" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "account-id",
    "access_token": "google-access-token",
    "refresh_token": "google-refresh-token"
  }'
```

## 📊 주요 특징

### History JSON 구조 예시
```json
{
  "messages": [
    {"role": "user", "content": "Explain tensors"},
    {"role": "assistant", "content": "..."}
  ],
  "sources": ["doc1.pdf", "doc2.pdf"],
  "duration_seconds": 1800,
  "topics": ["Linear Algebra", "Tensors"],
  "summary": "Studied Levi-Civita tensor properties",
  "quiz_results": {
    "score": 8,
    "total": 10
  }
}
```

### 서비스 레이어 패턴
모든 데이터베이스 작업은 서비스 레이어를 통해 처리:
- `AccountService`
- `FileService`
- `HistoryService`
- `GoogleIntegrationService`
- `DriveFileService`
- `ReelService`

### Dependency Injection
FastAPI의 `Depends`를 사용한 깔끔한 DI:
```python
@router.get("/users")
async def get_users(
    account_service: AccountService = Depends(get_account_service)
):
    return account_service.get_all()
```

## ✅ 다음 단계

구현 완료된 부분:
- ✅ Supabase 연동
- ✅ 계정 시스템
- ✅ 파일 메타데이터 저장
- ✅ JSON 히스토리 저장
- ✅ Google Drive 연동 엔드포인트
- ✅ Reels 관리

추가 구현이 필요한 부분:
- [ ] Google OAuth 플로우 (프론트엔드 연동)
- [ ] Google Drive 자동 동기화 로직
- [ ] JWT/Session 인증
- [ ] Supabase Storage 파일 업로드
- [ ] 폴더/워크스페이스 DB 저장

## 🔍 API 문서
서버 실행 후 `http://localhost:8000/docs` 에서 Swagger UI 확인 가능
