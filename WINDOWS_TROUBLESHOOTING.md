# 🪟 Windows 환경 개발 트러블슈팅 가이드

이 문서는 Windows 환경에서 iUM 프로젝트 개발 시 마주칠 수 있는 특정 문제들과 해결 방법을 정리했습니다.
팀원들(macOS/Ubuntu 사용)과 환경이 달라 발생할 수 있는 이슈들을 포함합니다.

---

## 🚨 1. ChromaDB 로컬 크래시 (Critical)

### 문제 상황
Windows 환경(특히 Anaconda 사용 시)에서 로컬 `ChromaDB` 사용 시, 벡터를 저장하는 과정(`add_documents`)에서 에러 메시지 없이 **Python 프로세스가 조용히 종료(Silent Crash)** 되거나 **무한 로딩(Hang)** 걸리는 현상 발생.

### 원인
ChromaDB의 기본 백엔드인 `hnswlib` 또는 내장 `sqlite3`가 Windows의 멀티스레드 환경(FastAPI uvicorn 등)에서 호환성 문제(DLL 충돌, Thread Lock 등)를 일으킴. macOS/Linux에서는 잘 동작할 수 있음.

### 해결된 구조 (현재 적용됨)
로컬 ChromaDB를 제거하고 **Supabase Vector Store(Cloud PostgreSQL)** 로 마이그레이션했습니다.

- **변경 전**: `langchain_chroma.Chroma` (로컬 파일 저장)
- **변경 후**: `langchain_community.vectorstores.SupabaseVectorStore` (클라우드 DB)

> **팀원 주의사항**: `apps/api/.env`에 Supabase 관련 키(`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)가 반드시 포함되어야 채팅 기능이 작동합니다.

---

## ⚠️ 2. Supabase SQL Schema (UUID vs BigInt)

### 문제 상황
Supabase Vector Store 사용 시 다음과 같은 에러 발생:
```
invalid input syntax for type bigint: "41354d5a-..." (Code: 22P02)
```

### 원인
LangChain의 `SupabaseVectorStore`는 문서를 삽입할 때 ID를 `UUID` 형식으로 생성하지만, 초기 SQL 테이블 스키마가 `bigint(bigserial)`로 설정되어 있어 타입 불일치 발생.

### 해결 방법
`documents` 테이블의 ID 타입을 `UUID`로 변경해야 합니다.

**[Migration SQL]**
```sql
create table documents (
  id uuid primary key default gen_random_uuid(), -- bigint 대신 uuid 사용
  content text,
  metadata jsonb,
  embedding vector(3072) -- Gemini Embedding Dimension
);
```

---

## 🔑 3. Google Gemini Embedding Model 이름

### 문제 상황
LangChain 문서만 보고 `text-embedding-004`를 사용하면 **404 Error** 발생.

### 해결 방법
Google Gemini API(v1beta)는 임베딩 모델 호출 시 `models/` 접두사가 필수이며, 정확한 모델명은 `models/gemini-embedding-001`입니다.

```python
# apps/api/utils/vector_store.py
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001", 
    task_type="retrieval_document"
)
```

---

> 💡 **Tip**: 윈도우 환경에서 `npm run dev` 등의 명령어 오류 발생 시, Powershell 대신 `Git Bash`를 사용하거나 관리자 권한으로 실행해보세요.
