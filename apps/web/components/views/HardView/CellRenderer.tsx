"use client";

import { forwardRef } from "react";
import { Card } from "@/components/ui/card";
import { QuizView } from "@/components/QuizView";
import { Mermaid } from "@/components/Mermaid";
import { FlowChart } from "@/components/FlowChart";
import { CellToolbar } from "./CellToolbar";
import { cn } from "@/lib/utils";
import { useAppStore, type Cell } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { BlockMath, InlineMath } from "react-katex";
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
      <div ref={ref} className="group relative w-full max-w-full min-w-0">
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
          "p-6 bg-background border-border transition-all w-full max-w-full overflow-hidden",
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

// Preprocess content to keep short inline math inline
// remark-math treats $...$ on its own line as display math
// This function merges short standalone math with adjacent text
function preprocessContent(content: string): string {
  if (!content) return content;

  const lines = content.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if line is ONLY inline math (single $...$, not $$...$$)
    // and is relatively short (likely should be inline)
    const inlineMathOnlyMatch = line.match(/^\$([^$]+)\$$/);

    if (inlineMathOnlyMatch && !line.startsWith('$$') && line.length < 50) {
      // This is short inline math on its own line
      // Merge with previous line if exists and not empty
      if (result.length > 0 && result[result.length - 1].trim() !== '') {
        result[result.length - 1] = result[result.length - 1] + ' ' + line;
      } else {
        result.push(line);
      }
    } else {
      result.push(lines[i]);
    }
  }

  return result.join('\n');
}

// Separate component for non-quiz cell content
// Custom Markdown Renderer Component to reuse logic
const MarkdownContent = ({ content }: { content: string }) => (
  <div className={cn(
    "prose prose-base max-w-none dark:prose-invert break-words min-w-0 cell-content",
    "overflow-x-auto overflow-y-visible w-full",
    "[&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
    "[&_pre]:max-w-full [&_pre]:overflow-x-auto",
    "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
    "prose-p:my-4 prose-p:leading-relaxed",
    "prose-headings:mt-8 prose-headings:mb-4",
    "prose-ul:my-4 prose-ol:my-4",
    "prose-li:my-2",
    "prose-blockquote:my-6",
    "prose-pre:my-6",
    "prose-hr:my-8"
  )}>
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      components={{
        p: ({ children }) => <p className="my-4 leading-relaxed">{children}</p>,
        h1: ({ children }) => <h1 className="text-2xl font-bold mt-8 mb-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-semibold mt-5 mb-2">{children}</h3>,
        ul: ({ children }) => <ul className="my-4 space-y-2 list-disc list-inside">{children}</ul>,
        ol: ({ children }) => <ol className="my-4 space-y-2 list-decimal list-inside">{children}</ol>,
        li: ({ children }) => <li className="my-1.5 leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-6 pl-4 border-l-4 border-primary/50 italic text-muted-foreground">{children}</blockquote>
        ),
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
            <code className={cn("block rounded bg-muted p-3 text-sm overflow-x-auto font-mono my-4", className)} {...rest}>{children}</code>
          ) : (
            <code className={cn("rounded bg-muted/50 px-1.5 py-0.5 text-sm font-mono", className)} {...rest}>{children}</code>
          );
        },
      }}
    >
      {preprocessContent(content) || "No content available."}
    </ReactMarkdown>
  </div>
);

function CellContent({ cell }: { cell: Cell }) {
  // 1. GraphData (New Reactflow)
  if (cell.graph_data) {
    return (
      <div className="w-full">
        <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>
        {cell.diagram_description && (
          <p className="text-sm text-muted-foreground mb-4">{cell.diagram_description}</p>
        )}
        <FlowChart data={cell.graph_data} />
        {cell.content && <div className="mt-8"><MarkdownContent content={cell.content} /></div>}
      </div>
    );
  }

  // 2. Mermaid Diagram (Legacy)
  if (cell.mermaid_code) {
    return (
      <div className="w-full">
        <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>
        {cell.diagram_description && (
          <p className="text-sm text-muted-foreground mb-4">{cell.diagram_description}</p>
        )}
        <div className="my-6 flex justify-center p-4 bg-white/50 dark:bg-black/20 rounded-lg border border-border/50 overflow-hidden">
          <Mermaid chart={cell.mermaid_code} />
        </div>
        {cell.content && <div className="mt-8"><MarkdownContent content={cell.content} /></div>}
      </div>
    );
  }

  // 3. Standard Content
  return (
    <>
      <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>
      <MarkdownContent content={cell.content} />

      {/* Equations */}
      {cell.equations && cell.equations.length > 0 && (
        <div className="mt-6 space-y-4">
          {cell.equations.map((equation, idx) => (
            <div key={idx} className="p-4 bg-muted rounded-lg border border-border overflow-x-auto">
              {typeof equation === 'string' ? (
                <BlockMath
                  math={equation}
                  renderError={(err) => {
                    console.error("KaTeX Error:", err, equation);
                    return <span className="text-destructive font-mono text-sm">LaTeX Error: {err.message}</span>;
                  }}
                />
              ) : (
                <code className="text-xs text-destructive">Invalid equation format: {JSON.stringify(equation)}</code>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
