# Soft Mode Tools Integration

Hard Mode ReAct Agent에 Soft Mode 도구들을 추가하여 학습-복습 통합 경험을 제공합니다.

## Proposed Changes

### Backend - Learning Tools

#### [MODIFY] [learning_tools.py](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/api/utils/learning_tools.py)

**3개의 새로운 Tool 추가:**

| Tool | 설명 | Parameters |
|------|------|------------|
| `create_review_reel` | 현재 학습 내용을 Soft Mode Reel로 변환 | `topic`, `content`, `priority` |
| `get_related_reels` | 주제와 관련된 기존 Reel 검색 | `topic`, `limit` |
| `check_quiz_performance` | 사용자의 Soft Mode 퀴즈 성적 조회 | `topic` (optional) |

**구현 예시:**
```python
async def _create_review_reel(self, topic: str, content: str = "", priority: str = "normal") -> str:
    """학습 내용을 Soft Mode Reel로 변환"""
    # 1. LLM으로 해시태그 + 퀴즈 생성
    # 2. POST /reels/create-with-quiz 호출
    # 3. 결과 반환

async def _get_related_reels(self, topic: str, limit: int = 5) -> str:
    """주제와 관련된 기존 Reel 검색"""
    # pgvector 유사도 검색으로 관련 Reel 조회

async def _check_quiz_performance(self, topic: str = None) -> str:
    """Soft Mode 퀴즈 성적 조회"""
    # reels 테이블에서 퀴즈 정답률 통계 조회
```

---

### Backend - Agent System Prompt

#### [MODIFY] [react_agent.py](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/api/utils/react_agent.py)

`REACT_SYSTEM_PROMPT`에 Soft Mode 도구 사용 가이드라인 추가:

```
## Soft Mode Integration Rules
8. When explaining important concepts, consider using `create_review_reel` to add them to Soft Mode for later review
9. Use `check_quiz_performance` to understand user's weak points before explaining a topic
10. Use `get_related_reels` to suggest existing review content
```

---

## Agent Flow (After Integration)

```
User: "미적분 설명해줘"
        │
        ▼
┌─────────────────────────────────────┐
│ Thought: 먼저 사용자의 기존 학습 상태 확인 │
│ Action: check_quiz_performance      │
│ Input: {"topic": "미적분"}           │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Observation: 정답률 40%, 약점: 극한   │
│ Thought: 극한부터 다시 설명하고       │
│          Soft Mode에 복습용 추가     │
│ Action: generate_concept_cell       │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Action: create_review_reel          │
│ Input: {"topic": "극한", "priority": "high"} │
└─────────────────────────────────────┘
        │
        ▼
    Final Answer (+ Soft Mode Reel 생성됨)
```

---

## Verification Plan

### Testing
1. Agent가 `check_quiz_performance` 호출 시 올바른 통계 반환 확인
2. `create_review_reel` 호출 후 Soft Mode 피드에 Reel 추가 확인
3. `get_related_reels`가 관련 콘텐츠를 정확히 검색하는지 확인

### Manual Verification
- Hard Mode에서 대화 후 Soft Mode 피드에 새 Reel 확인
- Agent가 퀴즈 성적 기반으로 학습 전략 조정하는지 확인
