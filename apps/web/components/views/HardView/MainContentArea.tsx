"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MathContent } from "./MathContent";
import { SourcesPanel } from "./SourcesPanel";
import { QuizView } from "@/components/QuizView";
import { Mermaid } from "@/components/Mermaid"; // Mermaid 컴포넌트 임포트 확인 필요
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

// 헬퍼 함수들은 이제 필요 없으므로 삭제하거나 무시해도 됩니다.

export function MainContentArea() {
  const { activeDocument, learningTabs, activeTabId, setActiveTab, closeTab } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // 타입 캐스팅
  const activeLearningUnit = learningTabs.find((tab) => tab.id === activeTabId) as any;

  useEffect(() => {
    setMounted(true);
  }, []);

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
                    "bg-primary/10 text-primary uppercase"
                  )}>
                    {activeLearningUnit.type}
                  </span>
                </div>

                {/* ❌ 삭제됨: 맨 위에 강제로 그리던 Mermaid 블록 삭제 */}
                
                {/* 텍스트 콘텐츠 (Markdown) */}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      // ✨✨ [핵심 수정] 코드 블록을 만났을 때, 언어가 'mermaid'면 바로 그리기
                      code: (props: any) => {
                        const { inline, className, children, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || "");
                        const isMermaid = match && match[1] === "mermaid";
                        
                        // 내용 추출
                        const content = String(children).replace(/\n$/, "");

                        if (!inline && isMermaid) {
                          // 본문 중간에 Mermaid 컴포넌트 렌더링
                          return (
                            <div className="my-6 flex justify-center p-4 bg-white/50 dark:bg-black/20 rounded-lg border border-border/50 overflow-hidden">
                              <Mermaid chart={content} />
                            </div>
                          );
                        }

                        return !inline ? (
                          <code className={cn("block rounded bg-muted p-3 text-sm overflow-x-auto font-mono", className)} {...rest}>
                            {children}
                          </code>
                        ) : (
                          <code className={cn("rounded bg-muted/50 px-1.5 py-0.5 text-sm font-mono", className)} {...rest}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {activeLearningUnit.content || "No content available."}
                  </ReactMarkdown>
                </div>
                
                {/* 수식 (Equations) */}
                {activeLearningUnit.equations && activeLearningUnit.equations.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {activeLearningUnit.equations.map((equation: string, idx: number) => (
                      <div key={idx} className="p-4 bg-muted rounded-lg border border-border">
                        <BlockMath math={equation} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          ) : activeDocument && !activeTabId ? (
             <MathContent document={activeDocument} />
          ) : (
             <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center px-4">
               <p className="text-muted-foreground">Select content to view</p>
            </div>
          )}
        </div>
      </ScrollArea>
      <SourcesPanel />
    </div>
  );
}