"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, X, Plus, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MathContent } from "./MathContent";
import { SourcesPanel } from "./SourcesPanel";
import { CellRenderer } from "./CellRenderer";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import "katex/dist/katex.min.css";

export function MainContentArea() {
  const {
    activeDocument,
    notebookTabs,
    notebookActiveTabId,
    setNotebookActiveTab,
    deleteNotebookTab,
    createNotebookTab,
    scrollToCellId,
    clearScrollTarget,
  } = useAppStore();

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ref map for scroll-to-cell functionality
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Get active notebook tab
  const activeTab = notebookTabs.find((tab) => tab.id === notebookActiveTabId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle scroll-to-cell with delay for render completion
  useEffect(() => {
    if (scrollToCellId) {
      // Wait for render to complete before scrolling
      const timeoutId = setTimeout(() => {
        const cellElement = cellRefs.current.get(scrollToCellId);
        if (cellElement) {
          cellElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
        clearScrollTarget();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [scrollToCellId, notebookActiveTabId, clearScrollTarget]);

  // Callback ref setter for cells
  const setCellRef = useCallback((cellId: string, element: HTMLDivElement | null) => {
    if (element) {
      cellRefs.current.set(cellId, element);
    } else {
      cellRefs.current.delete(cellId);
    }
  }, []);

  const handleCreateNewTab = () => {
    createNotebookTab("New Notebook");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* --- Tab Bar --- */}
      <div className="flex items-center justify-between border-b bg-background">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 px-2 py-1.5 min-w-fit">
            {/* Notebook Tabs */}
            {notebookTabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  "group flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors border-b-2 border-transparent min-w-0",
                  notebookActiveTabId === tab.id
                    ? "bg-accent text-foreground border-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <button
                  onClick={() => setNotebookActiveTab(tab.id)}
                  className="truncate max-w-[180px] text-left flex-1 flex items-center gap-1.5"
                  title={`${tab.title} (${tab.cells.length} cells)`}
                >
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{tab.title}</span>
                  {tab.cells.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({tab.cells.length})
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotebookTab(tab.id);
                  }}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-background/50",
                    notebookActiveTabId === tab.id && "opacity-100"
                  )}
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Document Tab (if active) */}
            {activeDocument && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors border-b-2 border-transparent",
                  !notebookActiveTabId
                    ? "bg-accent text-foreground border-primary"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <button
                  onClick={() => setNotebookActiveTab(null)}
                  className="truncate max-w-[180px]"
                  title={activeDocument.title}
                >
                  {activeDocument.title}
                </button>
              </div>
            )}

            {/* New Tab Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={handleCreateNewTab}
              title="Create new notebook"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Theme Toggle */}
        {mounted && (
          <div className="px-2 border-l">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* --- Main Content Area --- */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Active Notebook Tab Content */}
          {activeTab && notebookActiveTabId ? (
            activeTab.cells.length > 0 ? (
              <div className="space-y-4">
                {activeTab.cells.map((cell) => (
                  <CellRenderer
                    key={cell.id}
                    cell={cell}
                    tabId={activeTab.id}
                    ref={(el) => setCellRef(cell.id, el)}
                  />
                ))}
              </div>
            ) : (
              <EmptyTabState tabTitle={activeTab.title} />
            )
          ) : activeDocument && !notebookActiveTabId ? (
            /* Document View */
            <MathContent document={activeDocument} />
          ) : (
            /* No Tab Selected State */
            <NoTabSelectedState onCreateTab={handleCreateNewTab} />
          )}
        </div>
      </ScrollArea>

      <SourcesPanel />
    </div>
  );
}

// Empty tab state component
function EmptyTabState({ tabTitle }: { tabTitle: string }) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center px-4">
      <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">{tabTitle}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        This notebook is empty. Start a conversation with the AI tutor to add learning content here.
      </p>
    </div>
  );
}

// No tab selected state component
function NoTabSelectedState({ onCreateTab }: { onCreateTab: () => void }) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center px-4">
      <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">No Notebook Selected</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Select a notebook tab or create a new one to start learning.
      </p>
      <Button onClick={onCreateTab} variant="outline" size="sm">
        <Plus className="h-4 w-4 mr-2" />
        Create New Notebook
      </Button>
    </div>
  );
}