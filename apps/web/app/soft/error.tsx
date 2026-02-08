"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Film, RefreshCw, Home } from "lucide-react";

export default function SoftError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Soft view error]", error);
  }, [error]);

  const isChunkError =
    error?.message?.includes("ChunkLoadError") ||
    error?.message?.includes("Loading chunk") ||
    error?.message?.includes("Failed to fetch");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <Film className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        Soft view could not be loaded
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {isChunkError
          ? "The page failed to load. This can happen after an update. Try refreshing or go back to Workspace."
          : "Something went wrong. You can try again or return to Workspace."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} variant="default" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Go to Workspace
          </Link>
        </Button>
      </div>
    </div>
  );
}
