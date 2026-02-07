"""
iUM Learning Tools for ReAct Agent
학습 플랫폼 전용 도구 모음
"""
import os
import json
import re
from typing import Callable, Dict, Any, Optional, List
from langchain_google_genai import ChatGoogleGenerativeAI


class Tool:
    """도구 정의 클래스"""
    def __init__(self, name: str, description: str, func: Callable, params: List[str] = None):
        self.name = name
        self.description = description
        self.func = func
        self.params = params or []

    def to_prompt_string(self) -> str:
        """프롬프트에 포함할 도구 설명 문자열 생성"""
        params_str = ", ".join(self.params) if self.params else "없음"
        return f"- {self.name}: {self.description} (파라미터: {params_str})"


class LearningToolkit:
    """iUM 학습 플랫폼 전용 도구 모음"""
    
    def __init__(
        self, 
        llm: Optional[ChatGoogleGenerativeAI] = None,
        folder_id: Optional[str] = None, 
        session_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None
    ):
        self.llm = llm or ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.folder_id = folder_id
        self.session_id = session_id
        self.document_ids = document_ids
        self.tools = self._init_tools()
    
    def _init_tools(self) -> Dict[str, Tool]:
        return {
            "search_knowledge": Tool(
                name="search_knowledge",
                description="업로드된 문서에서 관련 내용을 검색합니다",
                func=self._search_knowledge,
                params=["query"]
            ),
            "generate_concept_cell": Tool(
                name="generate_concept_cell", 
                description="주제에 대한 개념 설명 Learning Unit을 생성합니다",
                func=self._generate_concept_cell,
                params=["topic"]
            ),
            "create_quiz_cell": Tool(
                name="create_quiz_cell",
                description="주제에 대한 퀴즈 셀을 생성합니다",
                func=self._create_quiz_cell,
                params=["topic", "num_questions(기본값=3)"]
            ),
            "check_prerequisites": Tool(
                name="check_prerequisites",
                description="주제를 학습하기 위해 필요한 선행 지식을 분석합니다",
                func=self._check_prerequisites,
                params=["topic"]
            ),
            "get_learning_history": Tool(
                name="get_learning_history",
                description="사용자의 최근 학습 기록을 조회합니다",
                func=self._get_learning_history,
                params=[]
            ),
            "suggest_next_topic": Tool(
                name="suggest_next_topic",
                description="현재 학습 진도에 기반하여 다음 학습 주제를 추천합니다",
                func=self._suggest_next_topic,
                params=["current_topic"]
            ),
        }
    
    def get_tools_prompt(self) -> str:
        """모든 도구 설명을 프롬프트 형식으로 반환"""
        return "\n".join([tool.to_prompt_string() for tool in self.tools.values()])
    
    async def execute(self, tool_name: str, **kwargs) -> str:
        """도구 실행"""
        if tool_name not in self.tools:
            return f"[Error] 알 수 없는 도구: {tool_name}"
        
        tool = self.tools[tool_name]
        try:
            result = await tool.func(**kwargs)
            return result
        except Exception as e:
            return f"[Error] 도구 실행 실패: {str(e)}"
    
    # ========== 도구 구현 ==========
    
    async def _search_knowledge(self, query: str) -> str:
        """문서에서 관련 내용 검색 (기존 RAG retriever 활용)"""
        try:
            from utils.vector_store import get_retriever
            
            retriever = get_retriever(
                collection_name="user_knowledge", 
                k=3, 
                folder_id=self.folder_id,
                document_ids=self.document_ids
            )
            docs = retriever.invoke(query)
            
            if not docs:
                return "관련 문서를 찾지 못했습니다."
            
            results = []
            for i, doc in enumerate(docs):
                source = doc.metadata.get("source", "Unknown")
                content = doc.page_content[:300]
                results.append(f"[{i+1}] ({source}): {content}...")
            
            return "\n\n".join(results)
        except Exception as e:
            return f"검색 실패: {str(e)}"
    
    async def _generate_concept_cell(self, topic: str) -> str:
        """개념 설명 셀 생성"""
        prompt = f"""'{topic}'에 대해 학습자가 이해하기 쉽게 설명해주세요.

다음 형식으로 작성해주세요:
1. 핵심 정의 (1-2문장)
2. 주요 특징 (3가지)
3. 실생활 예시 (1개)
4. Mermaid 다이어그램 (graph TD 형식, 간단하게)

응답은 마크다운 형식으로 작성해주세요."""

        response = await self.llm.ainvoke(prompt)
        return response.content
    
    async def _create_quiz_cell(self, topic: str, num_questions: int = 3) -> str:
        """퀴즈 셀 생성"""
        prompt = f"""'{topic}'에 대한 {num_questions}개의 객관식 퀴즈를 만들어주세요.

다음 JSON 형식으로 응답해주세요:
```json
[
  {{
    "id": "1",
    "question_text": "질문 내용",
    "options": [
      {{"id": "A", "text": "선택지 A", "is_correct": false}},
      {{"id": "B", "text": "선택지 B", "is_correct": true}},
      {{"id": "C", "text": "선택지 C", "is_correct": false}},
      {{"id": "D", "text": "선택지 D", "is_correct": false}}
    ],
    "explanation": "정답 설명"
  }}
]
```"""

        response = await self.llm.ainvoke(prompt)
        return response.content
    
    async def _check_prerequisites(self, topic: str) -> str:
        """선행 지식 분석"""
        prompt = f"""'{topic}'을 효과적으로 학습하기 위해 미리 알아야 할 선행 지식을 분석해주세요.

다음 형식으로 응답해주세요:
1. **필수 선행 지식** (반드시 알아야 함)
   - 개념 1: 간단한 설명
   - 개념 2: 간단한 설명

2. **권장 선행 지식** (알면 도움됨)
   - 개념 1: 간단한 설명

3. **학습 순서 제안**
   선행 지식 → {topic} 순서로 학습 로드맵 제시"""

        response = await self.llm.ainvoke(prompt)
        return response.content
    
    async def _get_learning_history(self) -> str:
        """학습 기록 조회 (Memory Manager 활용)"""
        if not self.session_id:
            return "세션 정보가 없어 학습 기록을 조회할 수 없습니다."
        
        try:
            from utils.memory_manager import get_memory_manager
            memory = get_memory_manager()
            context = await memory.get_context(self.session_id)
            
            if not context:
                return "이전 학습 기록이 없습니다. 새로운 학습을 시작해보세요!"
            
            return f"최근 대화 기록:\n{context}"
        except Exception as e:
            return f"학습 기록 조회 실패: {str(e)}"
    
    async def _suggest_next_topic(self, current_topic: str) -> str:
        """다음 학습 주제 추천"""
        # 학습 기록이 있다면 함께 활용
        history = ""
        if self.session_id:
            try:
                from utils.memory_manager import get_memory_manager
                memory = get_memory_manager()
                history = await memory.get_context(self.session_id)
            except:
                pass
        
        history_context = f"\n\n사용자의 최근 학습 기록:\n{history}" if history else ""
        
        prompt = f"""'{current_topic}'을 학습한 후 다음으로 학습하면 좋을 주제를 추천해주세요.{history_context}

다음 형식으로 응답해주세요:
1. **추천 주제 1**: 
   - 주제명
   - 추천 이유 (1문장)
   - 난이도: 쉬움/보통/어려움

2. **추천 주제 2**:
   - 주제명
   - 추천 이유 (1문장)
   - 난이도: 쉬움/보통/어려움

3. **학습 팁**: {current_topic}에서 다음 단계로 넘어갈 때 주의할 점"""

        response = await self.llm.ainvoke(prompt)
        return response.content


# 싱글톤 인스턴스 (선택적 사용)
def get_learning_toolkit(
    folder_id: Optional[str] = None,
    session_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None
) -> LearningToolkit:
    """LearningToolkit 인스턴스 생성 헬퍼"""
    return LearningToolkit(
        folder_id=folder_id,
        session_id=session_id,
        document_ids=document_ids
    )
