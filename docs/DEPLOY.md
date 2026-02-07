# iUM 프로젝트 배포 가이드

이 문서는 iUM 프로젝트를 GitHub에 푸시하고 Vercel(프론트엔드) 및 Render(백엔드)에 배포하는 방법을 단계별로 설명합니다.

## 사전 준비사항

- GitHub 계정
- Vercel 계정 (GitHub 연동)
- Render 계정 (GitHub 연동)
- Google API Key (Gemini API 사용)

---

## 1단계: GitHub 저장소 준비

### 1.1 Git 초기화 (아직 초기화하지 않은 경우)

```bash
cd /Users/atlas/iUM
git init
```

### 1.2 .gitignore 확인

프로젝트 루트에 `.gitignore` 파일이 있는지 확인하세요. 다음 항목들이 포함되어 있어야 합니다:
- `node_modules/`
- `.next/`
- `__pycache__/`
- `.env` (중요: API 키가 커밋되지 않도록)
- `.DS_Store`

### 1.3 환경 변수 파일 확인

**중요:** `.env` 파일은 절대 커밋하지 마세요. 대신 `.env.example` 파일을 만들어서 필요한 환경 변수 목록만 기록하세요.

### 1.4 첫 커밋 및 푸시

```bash
# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: iUM learning platform"

# GitHub에서 새 저장소를 생성한 후, 원격 저장소 추가
git remote add origin https://github.com/YOUR_USERNAME/iUM.git

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

---

## 2단계: 백엔드 배포 (Render)

### 2.1 Render 계정 설정

1. [Render.com](https://render.com)에 로그인
2. GitHub 계정 연동
3. "New +" 버튼 클릭 → "Web Service" 선택

### 2.2 저장소 연결

1. GitHub 저장소 선택
2. 다음 설정 입력:

**기본 설정:**
- **Name:** `ium-api` (또는 원하는 이름)
- **Region:** 가장 가까운 지역 선택
- **Branch:** `main`
- **Root Directory:** `apps/api` ⚠️ **중요: 반드시 설정**

**빌드 설정:**
- **Runtime:** `Python 3`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

**환경 변수:**
다음 환경 변수들을 추가하세요:

```
GOOGLE_API_KEY=your_google_api_key_here
ALLOWED_ORIGINS=*
```

**참고:** `$PORT`는 Render가 자동으로 할당하는 포트 번호입니다.

### 2.3 배포 확인

1. "Create Web Service" 클릭
2. 배포가 완료될 때까지 대기 (약 5-10분)
3. 배포 완료 후, 제공되는 URL 확인 (예: `https://ium-api.onrender.com`)

### 2.4 헬스 체크

브라우저에서 다음 URL을 열어 확인:
```
https://YOUR_RENDER_URL/api/health
```

응답: `{"status": "healthy"}` 가 나오면 성공입니다.

---

## 3단계: 프론트엔드 배포 (Vercel)

### 3.1 Vercel 계정 설정

1. [Vercel.com](https://vercel.com)에 로그인
2. GitHub 계정 연동
3. "Add New..." → "Project" 선택

### 3.2 저장소 연결

1. GitHub 저장소 선택
2. 다음 설정 입력:

**프로젝트 설정:**
- **Framework Preset:** `Next.js` (자동 감지)
- **Root Directory:** `apps/web` ⚠️ **중요: 반드시 설정**
- **Build Command:** (기본값 사용) `npm run build`
- **Output Directory:** (기본값 사용) `.next`

### 3.3 환경 변수 설정

"Environment Variables" 섹션에서 다음 변수 추가:

```
NEXT_PUBLIC_API_URL=https://YOUR_RENDER_URL
```

**예시:**
```
NEXT_PUBLIC_API_URL=https://ium-api.onrender.com
```

⚠️ **중요:** 
- `NEXT_PUBLIC_` 접두사가 있어야 클라이언트에서 접근 가능합니다.
- Render URL에는 마지막 슬래시(`/`)를 붙이지 마세요.

### 3.4 배포

1. "Deploy" 버튼 클릭
2. 배포가 완료될 때까지 대기 (약 2-5분)
3. 배포 완료 후, 제공되는 URL 확인 (예: `https://ium.vercel.app`)

### 3.5 배포 확인

1. Vercel에서 제공한 URL로 접속
2. 앱이 정상적으로 로드되는지 확인
3. Hard Mode에서 파일 업로드 및 채팅 기능 테스트

---

## 4단계: CORS 설정 확인

### 4.1 Render 백엔드 CORS 업데이트

Render 대시보드에서 환경 변수를 업데이트하거나, 코드에서 CORS를 수정할 수 있습니다.

**방법 1: 환경 변수 사용 (권장)**
Render 대시보드에서:
```
ALLOWED_ORIGINS=https://your-vercel-url.vercel.app,https://your-custom-domain.com
```

**방법 2: 코드 수정**
`apps/api/main.py`에서 `allow_origins`를 직접 수정:
```python
allow_origins = [
    "https://your-vercel-url.vercel.app",
    "https://your-custom-domain.com"
]
```

---

## 5단계: 문제 해결

### 백엔드가 응답하지 않는 경우

1. **Render 로그 확인:**
   - Render 대시보드 → "Logs" 탭
   - 에러 메시지 확인

2. **포트 확인:**
   - Start Command에 `--port $PORT`가 있는지 확인
   - Render는 자동으로 포트를 할당합니다

3. **환경 변수 확인:**
   - `GOOGLE_API_KEY`가 올바르게 설정되었는지 확인
   - Render 대시보드 → "Environment" 탭

### 프론트엔드가 API를 호출하지 못하는 경우

1. **환경 변수 확인:**
   - Vercel 대시보드 → "Settings" → "Environment Variables"
   - `NEXT_PUBLIC_API_URL`이 올바른지 확인

2. **CORS 에러:**
   - 브라우저 콘솔에서 CORS 에러 확인
   - 백엔드 CORS 설정이 프론트엔드 URL을 허용하는지 확인

3. **네트워크 확인:**
   - Vercel 배포 후 환경 변수 변경 시 재배포 필요
   - "Redeploy" 버튼 클릭

### 빌드 실패

1. **의존성 확인:**
   - `apps/api/requirements.txt`에 모든 패키지가 포함되어 있는지 확인
   - `apps/web/package.json`에 모든 의존성이 있는지 확인

2. **Node/Python 버전:**
   - Vercel: Node.js 18+ (자동 감지)
   - Render: Python 3.11+ (설정에서 선택)

---

## 6단계: 커스텀 도메인 설정 (선택사항)

### Vercel 도메인

1. Vercel 대시보드 → 프로젝트 → "Settings" → "Domains"
2. 원하는 도메인 추가
3. DNS 설정 안내에 따라 도메인 제공자에서 설정

### Render 도메인

1. Render 대시보드 → 서비스 → "Settings" → "Custom Domain"
2. 도메인 추가 및 DNS 설정

---

## 환경 변수 요약

### 백엔드 (Render)
```
GOOGLE_API_KEY=your_google_api_key
ALLOWED_ORIGINS=*
```

### 프론트엔드 (Vercel)
```
NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com
```

---

## 배포 후 체크리스트

- [ ] 백엔드 헬스 체크 통과 (`/api/health`)
- [ ] 프론트엔드가 정상적으로 로드됨
- [ ] Hard Mode에서 파일 업로드 작동
- [ ] Hard Mode에서 채팅 기능 작동
- [ ] Soft Mode가 정상적으로 표시됨
- [ ] CORS 에러 없음
- [ ] 환경 변수가 올바르게 설정됨

---

## 추가 참고사항

### 개발 환경 vs 프로덕션

- **개발:** `http://localhost:8000` (백엔드), `http://localhost:3000` (프론트엔드)
- **프로덕션:** Render URL (백엔드), Vercel URL (프론트엔드)

### 보안

- 절대 `.env` 파일을 커밋하지 마세요
- API 키는 환경 변수로만 관리하세요
- 프로덕션에서는 `ALLOWED_ORIGINS`를 특정 도메인으로 제한하는 것을 권장합니다

### 업데이트 배포

코드를 수정한 후:
1. GitHub에 푸시
2. Vercel과 Render가 자동으로 재배포 (GitHub 연동 시)
3. 또는 수동으로 "Redeploy" 클릭

---

## 지원

문제가 발생하면:
1. Render/Vercel 로그 확인
2. 브라우저 콘솔 확인
3. 네트워크 탭에서 API 호출 확인

행운을 빕니다! 🚀

