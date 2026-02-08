"use client";

import React, { forwardRef, useRef, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { QuizView } from "@/components/QuizView";
import { FlowChart } from "@/components/FlowChart";
import { FlashcardView } from "@/components/FlashcardView"; // ✨
import { CellToolbar } from "./CellToolbar";
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

  // 4. Table (표) - Structured table view
  if (cell.type === "table") {
    return (
      <div className="w-full">
        {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
        {cell.table_data && cell.table_data.headers && cell.table_data.rows ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {cell.table_data.headers.map((header, idx) => (
                    <th key={idx} className="px-4 py-3 text-left font-semibold text-foreground border-b">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cell.table_data.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-muted/30 transition-colors">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3 border-b border-border/50">
                        {cell}
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

  // 5. File Preview (파일 미리보기)
  if (cell.type === "file-preview") {
    return (
      <div className="w-full">
        {!hideTitle && <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>}
        {cell.file_preview ? (
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
              <div className="h-8 w-8 rounded flex items-center justify-center bg-primary/10">
                <span className="text-xs font-bold text-primary uppercase">
                  {cell.file_preview.fileType.split('/').pop()?.slice(0, 3) || 'FILE'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{cell.file_preview.fileName}</p>
                <p className="text-xs text-muted-foreground">{cell.file_preview.fileType}</p>
              </div>
              {cell.file_preview.fileUrl && (
                <a 
                  href={cell.file_preview.fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Open
                </a>
              )}
            </div>
            {cell.file_preview.content && (
              <div className="p-4 max-h-[400px] overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">{cell.file_preview.content}</pre>
              </div>
            )}
          </div>
        ) : (
          <CellMarkdownContent content={cell.content || ""} cellId={cell.id} tabId={tabId} />
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
