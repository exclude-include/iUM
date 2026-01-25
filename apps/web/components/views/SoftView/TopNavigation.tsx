"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TopNavigationProps {
  activeTab: "reels" | "quiz" | "discuss";
  setActiveTab: (tab: "reels" | "quiz" | "discuss") => void;
}

export function TopNavigation({ activeTab, setActiveTab }: TopNavigationProps) {
  const tabs = [
    { id: "reels" as const, label: "Reels" },
    { id: "quiz" as const, label: "Quiz" },
    { id: "discuss" as const, label: "Discuss" },
  ];

  return (
    <div className="flex h-[60px] items-center justify-center border-b bg-background/95 backdrop-blur-sm">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

