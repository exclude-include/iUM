"use client";

import { Component, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Cell } from "@/lib/store";

interface Props {
  cell: Cell;
  tabId: string;
  children: ReactNode;
  setCellRef?: (id: string, el: HTMLDivElement | null) => void;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps a single cell. If render throws (e.g. Radix intersectRect), shows a simple card
 * with the same title and content so the user still sees the response.
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
      const { cell, setCellRef } = this.props;
      return (
        <div
          ref={(el) => setCellRef?.(cell.id, el)}
          className="w-full max-w-full min-w-0"
        >
          <Card className="p-6 bg-background border-border w-full max-w-full overflow-hidden">
            <h2 className="text-xl font-bold mb-3 text-foreground">{cell.title}</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {cell.content || "No content."}
              </ReactMarkdown>
            </div>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
