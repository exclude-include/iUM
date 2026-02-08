"use client";

import React, { forwardRef, useRef, useMemo } from "react";
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

// Custom Markdown Renderer Component to reuse logic (no block wrapper)
const MARKDOWN_COMPONENTS_BASE = {
  strong: ({ children }: any) => <strong className="font-bold text-foreground">{children}</strong>,
  ul: ({ children }: any) => <ul className="my-4 space-y-2 list-disc list-outside pl-5">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-4 space-y-2 list-decimal list-outside pl-5">{children}</ol>,
  li: ({ children }: any) => <li className="my-1.5 leading-relaxed pl-1">{children}</li>,
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
};

function CellMarkdownContent({ content, cellId, tabId }: { content: string; cellId: string; tabId: string }) {
  const blockIndexRef = useRef(0);
  const deepHistory = useAppStore((s) => s.deepHistory);
  const setSidebarMode = useAppStore((s) => s.setSidebarMode);
  const setRightPanelMinimized = useAppStore((s) => s.setRightPanelMinimized);
  const setScrollToDeepCardId = useAppStore((s) => s.setScrollToDeepCardId);

  const cardsForThisCell = useMemo(
    () => deepHistory.filter((c) => c.sourceCellId === cellId && c.sourceTabId === tabId),
    [deepHistory, cellId, tabId]
  );

  const blockComponents = useMemo(() => {
    const highlightClass = "rounded-sm border-l-2 border-primary/50 pl-0.5 -ml-0.5 cursor-pointer bg-yellow-200/60 dark:bg-amber-400/25 hover:bg-yellow-300/70 dark:hover:bg-amber-400/35 transition-colors";
    const wrapBlock = (Tag: keyof JSX.IntrinsicElements, className: string, props: any, children: React.ReactNode) => {
      const blockIdx = blockIndexRef.current++;
      const deepCard = cardsForThisCell.find((c) => c.sourceBlockIndex === blockIdx);
      const handleOpenDeep = () => {
        if (deepCard) {
          setScrollToDeepCardId(deepCard.id);
          setSidebarMode("deep");
          setRightPanelMinimized(false);
        }
      };
      const sel = deepCard?.sourceSelectedText?.trim();
      const childArray = React.Children.toArray(children);
      const singleText = childArray.length === 1 && typeof childArray[0] === "string" ? (childArray[0] as string) : null;
      const text = typeof singleText === "string" ? singleText : null;
      const canPartialHighlight = sel && text && text.includes(sel);

      let content: React.ReactNode;
      if (deepCard && canPartialHighlight && text) {
        const idx = text.indexOf(sel!);
        const before = text.slice(0, idx);
        const match = sel!;
        const after = text.slice(idx + match.length);
        content = (
          <Tag className={className} {...props}>
            {before}
            <span
              role="button"
              tabIndex={0}
              onClick={handleOpenDeep}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenDeep();
                }
              }}
              className={highlightClass}
              title="View Deep explanation"
              aria-label="View Deep explanation"
            >
              {match}
            </span>
            {after}
          </Tag>
        );
      } else if (deepCard) {
        content = (
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenDeep}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenDeep();
              }
            }}
            className="rounded-md border-l-2 border-primary/50 pl-1 -ml-1 cursor-pointer bg-yellow-200/60 dark:bg-amber-400/25 hover:bg-yellow-300/70 dark:hover:bg-amber-400/35 transition-colors"
            title="View Deep explanation"
            aria-label="View Deep explanation"
          >
            <Tag className={className} {...props}>{children}</Tag>
          </div>
        );
      } else {
        content = <Tag className={className} {...props}>{children}</Tag>;
      }
      return (
        <div
          key={`block-${blockIdx}`}
          className="group/block"
          data-cell-id={cellId}
          data-tab-id={tabId}
          data-block-index={blockIdx}
        >
          {content}
        </div>
      );
    };
    return {
      ...MARKDOWN_COMPONENTS_BASE,
      p: (props: any) => wrapBlock("p", "my-4 leading-relaxed", props, props.children),
      h1: (props: any) => wrapBlock("h1", "text-2xl font-bold mt-8 mb-4", props, props.children),
      h2: (props: any) => wrapBlock("h2", "text-xl font-bold mt-6 mb-3", props, props.children),
      h3: (props: any) => wrapBlock("h3", "text-lg font-semibold mt-5 mb-2", props, props.children),
      blockquote: (props: any) => {
        const blockIdx = blockIndexRef.current++;
        const deepCard = cardsForThisCell.find((c) => c.sourceBlockIndex === blockIdx);
        const handleOpenDeep = () => {
          if (deepCard) {
            setScrollToDeepCardId(deepCard.id);
            setSidebarMode("deep");
            setRightPanelMinimized(false);
          }
        };
        const children = props.children;
        const sel = deepCard?.sourceSelectedText?.trim();
        const childArray = React.Children.toArray(children);
        const singleText = childArray.length === 1 && typeof childArray[0] === "string" ? (childArray[0] as string) : null;
        const text = typeof singleText === "string" ? singleText : null;
        const canPartialHighlight = sel && text && text.includes(sel);
        const blockquoteClass = "my-6 pl-4 border-l-4 border-primary/50 italic text-muted-foreground";
        let content: React.ReactNode;
        if (deepCard && canPartialHighlight && text) {
          const idx = text.indexOf(sel!);
          content = (
            <blockquote className={blockquoteClass} {...props}>
              {text.slice(0, idx)}
              <span
                role="button"
                tabIndex={0}
                onClick={handleOpenDeep}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenDeep();
                  }
                }}
                className={highlightClass}
                title="View Deep explanation"
                aria-label="View Deep explanation"
              >
                {sel}
              </span>
              {text.slice(idx + sel!.length)}
            </blockquote>
          );
        } else if (deepCard) {
          content = (
            <div
              role="button"
              tabIndex={0}
              onClick={handleOpenDeep}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenDeep();
                }
              }}
              className="rounded-md border-l-2 border-primary/50 pl-1 -ml-1 cursor-pointer bg-yellow-200/60 dark:bg-amber-400/25 hover:bg-yellow-300/70 dark:hover:bg-amber-400/35 transition-colors"
              title="View Deep explanation"
              aria-label="View Deep explanation"
            >
              <blockquote className={blockquoteClass} {...props} />
            </div>
          );
        } else {
          content = <blockquote className={blockquoteClass} {...props} />;
        }
        return (
          <div
            key={`block-${blockIdx}`}
            className="group/block"
            data-cell-id={cellId}
            data-tab-id={tabId}
            data-block-index={blockIdx}
          >
            {content}
          </div>
        );
      },
    };
  }, [cellId, tabId, cardsForThisCell, setScrollToDeepCardId, setSidebarMode, setRightPanelMinimized]);

  // Reset block index at start of each render so order is stable
  blockIndexRef.current = 0;

  return (
    <div
      className={cn(
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
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={blockComponents}
      >
        {preprocessContent(content) || "No content available."}
      </ReactMarkdown>
    </div>
  );
}

interface CellRendererProps {
  cell: Cell;
  tabId: string;
}

export const CellRenderer = forwardRef<HTMLDivElement, CellRendererProps>(
  ({ cell, tabId }, ref) => {
    // ✨ [Performance] Use selectors to avoid re-rendering on every store update
    const deleteCell = useAppStore((state) => state.deleteCell);
    const toggleBookmark = useAppStore((state) => state.toggleBookmark);
    const moveCellToNewTab = useAppStore((state) => state.moveCellToNewTab);

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
      <div ref={ref} data-cell-id={cell.id} className="group relative w-full max-w-full min-w-0">
        {/* ✨ New Static Header Layout */}
        <Card className={cn(
          "bg-background border-border transition-all w-full max-w-full overflow-hidden flex flex-col",
          cell.isBookmarked && "border-l-4 border-l-primary"
        )}>
          {/* Header Row: Title + Menu */}
          <div className="flex items-start justify-between gap-2 border-b px-4 py-2.5 bg-muted/5 min-h-[44px]">
            {/* Title: Truncate if too long */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="font-bold text-base truncate pr-2" title={cell.title}>
                {cell.title}
              </h3>
            </div>
            {/* Toolbar: Fixed width, prioritized */}
            <CellToolbar
              cellType={cell.type}
              isBookmarked={cell.isBookmarked}
              onDelete={handleDelete}
              onBookmark={handleBookmark}
              onMoveToNewTab={handleMoveToNewTab}
              floating={false} // Static mode
              className="shrink-0"
            />
          </div>

          <div className="p-5 w-full max-w-full overflow-hidden">
            {cell.type === "quiz" && cell.quiz_data ? (
              <QuizView questions={cell.quiz_data} />
            ) : (
              <CellContent cell={cell} hideTitle tabId={tabId} />
            )}
          </div>
        </Card>
      </div>
    );
  }
);


CellRenderer.displayName = "CellRenderer";

// Preprocess content to keep short inline math inline
// remark-math treats $...$ on its own line as display math
// This function merges short standalone math with adjacent text
// ... (imports)

// Preprocess content to keep short inline math inline
// remark-math treats $...$ on its own line as display math
// This function merges short standalone math with adjacent text
// ✨ [Fixed] Fix common LLM markdown errors
function preprocessContent(content: string): string {
  if (!content) return content;

  let s = content.trim();

  // 0a. If content is raw JSON (e.g. {"text_content": "..."}), extract the text so we don't display JSON
  if (s.startsWith("{") && (s.includes('"text_content"') || s.includes("text_content"))) {
    try {
      const firstBrace = s.indexOf("{");
      const lastBrace = s.lastIndexOf("}");
      if (lastBrace > firstBrace) {
        const jsonStr = s.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed.text_content === "string") {
          s = parsed.text_content;
        }
      }
    } catch (_) {
      // Not valid JSON, use as-is
    }
  }

  // 0. Convert literal \n, \r, \t to actual newlines/tabs so content is properly formatted
  s = s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");

  // 0b. Unescape math delimiters so $...$ and \(...\) render (API may send \$ or \\( \\))
  s = s
    .replace(/\\\$/g, "$")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)");

  // 0b. Normalize inline math: remove spaces right after $ or before $ so " $ CO_2 $ " parses
  s = s.replace(/\$\s+/g, "$").replace(/\s+\$/g, "$");

  // 1. Remove space after opening ** (e.g. "** text" -> "**text")
  const fixedContent = s
    .replace(/\*\*[ \t]+/g, '**')
    .replace(/\\\*\\\*/g, '**'); // \*\* -> **

  const lines = fixedContent.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; // ✨ [Fixed] Don't trim immediately to preserve indentation
    const trimmedLine = line.trim();

    // Check if line is ONLY inline math (single $...$, not $$...$$)
    // and is relatively short (likely should be inline)
    const inlineMathOnlyMatch = trimmedLine.match(/^\$([^$]+)\$$/);

    if (inlineMathOnlyMatch && !trimmedLine.startsWith('$$') && trimmedLine.length < 50) {
      // This is short inline math on its own line
      // Merge with previous line if exists and not empty
      if (result.length > 0 && result[result.length - 1].trim() !== '') {
        result[result.length - 1] = result[result.length - 1] + ' ' + trimmedLine;
      } else {
        result.push(line);
      }
    } else {
      // ✨ [Fix] Handle specific spacing issues in lines
      // Remove space between ** and char: "** T" -> "**T" 
      // But only if it looks like a start of bold.
      // Doing this line by line is safer.
      result.push(line.replace(/(\*\*)\s+(?=\S)/g, '$1').replace(/(?<=\S)\s+(\*\*)/g, '$1'));
      // Actually, regex lookbehind/ahead support?
      // Simpler: Just rely on ReactMarkdown's robustness? No it failed.
      // Let's manually fix "** " -> "**" at start of bold?
      // It is hard to know if it is start or end without parsing.
      // However, "** text **" is definitely wrong.
      // Let's just fix the basic `\*\*` case first which is most likely the culprit if user sees literal stars.
    }
  }

  return result.join('\n');
}

// Separate component for non-quiz cell content
// Custom Markdown Renderer Component to reuse logic


function CellContent({ cell, hideTitle, tabId }: { cell: Cell; hideTitle?: boolean; tabId: string }) {
  // 1. GraphData (New Reactflow)
  if (cell.graph_data) {
    return (
      <div className="w-full">
        {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
        {cell.diagram_description && (
          <p className="text-sm text-muted-foreground mb-4">{cell.diagram_description}</p>
        )}
        <FlowChart data={cell.graph_data!} />
        {cell.content && <div className="mt-8"><CellMarkdownContent content={cell.content} cellId={cell.id} tabId={tabId} /></div>}
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
        {cell.content && <div className="mt-8"><CellMarkdownContent content={cell.content} cellId={cell.id} tabId={tabId} /></div>}
      </div>
    );
  }

  // 3. Default Text Content
  return (
    <div className="w-full">
      {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
      <div className="mt-1">
        <CellMarkdownContent content={cell.content || ""} cellId={cell.id} tabId={tabId} />
      </div>

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
    </div>
  );
}
