"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page could not be loaded. This can happen after an update or when a
        resource failed to load. Try refreshing or go back home.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={() => reset()}
          variant="default"
          className="gap-2"
        >
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
