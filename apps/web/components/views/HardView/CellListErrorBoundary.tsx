"use client";

import { Component, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Catches errors (e.g. Radix "intersectRect") during cell render so the app doesn't crash.
 * Shows a fallback message; the new cell is still in state so user can scroll or retry.
 */
export class CellListErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[CellListErrorBoundary] Caught error (cell may still have been added):", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            {this.props.fallbackTitle ?? "Response was added."}
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            If you don&apos;t see the new cell, scroll down or refresh the page.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onRetry?.();
            }}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
