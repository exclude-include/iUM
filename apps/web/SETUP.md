# iUM Web App Setup Guide

## 🔐 인증 설정 (Supabase)

### 1. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에 가입하고 새 프로젝트를 생성하세요
2. 프로젝트 설정에서 API 키를 복사하세요:
   - `Settings` → `API` → `Project URL`
   - `Settings` → `API` → `anon` `public` key

### 2. 환경 변수 설정

`.env.local.example` 파일을 `.env.local`로 복사하고 값을 입력하세요:

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 편집:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Google OAuth 설정 (선택사항 - Google Drive 연동용)

1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트 생성
2. OAuth 2.0 클라이언트 ID 생성:
   - `APIs & Services` → `Credentials` → `Create Credentials` → `OAuth client ID`
   - Application type: `Web application`
   - Authorized redirect URIs: `https://your-project.supabase.co/auth/v1/callback`

3. Supabase에서 Google Provider 활성화:
   - Supabase Dashboard → `Authentication` → `Providers` → `Google`
   - Client ID와 Client Secret 입력
   - Scopes에 추가: `https://www.googleapis.com/auth/drive.readonly`

4. `.env.local`에 Google API 키 추가:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
NEXT_PUBLIC_GOOGLE_API_KEY=your-api-key
```

### 4. Supabase 데이터베이스 테이블 생성

Supabase SQL Editor에서 다음 쿼리를 실행하세요:

```sql
-- Reels 테이블 생성
CREATE TABLE reels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  folder_id TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage bucket for video uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('reels', 'reels', true);

-- Storage policy for authenticated users to upload
CREATE POLICY "Users can upload reels"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reels');

-- Storage policy for public read access
CREATE POLICY "Public can view reels"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reels');

-- Row Level Security policies
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reels"
ON reels FOR SELECT
TO public
USING (true);

CREATE POLICY "Authenticated users can create reels"
ON reels FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reels"
ON reels FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reels"
ON reels FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

## 🚀 실행 방법

1. 의존성 설치:
```bash
npm install
```

2. 개발 서버 실행:
```bash
npm run dev
```

3. 브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

## 📱 기능 사용 방법

### 로그인
1. 좌측 하단의 프로필 버튼 클릭 (😊 아이콘)
2. "Sign In" 버튼 클릭
3. 이메일/비밀번호 또는 Google로 로그인

### 릴스 업로드
1. 로그인 후 프로필 메뉴에서 "Upload Reel" 클릭
2. 제목, 설명 입력
3. 비디오 업로드 방법 선택:
   - **URL**: 비디오 URL 입력
   - **File**: 로컬 파일 업로드 (최대 100MB)
   - **Drive**: Google Drive에서 선택 (Google 로그인 필요)
4. "Upload Reel" 버튼 클릭

### Google Drive 연동
- Google로 로그인하면 자동으로 Google Drive 접근 권한 요청
- 프로필 메뉴에서 "✓ Google Drive Connected" 상태 확인 가능
- 릴스 업로드 시 "Drive" 탭에서 Google Drive 파일 선택 가능

## 🔧 문제 해결

### 로그인이 작동하지 않는 경우
- `.env.local` 파일이 올바르게 설정되었는지 확인
- Supabase 프로젝트 URL과 키가 정확한지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 릴스 업로드가 실패하는 경우
- Supabase에서 `reels` 테이블과 storage bucket이 생성되었는지 확인
- RLS (Row Level Security) 정책이 올바르게 설정되었는지 확인
- 파일 크기가 100MB를 초과하지 않는지 확인

### Google Drive 연동이 작동하지 않는 경우
- Google Cloud Console에서 OAuth 설정이 올바른지 확인
- Supabase에서 Google Provider가 활성화되었는지 확인
- 리다이렉트 URI가 정확히 설정되었는지 확인

## 📚 추가 정보

- [Supabase 문서](https://supabase.com/docs)
- [Next.js 문서](https://nextjs.org/docs)
- [Google Drive API 문서](https://developers.google.com/drive)
