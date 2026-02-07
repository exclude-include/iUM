"""
ReAct Learning Agent for iUM
Reasoning + Acting 패턴을 적용한 학습 에이전트
"""
import os
import re
import json
import asyncio
from typing import Optional, Dict, Any, List, AsyncGenerator
from langchain_google_genai import ChatGoogleGenerativeAI
from utils.learning_tools import LearningToolkit, get_learning_toolkit
from utils.opik_config import track


REACT_SYSTEM_PROMPT = """당신은 iUM 학습 에이전트입니다.
사용자의 학습 질문에 대해 단계별로 생각하고 도구를 활용하여 최고의 답변을 제공합니다.

## 사용 가능한 도구
{tools}

## 응답 형식

### 도구를 사용해야 할 때:
```
Thought: [현재 상황 분석 및 다음 행동 결정]
Action: [도구명]
Action Input: [도구 파라미터 JSON]
```

### 최종 답변을 제공할 때:
```
Thought: 충분한 정보를 수집했습니다. 최종 답변을 제공합니다.
Final Answer: [사용자에게 전달할 최종 응답]
```

## 규칙
1. 복잡한 질문은 여러 도구를 순차적으로 사용하세요.
2. 퀴즈 요청 시 create_quiz_cell 도구를 사용하세요.
3. 선행 지식이 필요한 주제는 check_prerequisites 먼저 실행하세요.
4. 각 단계에서 반드시 Thought로 시작하세요.
5. Final Answer에는 마크다운 형식으로 응답하세요.

## 예시
사용자: "미적분을 설명하고 퀴즈도 만들어줘"

Thought: 사용자가 미적분 설명과 퀴즈를 원합니다. 먼저 개념 설명을 생성하고, 그 다음 퀴즈를 만들겠습니다.
Action: generate_concept_cell
Action Input: {{"topic": "미적분"}}

(Observation 후)

Thought: 개념 설명을 만들었습니다. 이제 퀴즈를 생성하겠습니다.
Action: create_quiz_cell
Action Input: {{"topic": "미적분", "num_questions": 3}}

(Observation 후)

Thought: 개념 설명과 퀴즈를 모두 준비했습니다. 최종 답변을 제공합니다.
Final Answer: 미적분에 대한 설명과 퀴즈를 준비했습니다! ...
"""


class ReactLearningAgent:
    """
    ReAct 패턴을 적용한 학습 에이전트
    
    흐름:
    1. 사용자 질문 수신
    2. Thought: 다음 행동 결정
    3. Action: 도구 호출
    4. Observation: 도구 결과 확인
    5. 반복 또는 Final Answer 반환
    """
    
    def __init__(
        self,
        folder_id: Optional[str] = None,
        session_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        max_iterations: int = 5
    ):
        self.llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.toolkit = get_learning_toolkit(
            folder_id=folder_id,
            session_id=session_id,
            document_ids=document_ids
        )
        self.max_iterations = max_iterations
        self.scratchpad = ""
    
    def _build_prompt(self, question: str) -> str:
        """시스템 프롬프트 + 사용자 질문 + 스크래치패드 결합"""
        tools_description = self.toolkit.get_tools_prompt()
        system_prompt = REACT_SYSTEM_PROMPT.format(tools=tools_description)
        
        prompt = f"""{system_prompt}

## 현재 세션
사용자 질문: {question}

{self.scratchpad}"""
        return prompt
    
    def _parse_action(self, response: str) -> Optional[Dict[str, Any]]:
        """LLM 응답에서 Action과 Action Input 파싱"""
        # Action 파싱
        action_match = re.search(r'Action:\s*(\w+)', response)
        if not action_match:
            return None
        
        action_name = action_match.group(1).strip()
        
        # Action Input 파싱 (JSON 형식)
        input_match = re.search(r'Action Input:\s*(\{.*?\})', response, re.DOTALL)
        if input_match:
            try:
                action_input = json.loads(input_match.group(1))
            except json.JSONDecodeError:
                action_input = {}
        else:
            # 간단한 문자열 입력 파싱
            input_match = re.search(r'Action Input:\s*(.+?)(?:\n|$)', response)
            if input_match:
                action_input = {"query": input_match.group(1).strip().strip('"')}
            else:
                action_input = {}
        
        return {
            "action": action_name,
            "action_input": action_input
        }
    
    def _parse_final_answer(self, response: str) -> Optional[str]:
        """Final Answer 파싱"""
        match = re.search(r'Final Answer:\s*(.+)', response, re.DOTALL)
        if match:
            return match.group(1).strip()
        return None
    
    def _extract_thought(self, response: str) -> str:
        """Thought 부분 추출"""
        match = re.search(r'Thought:\s*(.+?)(?:Action:|Final Answer:|$)', response, re.DOTALL)
        if match:
            return match.group(1).strip()
        return ""
    
    @track(name="react_agent_run", type="tool")
    async def run(self, question: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        ReAct 에이전트 실행 (스트리밍)
        
        Yields:
            {"status": "progress", "step": "...", "message": "..."}
            {"status": "complete", "data": {...}}
        """
        self.scratchpad = ""
        accumulated_learning_units = []
        
        yield {
            "status": "progress", 
            "step": "thinking", 
            "message": "질문을 분석하고 있습니다... 🤔"
        }
        
        for iteration in range(self.max_iterations):
            # 1. LLM에게 다음 행동 결정 요청
            prompt = self._build_prompt(question)
            
            try:
                response = await self.llm.ainvoke(prompt)
                response_text = response.content
            except Exception as e:
                yield {
                    "status": "error",
                    "data": {"message": f"LLM 호출 실패: {str(e)}"}
                }
                return
            
            # 2. Final Answer 체크
            final_answer = self._parse_final_answer(response_text)
            if final_answer:
                yield {
                    "status": "complete",
                    "data": {
                        "message": final_answer,
                        "conversation_id": "react-session",
                        "sources": [],
                        "reasoning_chain": self._get_reasoning_chain(),
                        "learning_units": accumulated_learning_units
                    }
                }
                return
            
            # 3. Action 파싱
            action = self._parse_action(response_text)
            if not action:
                # Action도 Final Answer도 없으면 응답 자체를 반환
                yield {
                    "status": "complete",
                    "data": {
                        "message": response_text,
                        "conversation_id": "react-session",
                        "sources": [],
                        "reasoning_chain": ["Direct response"]
                    }
                }
                return
            
            thought = self._extract_thought(response_text)
            action_name = action["action"]
            action_input = action["action_input"]
            
            # 4. 진행 상태 스트리밍
            yield {
                "status": "progress",
                "step": f"action_{iteration + 1}",
                "message": f"도구 실행 중: {action_name} 🔧"
            }
            
            # 5. 도구 실행
            try:
                observation = await self.toolkit.execute(action_name, **action_input)
            except Exception as e:
                observation = f"[Error] 도구 실행 실패: {str(e)}"
            
            # 6. Learning Unit 수집 (quiz_cell이나 concept_cell인 경우)
            if action_name in ["create_quiz_cell", "generate_concept_cell"]:
                accumulated_learning_units.append({
                    "type": "quiz" if "quiz" in action_name else "concept",
                    "content": observation
                })
            
            # 7. 스크래치패드 업데이트
            self.scratchpad += f"\nThought: {thought}\n"
            self.scratchpad += f"Action: {action_name}\n"
            self.scratchpad += f"Action Input: {json.dumps(action_input, ensure_ascii=False)}\n"
            self.scratchpad += f"Observation: {observation[:500]}...\n" if len(observation) > 500 else f"Observation: {observation}\n"
        
        # Max iterations 도달
        yield {
            "status": "complete",
            "data": {
                "message": "최대 반복 횟수에 도달했습니다. 지금까지 수집한 정보를 바탕으로 답변합니다.",
                "conversation_id": "react-session",
                "sources": [],
                "reasoning_chain": self._get_reasoning_chain(),
                "learning_units": accumulated_learning_units
            }
        }
    
    def _get_reasoning_chain(self) -> List[str]:
        """스크래치패드에서 reasoning chain 추출"""
        thoughts = re.findall(r'Thought:\s*(.+?)(?:\n|$)', self.scratchpad)
        actions = re.findall(r'Action:\s*(\w+)', self.scratchpad)
        
        chain = []
        for i, (thought, action) in enumerate(zip(thoughts, actions)):
            chain.append(f"Step {i+1}: {thought[:50]}... → {action}")
        
        if not chain:
            chain = ["Direct response"]
        
        return chain


async def query_with_react_agent(
    question: str,
    folder_id: Optional[str] = None,
    session_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    ReAct 에이전트로 질문 처리 (편의 함수)
    
    Args:
        question: 사용자 질문
        folder_id: 폴더 ID (문서 필터링)
        session_id: 세션 ID (히스토리 연동)
        document_ids: 특정 문서 ID 목록
    
    Yields:
        스트리밍 이벤트
    """
    agent = ReactLearningAgent(
        folder_id=folder_id,
        session_id=session_id,
        document_ids=document_ids
    )
    
    async for event in agent.run(question):
        yield event
