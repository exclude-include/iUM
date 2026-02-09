"use client";

import React, { forwardRef, useRef, useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { QuizView } from "@/components/QuizView";
import { FlowChart } from "@/components/FlowChart";
import { FlashcardView } from "@/components/FlashcardView"; // ✨
import { CellToolbar } from "./CellToolbar";
import { SpreadsheetPreview } from "./SpreadsheetPreview";
import { cn } from "@/lib/utils";
import { useAppStore, type Cell } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSocialStore } from "@/components/SocialMode/useSocialStore";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { Loader2, Copy, Check, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";

// ✨ Text/Code File Preview Component
function TextFilePreview({ fileUrl, fileName, language }: { fileUrl: string; fileName: string; language: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lineNumbers, setLineNumbers] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        // Add inline=true to get content without triggering download
        const urlWithInline = fileUrl.includes('?') ? `${fileUrl}&inline=true` : `${fileUrl}?inline=true`;
        const response = await fetch(urlWithInline);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [fileUrl]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const lines = content?.split('\n') || [];
  const lineCount = lines.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading file...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-destructive/10">
        <p className="text-sm text-destructive">{error}</p>
        <a 
          href={fileUrl}
          download={fileName}
          className="inline-block mt-2 text-xs text-primary hover:underline"
        >
          Download instead
        </a>
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setLineNumbers(!lineNumbers)}
        >
          {lineNumbers ? 'Hide' : 'Show'} Lines
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      
      {/* Code Display */}
      <div className="max-h-[500px] overflow-auto bg-[#1e1e1e] dark:bg-[#0d1117]">
        <div className="flex">
          {/* Line Numbers */}
          {lineNumbers && (
            <div className="shrink-0 select-none py-4 pl-4 pr-3 text-right text-xs font-mono text-gray-500 border-r border-gray-700">
              {lines.map((_, idx) => (
                <div key={idx} className="leading-6">{idx + 1}</div>
              ))}
            </div>
          )}
          
          {/* Code Content */}
          <pre className="flex-1 py-4 px-4 overflow-x-auto">
            <code className="text-sm font-mono text-gray-200 leading-6 whitespace-pre">
              {content}
            </code>
          </pre>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5" />
          <span>{language.toUpperCase()}</span>
        </div>
        <span>{lineCount} lines</span>
      </div>
    </div>
  );
}

// Custom Markdown Renderer Component to reuse logic (no block wrapper)
const MARKDOWN_COMPONENTS_BASE = {
  strong: ({ children }: any) => <strong className="font-bold text-foreground">{children}</strong>,
  ul: ({ children }: any) => <ul className="my-4 space-y-2 list-disc list-outside pl-5">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-4 space-y-2 list-decimal list-outside pl-5">{children}</ol>,
  li: ({ children }: any) => <li className="my-1.5 leading-relaxed pl-1">{children}</li>,
  code: (props: any) => {
    const { inline, className, children, ...rest } = props;
    return !inline ? (
      <code className={cn("block rounded bg-muted p-3 text-sm overflow-x-auto font-mono my-4", className)} {...rest}>{children}</code>
    ) : (
      <code className={cn("rounded bg-muted/50 px-1.5 py-0.5 text-sm font-mono", className)} {...rest}>{children}</code>
    );
  },
  // ✨ Beautiful Table Styling for Markdown Tables
  table: ({ children }: any) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-border/60 shadow-sm">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-gradient-to-r from-muted/80 to-muted/60">{children}</thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-border/40">{children}</tbody>
  ),
  tr: ({ children, ...props }: any) => {
    // Check if this is a header row (inside thead) by looking at children
    const isHeaderRow = React.Children.toArray(children).some(
      (child: any) => child?.type === 'th' || child?.props?.node?.tagName === 'th'
    );
    return (
      <tr 
        className={cn(
          "transition-colors",
          !isHeaderRow && "hover:bg-primary/5 even:bg-muted/20"
        )} 
        {...props}
      >
        {children}
      </tr>
    );
  },
  th: ({ children }: any) => (
    <th className="px-4 py-3.5 text-left font-semibold text-foreground border-b-2 border-border/70 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-4 py-3 text-muted-foreground whitespace-pre-wrap break-words">
      {children}
    </td>
  ),
};

/** Recursively get plain text from React children (for partial highlight matching) */
function getTextFromChildren(node: React.ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextFromChildren).join("");
  if (React.isValidElement(node) && node.props?.children != null) return getTextFromChildren(node.props.children);
  return "";
}

/**
 * Wrap only the selected substring in React children. Uses character offset so
 * only the dragged part is highlighted, not the whole paragraph.
 * renderHighlight(portion: string) is called for each text segment that is part of the selection.
 */
function wrapSelectedTextInChildren(
  children: React.ReactNode,
  sel: string,
  renderHighlight: (portion: string) => React.ReactNode
): React.ReactNode {
  const full = getTextFromChildren(children);
  const start = full.indexOf(sel);
  if (start === -1) return children;

  let offset = 0;
  function walk(node: React.ReactNode): React.ReactNode {
    if (node == null) return null;
    if (typeof node === "string") {
      const end = offset + node.length;
      if (end <= start) {
        offset = end;
        return node;
      }
      if (offset >= start + sel.length) {
        return node;
      }
      const localStart = Math.max(0, start - offset);
      const localEnd = Math.min(node.length, start + sel.length - offset);
      const portion = node.slice(localStart, localEnd);
      offset = end;
      if (portion.length === 0) return node;
      return (
        <>
          {localStart > 0 ? node.slice(0, localStart) : null}
          {renderHighlight(portion)}
          {localEnd < node.length ? node.slice(localEnd) : null}
        </>
      );
    }
    if (typeof node === "number") {
      const s = String(node);
      offset += s.length;
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((child) => walk(child));
    }
    if (React.isValidElement(node) && node.props?.children != null) {
      const inner = node.props.children;
      const newChildren = walk(inner);
      if (newChildren === inner) return node;
      return React.cloneElement(node, { children: newChildren });
    }
    return node;
  }

  return walk(children);
}

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
      const fullText = getTextFromChildren(children);
      const canPartialHighlight = sel && fullText.includes(sel);

      let content: React.ReactNode;
      if (deepCard && canPartialHighlight && sel) {
        const wrappedChildren = wrapSelectedTextInChildren(
          children,
          sel,
          (portion) => (
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
              {portion}
            </span>
          )
        );
        content = <Tag className={className} {...props}>{wrappedChildren}</Tag>;
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
        const fullText = getTextFromChildren(children);
        const canPartialHighlight = sel && fullText.includes(sel);
        const blockquoteClass = "my-6 pl-4 border-l-4 border-primary/50 italic text-muted-foreground";
        let content: React.ReactNode;
        if (deepCard && canPartialHighlight && sel) {
          const wrappedChildren = wrapSelectedTextInChildren(
            children,
            sel,
            (portion) => (
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
                {portion}
              </span>
            )
          );
          content = <blockquote className={blockquoteClass} {...props}>{wrappedChildren}</blockquote>;
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
        // Remove default prose table styles - we handle it with custom components
        "prose-table:my-0",
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
    const { toast } = useToast();
    const [isCreatingReel, setIsCreatingReel] = useState(false);

    // ✨ [Performance] Use selectors to avoid re-rendering on every store update
    const deleteCell = useAppStore((state) => state.deleteCell);
    const toggleBookmark = useAppStore((state) => state.toggleBookmark);
    const moveCellToNewTab = useAppStore((state) => state.moveCellToNewTab);

    const moveCell = useAppStore((state) => state.moveCell);

    // ✨ Determine if cell can move up or down
    const activeTab = useAppStore((state) => state.notebookTabs.find(t => t.id === tabId));
    const cellIndex = useMemo(() => activeTab?.cells.findIndex(c => c.id === cell.id) ?? -1, [activeTab, cell.id]);
    const canMoveUp = cellIndex > 0;
    const canMoveDown = activeTab ? cellIndex < activeTab.cells.length - 1 : false;

    const handleDelete = () => {
      deleteCell(tabId, cell.id);
    };

    const handleBookmark = () => {
      toggleBookmark(tabId, cell.id);
    };

    const handleMoveToNewTab = () => {
      moveCellToNewTab(tabId, cell.id);
    };

    const handleMoveUp = () => {
      moveCell(tabId, cell.id, 'up');
    };

    const handleMoveDown = () => {
      moveCell(tabId, cell.id, 'down');
    };

    const handleCreateReel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", description: "Sign in to create a reel from this cell.", variant: "destructive" });
        return;
      }
      const cellContent = cell.content?.trim() || cell.title || "Untitled";
      if (!cellContent) {
        toast({ title: "No content", description: "This cell has no content to create a reel from.", variant: "destructive" });
        return;
      }
      setIsCreatingReel(true);
      try {
        const payload: { user_id: string; cell_content: string; cell_title?: string; quiz_data?: any[] } = {
          user_id: user.id,
          cell_content: cellContent,
          cell_title: cell.title || undefined,
        };
        if (cell.quiz_data && cell.quiz_data.length > 0) {
          payload.quiz_data = cell.quiz_data.map((q) => ({
            question_text: q.question_text,
            options: q.options.map((o) => ({ id: o.id, text: o.text, is_correct: o.is_correct })),
            explanation: q.explanation,
          }));
        }
        const res = await api.reels.createFromCell(payload);
        if (res?.success) {
          await useSocialStore.getState().loadReelsFromSupabase();
          toast({ title: "Reel created", description: "Reel added to Soft mode. Check the Reels tab." });
        } else {
          toast({ title: "Failed to create reel", description: (res as any)?.message || "Please try again.", variant: "destructive" });
        }
      } catch (e) {
        toast({ title: "Failed to create reel", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
      } finally {
        setIsCreatingReel(false);
      }
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
              onCreateReel={isCreatingReel ? undefined : handleCreateReel}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
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




  // 2. Flashcard (New)
  if (cell.type === "flashcard" && cell.flashcard_data && cell.flashcard_data.length > 0) {
    return (
      <div className="w-full">
        {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
        <FlashcardView cards={cell.flashcard_data} />
        {cell.content && <div className="mt-8 text-sm text-muted-foreground"><CellMarkdownContent content={cell.content} cellId={cell.id} tabId={tabId} /></div>}
      </div>
    );
  }

  // 2b. Flashcard (Error/Fallback)
  if (cell.type === "flashcard") {
    return (
      <div className="w-full">
        {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
        <div className="p-4 border border-dashed rounded-lg bg-muted/30 text-center text-sm text-muted-foreground mb-4">
          Unable to render flashcards. Displaying raw content below.
        </div>
        <div className="mt-1">
          <CellMarkdownContent content={cell.content || ""} cellId={cell.id} tabId={tabId} />
        </div>
      </div>
    );
  }

  // 3. Report (보고서) - Styled document with sections
  if (cell.type === "report") {
    return (
      <div className="w-full">
        {!hideTitle && (
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <h2 className="text-xl font-bold text-foreground">{cell.title}</h2>
          </div>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <CellMarkdownContent content={cell.content || ""} cellId={cell.id} tabId={tabId} />
        </div>
      </div>
    );
  }

  // 4. Table (표) - Structured table view with beautiful styling
  if (cell.type === "table") {
    return (
      <div className="w-full">
        {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
        {cell.table_data && cell.table_data.headers && cell.table_data.rows ? (
          <div className="overflow-x-auto rounded-xl border border-border/60 shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-muted/80 to-muted/60">
                  {cell.table_data.headers.map((header, idx) => (
                    <th 
                      key={idx} 
                      className={cn(
                        "px-4 py-3.5 text-left font-semibold text-foreground",
                        "border-b-2 border-border/70",
                        "whitespace-nowrap",
                        idx === 0 && "rounded-tl-xl",
                        idx === cell.table_data!.headers.length - 1 && "rounded-tr-xl"
                      )}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {cell.table_data.rows.map((row, rowIdx) => (
                  <tr 
                    key={rowIdx} 
                    className={cn(
                      "transition-colors",
                      rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20",
                      "hover:bg-primary/5"
                    )}
                  >
                    {row.map((cellValue, cellIdx) => (
                      <td 
                        key={cellIdx} 
                        className={cn(
                          "px-4 py-3 text-muted-foreground",
                          "whitespace-pre-wrap break-words",
                          // First column styling (often labels/headers)
                          cellIdx === 0 && "font-medium text-foreground",
                          // Last row styling
                          rowIdx === cell.table_data!.rows.length - 1 && cellIdx === 0 && "rounded-bl-xl",
                          rowIdx === cell.table_data!.rows.length - 1 && cellIdx === row.length - 1 && "rounded-br-xl"
                        )}
                      >
                        {cellValue}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Fallback: render content as markdown table
          <CellMarkdownContent content={cell.content || ""} cellId={cell.id} tabId={tabId} />
        )}
      </div>
    );
  }

  // 5. File Preview (파일 미리보기) - PDF, Image, Video, Audio, Text/Code support
  if (cell.type === "file-preview") {
    const fp = cell.file_preview;
    const fileType = fp?.fileType || '';
    const fileName = fp?.fileName || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    const isImage = fileType.startsWith('image/');
    const isVideo = fileType.startsWith('video/');
    const isAudio = fileType.startsWith('audio/');
    const isPdf = fileType === 'application/pdf';
    
    // Spreadsheet detection (Excel, CSV)
    const spreadsheetExtensions = ['xlsx', 'xls', 'csv', 'xlsm', 'xlsb', 'ods'];
    const spreadsheetMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];
    const isSpreadsheet = spreadsheetExtensions.includes(ext) || 
                          spreadsheetMimeTypes.some(t => fileType.includes(t));
    
    // Text/Code file detection (exclude CSV as it's handled as spreadsheet)
    const textMimeTypes = ['text/', 'application/json', 'application/xml', 'application/javascript'];
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'sql', 'r', 'lua', 'perl', 'pl'];
    const textExtensions = ['txt', 'md', 'markdown', 'log', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'gitignore', 'dockerignore', 'editorconfig', 'html', 'htm', 'css', 'scss', 'sass', 'less'];
    
    const isTextOrCode = !isSpreadsheet && (textMimeTypes.some(t => fileType.startsWith(t)) || 
                         codeExtensions.includes(ext) || 
                         textExtensions.includes(ext));
    
    // Get file extension for display
    const getExtBadge = () => {
      const extUpper = ext.toUpperCase() || 'FILE';
      return extUpper.slice(0, 4);
    };
    
    // Get language for syntax hint
    const getLanguageHint = () => {
      const langMap: Record<string, string> = {
        'js': 'JavaScript', 'ts': 'TypeScript', 'jsx': 'React JSX', 'tsx': 'React TSX',
        'py': 'Python', 'java': 'Java', 'c': 'C', 'cpp': 'C++', 'cs': 'C#',
        'go': 'Go', 'rs': 'Rust', 'rb': 'Ruby', 'php': 'PHP', 'swift': 'Swift',
        'kt': 'Kotlin', 'sql': 'SQL', 'sh': 'Shell', 'bash': 'Bash',
        'json': 'JSON', 'xml': 'XML', 'yaml': 'YAML', 'yml': 'YAML',
        'md': 'Markdown', 'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS',
      };
      return langMap[ext] || ext.toUpperCase();
    };

    return (
      <div className="w-full">
        {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
        {fp && fp.fileUrl ? (
          <div className="rounded-lg border overflow-hidden bg-background">
            {/* File Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold uppercase",
                isImage && "bg-green-500/10 text-green-600",
                isVideo && "bg-purple-500/10 text-purple-600",
                isAudio && "bg-orange-500/10 text-orange-600",
                isPdf && "bg-red-500/10 text-red-600",
                isSpreadsheet && "bg-emerald-500/10 text-emerald-600",
                isTextOrCode && "bg-blue-500/10 text-blue-600",
                !isImage && !isVideo && !isAudio && !isPdf && !isSpreadsheet && !isTextOrCode && "bg-primary/10 text-primary"
              )}>
                {getExtBadge()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{fp.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {isSpreadsheet ? 'Spreadsheet' : isTextOrCode ? getLanguageHint() : fp.fileType}
                </p>
              </div>
              <a 
                href={fp.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                download={fp.fileName}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
              >
                Download
              </a>
            </div>
            
            {/* Content Preview */}
            <div className="relative">
              {/* Image Preview */}
              {isImage && (
                <div className="flex items-center justify-center p-4 bg-muted/20 min-h-[200px] max-h-[600px]">
                  <img 
                    src={`${fp.fileUrl}?inline=true`} 
                    alt={fp.fileName}
                    className="max-w-full max-h-[560px] object-contain rounded shadow-sm"
                    loading="lazy"
                  />
                </div>
              )}
              
              {/* Video Preview */}
              {isVideo && (
                <div className="p-4 bg-black/5">
                  <video 
                    src={`${fp.fileUrl}?inline=true`}
                    controls
                    className="w-full max-h-[500px] rounded"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              {/* Audio Preview */}
              {isAudio && (
                <div className="p-4">
                  <audio 
                    src={`${fp.fileUrl}?inline=true`}
                    controls
                    className="w-full"
                    preload="metadata"
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              )}
              
              {/* PDF Preview */}
              {isPdf && (
                <div className="h-[600px] bg-muted/20">
                  <iframe
                    src={`${fp.fileUrl}?inline=true#toolbar=1&navpanes=0&scrollbar=1`}
                    className="w-full h-full border-0"
                    title={fp.fileName}
                  />
                </div>
              )}
              
              {/* Spreadsheet Preview (Excel, CSV) */}
              {isSpreadsheet && (
                <SpreadsheetPreview fileUrl={fp.fileUrl} fileName={fp.fileName} />
              )}
              
              {/* Text/Code Preview */}
              {isTextOrCode && (
                <TextFilePreview fileUrl={fp.fileUrl} fileName={fp.fileName} language={ext} />
              )}
              
              {/* Other files - show download prompt */}
              {!isImage && !isVideo && !isAudio && !isPdf && !isSpreadsheet && !isTextOrCode && (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <span className="text-2xl font-bold text-muted-foreground">{getExtBadge()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Preview not available for this file type.
                  </p>
                  <a 
                    href={fp.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    download={fp.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center border rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground">No file preview available</p>
          </div>
        )}
      </div>
    );
  }

  // 6. Notes (정리노트/핵심)
  if (cell.type === "notes") {
    return (
      <div className="w-full">
        {!hideTitle && (
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-semibold uppercase">
              핵심 정리
            </span>
            <h2 className="text-lg font-bold text-foreground">{cell.title}</h2>
          </div>
        )}
        <div className="relative pl-4 border-l-2 border-yellow-500/50">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <CellMarkdownContent content={cell.content || ""} cellId={cell.id} tabId={tabId} />
          </div>
        </div>
      </div>
    );
  }

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
