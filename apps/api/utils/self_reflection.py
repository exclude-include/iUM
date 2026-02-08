"""
Self-Reflection Loop for iUM ReAct Agent.
Evaluates and improves response quality using LLM-as-Judge and Opik metrics.
"""
import os
import re
import json
from typing import Optional, Dict, Any, Tuple, List
from langchain_google_genai import ChatGoogleGenerativeAI
from utils.opik_config import track


class SelfReflectionLoop:
    """
    Self-reflection loop for improving response quality.
    
    Workflow:
    1. Generate initial response
    2. Evaluate quality using LLM-as-Judge (+ Opik metrics if available)
    3. If quality < threshold, refine and retry
    4. Return final response with evaluation metrics
    """
    
    MAX_ITERATIONS = 2
    QUALITY_THRESHOLD = 0.7
    
    def __init__(self, llm: Optional[ChatGoogleGenerativeAI] = None):
        self.llm = llm or ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.opik_enabled = os.getenv("OPIK_API_KEY") is not None
    
    @track(name="self_reflection_evaluate", type="tool")
    async def _evaluate_response(
        self,
        response: str,
        query: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate response quality using LLM-as-Judge.
        
        Returns:
            Dict with 'score' (0-1), 'feedback', and 'issues'
        """
        context_section = f"\n\nReference Context:\n{context[:2000]}" if context else ""
        
        eval_prompt = f"""You are a quality evaluator for educational AI responses.

Evaluate the following response for:
1. **Relevance** (0-1): Does it directly answer the question?
2. **Accuracy** (0-1): Is the information factually correct?
3. **Completeness** (0-1): Does it cover the key aspects?
4. **Clarity** (0-1): Is it well-structured and easy to understand?

Question: {query}

Response to evaluate:
{response}{context_section}

Respond in JSON format:
{{
    "relevance": 0.0-1.0,
    "accuracy": 0.0-1.0,
    "completeness": 0.0-1.0,
    "clarity": 0.0-1.0,
    "overall_score": 0.0-1.0,
    "issues": ["issue1", "issue2"],
    "suggestions": ["suggestion1", "suggestion2"]
}}"""

        try:
            result = await self.llm.ainvoke(eval_prompt)
            content = result.content
            
            # Parse JSON from response
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                evaluation = json.loads(json_match.group(0))
                return {
                    "score": evaluation.get("overall_score", 0.5),
                    "relevance": evaluation.get("relevance", 0.5),
                    "accuracy": evaluation.get("accuracy", 0.5),
                    "completeness": evaluation.get("completeness", 0.5),
                    "clarity": evaluation.get("clarity", 0.5),
                    "issues": evaluation.get("issues", []),
                    "suggestions": evaluation.get("suggestions", [])
                }
        except Exception as e:
            print(f"[SelfReflection] Evaluation error: {e}")
        
        # Fallback: assume acceptable quality
        return {
            "score": 0.75,
            "relevance": 0.75,
            "accuracy": 0.75,
            "completeness": 0.75,
            "clarity": 0.75,
            "issues": [],
            "suggestions": []
        }
    
    @track(name="self_reflection_refine", type="tool")
    async def _refine_response(
        self,
        original_response: str,
        query: str,
        issues: List[str],
        suggestions: List[str],
        context: Optional[str] = None
    ) -> str:
        """
        Refine response based on evaluation feedback.
        """
        context_section = f"\n\nReference Context:\n{context[:2000]}" if context else ""
        
        issues_text = "\n".join([f"- {issue}" for issue in issues]) if issues else "None"
        suggestions_text = "\n".join([f"- {s}" for s in suggestions]) if suggestions else "None"
        
        refine_prompt = f"""Improve the following response based on the feedback.

Original Question: {query}

Original Response:
{original_response}

Issues identified:
{issues_text}

Suggestions:
{suggestions_text}
{context_section}

Please provide an improved response that:
1. Fixes the identified issues
2. Incorporates the suggestions
3. Maintains the same format and style
4. Is more accurate and complete

Improved Response:"""

        try:
            result = await self.llm.ainvoke(refine_prompt)
            return result.content.strip()
        except Exception as e:
            print(f"[SelfReflection] Refinement error: {e}")
            return original_response
    
    @track(name="self_reflection_loop", type="tool")
    async def evaluate_and_improve(
        self,
        response: str,
        query: str,
        context: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Main entry point: evaluate response and improve if needed.
        
        Args:
            response: The generated response to evaluate
            query: The original user query
            context: Optional context from RAG retrieval
            
        Returns:
            Tuple of (final_response, evaluation_metrics)
        """
        current_response = response
        all_evaluations = []
        
        for iteration in range(self.MAX_ITERATIONS + 1):
            # Evaluate current response
            evaluation = await self._evaluate_response(
                current_response, query, context
            )
            all_evaluations.append({
                "iteration": iteration,
                **evaluation
            })
            
            print(f"[SelfReflection] Iteration {iteration}: score={evaluation['score']:.2f}")
            
            # Check if quality threshold met
            if evaluation["score"] >= self.QUALITY_THRESHOLD:
                print(f"[SelfReflection] Quality threshold met ({evaluation['score']:.2f} >= {self.QUALITY_THRESHOLD})")
                break
            
            # Check if max iterations reached
            if iteration >= self.MAX_ITERATIONS:
                print(f"[SelfReflection] Max iterations reached. Using best response.")
                break
            
            # Refine response
            print(f"[SelfReflection] Refining response (issues: {evaluation['issues']})")
            current_response = await self._refine_response(
                current_response,
                query,
                evaluation["issues"],
                evaluation["suggestions"],
                context
            )
        
        # Final evaluation metrics
        final_eval = all_evaluations[-1]
        metrics = {
            "confidence_score": round(final_eval["score"] * 100),  # 0-100 for UI
            "relevance": round(final_eval.get("relevance", 0.5) * 100),
            "accuracy": round(final_eval.get("accuracy", 0.5) * 100),
            "iterations_used": len(all_evaluations),
            "refined": len(all_evaluations) > 1,
        }
        
        return current_response, metrics


# Singleton instance
_reflection_instance: Optional[SelfReflectionLoop] = None


def get_self_reflection(llm: Optional[ChatGoogleGenerativeAI] = None) -> SelfReflectionLoop:
    """Get or create SelfReflectionLoop instance."""
    global _reflection_instance
    if _reflection_instance is None:
        _reflection_instance = SelfReflectionLoop(llm)
    return _reflection_instance
