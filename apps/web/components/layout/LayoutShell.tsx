"use client";

import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { GlobalNavDock } from "./GlobalNavDock";
import { ActiveView } from "./ActiveView";
import { Loader2 } from "lucide-react";

interface LayoutShellProps {
  children: ReactNode;
}

/**
 * Wraps app content: shows GlobalNavDock + ActiveView only when user is logged in.
 * When not logged in (onboarding), renders only children so the dock is hidden.
 */
export function LayoutShell({ children }: LayoutShellProps) {
  const { user, loading: authLoading } = useAuth();

  // Suppress Radix/Floating UI "intersectRect" errors when adding cells so the app doesn't crash
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      const msg = e.message ?? "";
      if (msg.includes("intersection") || msg.includes("intersectRect") || msg.includes("rectangle")) {
        e.preventDefault();
        console.warn("[LayoutShell] Suppressed layout/position error:", msg);
        return true;
      }
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <GlobalNavDock />
      <ActiveView>{children}</ActiveView>
    </div>
  );
}
