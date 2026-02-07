"use client";

import { useState } from "react";
import { BookOpen, Code, Zap, ExternalLink, FileText, PanelBottomClose, PanelBottomOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

type Tab = "sources" | "generated" | "tools";

export function SourcesPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("sources");
  
  // ✨ [핵심] 전역 스토어에서 AI가 답변에 사용한 출처 목록을 실시간으로 가져옵니다.
  const { activeSources, bottomPanelMinimized, setBottomPanelMinimized } = useAppStore();

  // 최소화 시 탭 바 + 복원 버튼만 표시
  if (bottomPanelMinimized) {
    return (
      <div className="h-full border-t bg-background flex flex-col min-h-[40px]">
        <div className="flex items-center justify-between border-b px-2 py-1.5 bg-muted/30 flex-1 min-h-0">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setActiveTab("sources")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground rounded-t"
            >
              <BookOpen className="h-3 w-3" />
              Sources
            </button>
            <button
              onClick={() => setActiveTab("generated")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground rounded-t"
            >
              <Code className="h-3 w-3" />
              Generated
            </button>
            <button
              onClick={() => setActiveTab("tools")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground rounded-t"
            >
              <Zap className="h-3 w-3" />
              Quick tools
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setBottomPanelMinimized(false)}
            title="Expand panel"
          >
            <PanelBottomOpen className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[120px] border-t bg-background flex flex-col">
      {/* --- 탭 헤더 --- */}
      <div className="flex items-center justify-between border-b px-2 bg-muted/30">
        <div className="flex items-center">
        <button
          onClick={() => setActiveTab("sources")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors border-b-2",
            activeTab === "sources"
              ? "border-primary text-foreground bg-background"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Sources
          {activeSources.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]">
              {activeSources.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("generated")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors border-b-2",
            activeTab === "generated"
              ? "border-primary text-foreground bg-background"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Code className="h-3.5 w-3.5" />
          Generated
        </button>
        <button
          onClick={() => setActiveTab("tools")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors border-b-2",
            activeTab === "tools"
              ? "border-primary text-foreground bg-background"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          Quick tools
        </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setBottomPanelMinimized(true)}
          title="Minimize panel"
        >
          <PanelBottomClose className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
        </Button>
      </div>

      {/* --- 탭 컨텐츠 영역 --- */}
      <div className="flex-1 overflow-hidden bg-background">
        {activeTab === "sources" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {activeSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
                  <BookOpen className="h-10 w-10 mb-3 opacity-10" />
                  <p className="text-xs">No sources cited in the last response.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    (General knowledge or direct answers won't show sources)
                  </p>
                </div>
              ) : (
                activeSources.map((source, idx) => (
                  <div
                    key={source.id || idx}
                    className="group flex flex-col gap-1 rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="shrink-0 rounded-md bg-primary/10 p-1.5">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h4 className="text-sm font-medium leading-none truncate" title={source.title}>
                          {source.title}
                        </h4>
                      </div>
                      
                      {/* 외부 링크가 있는 경우 버튼 표시 */}
                      {source.url && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" asChild>
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                    
                    {/* 출처 내용 미리보기 */}
                    <p className="text-xs text-muted-foreground line-clamp-2 pl-9 leading-relaxed">
                      {source.content}
                    </p>
                    
                    {/* 관련성 점수 (있는 경우) */}
                    {source.relevance_score && (
                      <div className="flex justify-end mt-1">
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                          Similarity: {Math.round(source.relevance_score * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === "generated" && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <Code className="h-8 w-8 opacity-20" />
            <p>Generated artifacts (files, charts) will appear here.</p>
          </div>
        )}

        {activeTab === "tools" && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <Zap className="h-8 w-8 opacity-20" />
            <p>Quick actions and tools will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}