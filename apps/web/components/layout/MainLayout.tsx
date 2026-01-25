"use client";

import { ReactNode } from "react";
import { GlobalNavDock } from "./GlobalNavDock";
import { ActiveView } from "./ActiveView";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <GlobalNavDock />
      <ActiveView>{children}</ActiveView>
    </div>
  );
}

