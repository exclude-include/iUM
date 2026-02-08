"use client";

import { forwardRef } from "react";
import { Card } from "@/components/ui/card";
import { QuizView } from "@/components/QuizView";
import { Mermaid } from "@/components/Mermaid";
import { CellToolbar } from "./CellToolbar";
import { cn } from "@/lib/utils";
import { useAppStore, type Cell } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

interface CellRendererProps {
  cell: Cell;
  tabId: string;
}

export const CellRenderer = forwardRef<HTMLDivElement, CellRendererProps>(
  ({ cell, tabId }, ref) => {
    const { deleteCell, toggleBookmark, moveCellToNewTab } = useAppStore();

    const handleDelete = () => {
      deleteCell(tabId, cell.id);
    };

    const handleBookmark = () => {
      toggleBookmark(tabId, cell.id);
    };

    const handleMoveToNewTab = () => {
      moveCellToNewTab(tabId, cell.id);
    };

    return (
      <div ref={ref} className="group relative">
        {/* Cell Toolbar - appears on hover */}
        <CellToolbar
          cellType={cell.type}
          isBookmarked={cell.isBookmarked}
          onDelete={handleDelete}
          onBookmark={handleBookmark}
          onMoveToNewTab={handleMoveToNewTab}
        />

        {/* Cell Content */}
        <Card className={cn(
          "p-6 bg-background border-border transition-all",
          cell.isBookmarked && "border-l-4 border-l-primary"
        )}>
          {cell.type === "quiz" && cell.quiz_data ? (
            <QuizView questions={cell.quiz_data} />
          ) : (
            <CellContent cell={cell} />
          )}
        </Card>
      </div>
    );
  }
);

CellRenderer.displayName = "CellRenderer";

// Separate component for non-quiz cell content
function CellContent({ cell }: { cell: Cell }) {
  return (
    <>
      {/* Title */}
      <h2 className="text-xl font-bold mb-3 text-foreground">
        {cell.title}
      </h2>

      {/* Markdown Content */}
      <div className="prose prose-sm max-w-none dark:prose-invert break-words min-w-0">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: (props: any) => {
              const { inline, className, children, ...rest } = props;
              const match = /language-(\w+)/.exec(className || "");
              const isMermaid = match && match[1] === "mermaid";

              const content = String(children).replace(/\n$/, "");

              if (!inline && isMermaid) {
                return (
                  <div className="my-6 flex justify-center p-4 bg-white/50 dark:bg-black/20 rounded-lg border border-border/50 overflow-hidden">
                    <Mermaid chart={content} />
                  </div>
                );
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
          }}
        >
          {cell.content || "No content available."}
        </ReactMarkdown>
      </div>

      {/* Equations */}
      {cell.equations && cell.equations.length > 0 && (
        <div className="mt-6 space-y-4">
          {cell.equations.map((equation, idx) => (
            <div key={idx} className="p-4 bg-muted rounded-lg border border-border">
              <BlockMath math={equation} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
