"use client";

import { Component, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Cell } from "@/lib/store";
import { CellToolbar } from "./CellToolbar";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  cell: Cell;
  tabId: string;
  children: ReactNode;
  setCellRef?: (id: string, el: HTMLDivElement | null) => void;
}

interface State {
  hasError: boolean;
}

/** Fallback cell with math support and toolbar (bookmark, etc.) */
function FallbackCellWithToolbar({ cell, tabId, setCellRef }: { cell: Cell; tabId: string; setCellRef?: (id: string, el: HTMLDivElement | null) => void }) {
  const deleteCell = useAppStore((s) => s.deleteCell);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const moveCellToNewTab = useAppStore((s) => s.moveCellToNewTab);

  return (
    <div
      ref={(el) => setCellRef?.(cell.id, el)}
      className="group relative w-full max-w-full min-w-0"
    >
      <CellToolbar
        cellType={cell.type}
        isBookmarked={cell.isBookmarked}
        onDelete={() => deleteCell(tabId, cell.id)}
        onBookmark={() => toggleBookmark(tabId, cell.id)}
        onMoveToNewTab={() => moveCellToNewTab(tabId, cell.id)}
      />
      <Card className={cn(
        "p-6 bg-background border-border w-full max-w-full overflow-hidden",
        cell.isBookmarked && "border-l-4 border-l-primary"
      )}>
        <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>
        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_.katex]:text-sm">
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
          >
            {cell.content || "No content."}
          </ReactMarkdown>
        </div>
      </Card>
    </div>
  );
}

/**
 * Wraps a single cell. If render throws (e.g. Radix intersectRect), shows a simple card
 * with the same title and content (with math), plus toolbar for bookmark etc.
 */
export class SingleCellErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[SingleCellErrorBoundary] Caught error for cell, showing fallback:", error.message);
  }

  render() {
    if (this.state.hasError) {
      const { cell, tabId, setCellRef } = this.props;
      return <FallbackCellWithToolbar cell={cell} tabId={tabId} setCellRef={setCellRef} />;
    }
    return this.props.children;
  }
}
