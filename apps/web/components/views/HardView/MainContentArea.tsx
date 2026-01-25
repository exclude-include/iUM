"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, X, BookOpen, Brain, MessageCircle, Sparkles } from "lucide-react";
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
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

export function MainContentArea() {
  const { activeDocument, learningTabs, activeTabId, setActiveTab, closeTab } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Get the currently active learning unit
  const activeLearningUnit = learningTabs.find((tab) => tab.id === activeTabId);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-select first document when workspace loads
  useEffect(() => {
    // This will be handled by NavigationSidebar when user clicks a tab
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Bar with Tabs */}
      <div className="flex items-center justify-between border-b bg-background">
        {/* Tabs Container - Scrollable */}
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
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {/* Document tab (if activeDocument exists) */}
            {activeDocument && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors border-b-2 border-transparent",
                  !activeTabId && !activeLearningUnit
                    ? "bg-accent text-foreground border-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <button
                  onClick={() => setActiveTab(null)}
                  className="truncate max-w-[200px]"
                  title={activeDocument.title}
                >
                  {activeDocument.title}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Theme Toggle */}
        {mounted && (
          <div className="px-2 border-l">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeLearningUnit && activeTabId ? (
            // Check if this is a quiz type
            activeLearningUnit.type === "quiz" && activeLearningUnit.quiz_data ? (
              <div>
                <div className="mb-4">
                  <h1 className="text-2xl font-bold mb-2 text-foreground">
                    {activeLearningUnit.title}
                  </h1>
                  <span className={cn(
                    "inline-block px-2.5 py-1 rounded text-xs font-medium",
                    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  )}>
                    QUIZ
                  </span>
                </div>
                <QuizView questions={activeLearningUnit.quiz_data} />
              </div>
            ) : (
              <Card className="p-6 bg-background border-border">
              {/* Learning Unit Title */}
              <h1 className="text-2xl font-bold mb-4 text-foreground">
                {activeLearningUnit.title}
              </h1>
              
              {/* Type Badge */}
              <div className="mb-4">
                <span className={cn(
                  "inline-block px-2.5 py-1 rounded text-xs font-medium",
                  activeLearningUnit.type === "math" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                  activeLearningUnit.type === "code" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                  activeLearningUnit.type === "concept" && "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
                  activeLearningUnit.type === "summary" && "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
                  activeLearningUnit.type === "quiz" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                )}>
                  {activeLearningUnit.type.toUpperCase()}
                </span>
              </div>
              
              {/* Markdown Content */}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code: (props: any) => {
                      const { inline, className, children, ...rest } = props;
                      
                      // Check if this is a Mermaid diagram
                      const isMermaid = !inline && className?.includes("language-mermaid");
                      
                      if (isMermaid) {
                        // Extract the chart string (children might be a string or array)
                        const chartString = typeof children === "string" 
                          ? children 
                          : Array.isArray(children)
                          ? children.join("")
                          : String(children);
                        
                        return <Mermaid chart={chartString.trim()} />;
                      }
                      
                      return !inline ? (
                        <code
                          className={cn(
                            "block rounded bg-muted p-3 text-sm overflow-x-auto font-mono",
                            className
                          )}
                          {...rest}
                        >
                          {children}
                        </code>
                      ) : (
                        <code
                          className={cn(
                            "rounded bg-muted/50 px-1.5 py-0.5 text-sm font-mono",
                            className
                          )}
                          {...rest}
                        >
                          {children}
                        </code>
                      );
                    },
                    p: ({ children }: { children?: React.ReactNode }) => (
                      <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                    ),
                    h2: ({ children }: { children?: React.ReactNode }) => (
                      <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>
                    ),
                    h3: ({ children }: { children?: React.ReactNode }) => (
                      <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
                    ),
                    ul: ({ children }: { children?: React.ReactNode }) => (
                      <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
                    ),
                    ol: ({ children }: { children?: React.ReactNode }) => (
                      <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
                    ),
                  }}
                >
                  {activeLearningUnit.content}
                </ReactMarkdown>
              </div>
              
              {/* Equations (if any) - Render after markdown content */}
              {activeLearningUnit.equations && activeLearningUnit.equations.length > 0 && (
                <div className="mt-6 space-y-4">
                  {activeLearningUnit.equations.map((equation, idx) => (
                    <div key={idx} className="p-4 bg-muted rounded-lg border border-border">
                      <BlockMath math={equation} />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Diagram Description (if any) */}
              {activeLearningUnit.diagram_description && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-dashed border-border">
                  <p className="text-sm text-muted-foreground italic">
                    💡 Visual: {activeLearningUnit.diagram_description}
                  </p>
                </div>
              )}
              </Card>
            )
          ) : activeDocument && !activeTabId ? (
            <>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Contents
              </h2>
              <MathContent document={activeDocument} />
            </>
          ) : learningTabs.length === 0 ? (
            // Welcome / Empty State
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center px-4">
              <div className="max-w-md space-y-6">
                {/* Large Icon */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl" />
                    <div className="relative bg-primary/5 rounded-full p-6">
                      <Brain className="h-16 w-16 text-primary/60" />
                    </div>
                  </div>
                </div>
                
                {/* Title */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">
                    Ready to Learn?
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ask iUM a question to generate study materials, diagrams, or quizzes here.
                  </p>
                </div>
                
                {/* Feature Hints */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Concepts</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <Brain className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Diagrams</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Quizzes</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Select a tab to view content
              </p>
              <p className="text-xs text-muted-foreground">
                Click on a tab above to view its content
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Sources Panel */}
      <SourcesPanel />
    </div>
  );
}
