"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, X, BookOpen, Brain, MessageCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MathContent } from "./MathContent";
import { SourcesPanel } from "./SourcesPanel";
import { QuizView } from "@/components/QuizView";
import { Mermaid } from "@/components/Mermaid";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

// 헬퍼 함수: 마크다운 텍스트에서 Mermaid 코드만 추출하기
const extractMermaidCode = (content: string): string | null => {
  if (!content) return null;
  // ```mermaid 로 시작해서 ``` 로 끝나는 블록을 찾습니다.
  const match = content.match(/```mermaid\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
};

// 헬퍼 함수: Mermaid 코드를 제외한 순수 텍스트만 남기기 (선택 사항)
const removeMermaidCode = (content: string): string => {
  if (!content) return "";
  return content.replace(/```mermaid\n[\s\S]*?\n```/g, "");
};

export function MainContentArea() {
  const { activeDocument, learningTabs, activeTabId, setActiveTab, closeTab } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const activeLearningUnit = learningTabs.find((tab) => tab.id === activeTabId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 다이어그램 코드 추출 (데이터가 들어오면 즉시 확인)
  const mermaidCode = activeLearningUnit?.content 
    ? extractMermaidCode(activeLearningUnit.content) 
    : null;

  // 본문 텍스트 (다이어그램 코드가 섞여 있으면 보기 싫으므로 제거하고 보여줄 수도 있음)
  // 원본을 그대로 보여주고 싶다면 그냥 activeLearningUnit.content를 쓰면 됩니다.
  const displayContent = activeLearningUnit?.content || "";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* --- 상단 탭바 (기존 코드 유지) --- */}
      <div className="flex items-center justify-between border-b bg-background">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 px-2 py-1.5 min-w-fit">
            {learningTabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  "group flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors border-b-2 border-transparent min-w-0",
                  activeTabId === tab.id
                    ? "bg-accent text-foreground border-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className="truncate max-w-[200px] text-left flex-1"
                  title={tab.title}
                >
                  {tab.title}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-background/50",
                    activeTabId === tab.id && "opacity-100"
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* 문서 탭 (기존 코드 유지) */}
            {activeDocument && (
              <div className={cn(
                  "flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors border-b-2 border-transparent",
                  !activeTabId && !activeLearningUnit ? "bg-accent text-foreground border-primary" : "text-muted-foreground"
                )}>
                <button onClick={() => setActiveTab(null)} className="truncate max-w-[200px]">{activeDocument.title}</button>
              </div>
            )}
          </div>
        </div>
        {mounted && (
          <div className="px-2 border-l">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* --- 메인 콘텐츠 영역 --- */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeLearningUnit && activeTabId ? (
            activeLearningUnit.type === "quiz" && activeLearningUnit.quiz_data ? (
              <QuizView questions={activeLearningUnit.quiz_data} />
            ) : (
              <Card className="p-6 bg-background border-border">
                {/* 제목 */}
                <h1 className="text-2xl font-bold mb-4 text-foreground">
                  {activeLearningUnit.title}
                </h1>
                
                {/* 타입 뱃지 */}
                <div className="mb-4">
                  <span className={cn(
                    "inline-block px-2.5 py-1 rounded text-xs font-medium",
                    "bg-primary/10 text-primary"
                  )}>
                    {activeLearningUnit.type.toUpperCase()}
                  </span>
                </div>

                {/* ✨✨ [핵심 수정] 추출된 Mermaid 다이어그램 먼저 보여주기 ✨✨ */}
                {mermaidCode && (
                  <div className="mb-8 mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Visual Concept
                    </h3>
                    <div className="flex justify-center p-6 bg-white/50 dark:bg-black/20 rounded-xl border border-border/50 backdrop-blur-sm overflow-hidden shadow-sm">
                      <Mermaid chart={mermaidCode} />
                    </div>
                  </div>
                )}
                
                {/* 텍스트 콘텐츠 (Markdown) */}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      // 코드 블록 처리 (Mermaid가 또 나오면 중복되므로 숨기거나 일반 코드로 표시)
                      code: ({ inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || "");
                        const isMermaid = match && match[1] === "mermaid";
                        
                        // 이미 위에서 크게 그려줬으므로, 본문에서는 숨기거나 텍스트로만 보여줍니다.
                        if (isMermaid) return null; 

                        return !inline ? (
                          <code className={cn("block rounded bg-muted p-3 text-sm overflow-x-auto font-mono", className)} {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={cn("rounded bg-muted/50 px-1.5 py-0.5 text-sm font-mono", className)} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {/* Mermaid 코드를 제거한 텍스트만 보여주고 싶다면 removeMermaidCode(activeLearningUnit.content) 사용 */}
                    {activeLearningUnit.content} 
                  </ReactMarkdown>
                </div>
                
                {/* 수식 (Equations) */}
                {activeLearningUnit.equations && activeLearningUnit.equations.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {activeLearningUnit.equations.map((equation, idx) => (
                      <div key={idx} className="p-4 bg-muted rounded-lg border border-border">
                        <BlockMath math={equation} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          ) : (
            // --- Empty State (기존 코드 유지) ---
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center px-4">
               {/* ... (생략) ... */}
               <Brain className="h-16 w-16 text-primary/60 mb-4" />
               <p className="text-muted-foreground">Select content to view</p>
            </div>
          )}
        </div>
      </ScrollArea>
      <SourcesPanel />
    </div>
  );
}