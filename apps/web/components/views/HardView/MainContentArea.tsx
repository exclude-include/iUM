"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, X, Plus, FileText, Save, Download, Pencil, Trash2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelBottomClose, PanelBottomOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { MathContent } from "./MathContent";
import { CellRenderer } from "./CellRenderer";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import "katex/dist/katex.min.css";

export function MainContentArea() {
  const {
    activeDocument,
    notebookTabs,
    notebookActiveTabId,
    setNotebookActiveTab,
    deleteNotebookTab,
    createNotebookTab,
    renameNotebookTab,
    scrollToCellId,
    clearScrollTarget,
    exportTabAsIum,
    saveTabToSupabase,
    activeFolderId,
    rightPanelMinimized,
    leftPanelMinimized,
    bottomPanelMinimized,
    setLeftPanelMinimized,
    setRightPanelMinimized,
    setBottomPanelMinimized,
  } = useAppStore();

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Ref map for scroll-to-cell functionality
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Get active notebook tab
  const activeTab = notebookTabs.find((tab) => tab.id === notebookActiveTabId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (notebookTabs.length > 0) {
        try {
          localStorage.setItem("ium_notebooks_autosave", JSON.stringify({
            tabs: notebookTabs,
            activeTabId: notebookActiveTabId,
            savedAt: Date.now(),
          }));
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [notebookTabs, notebookActiveTabId]);

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
    createNotebookTab(); // Auto-generates unique name like "Tab 1", "Tab 2", etc.
  };

  // Save tab as .ium file to Supabase
  const handleSaveTab = async (tabId: string) => {
    if (!activeFolderId) {
      toast({
        title: "No folder selected",
        description: "Please select a folder first to save the notebook.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveTabToSupabase(tabId, activeFolderId);
      if (result.success) {
        toast({
          title: "Tab saved",
          description: "Your notebook has been saved as .ium file.",
        });
      } else {
        toast({
          title: "Save failed",
          description: result.error || "Failed to save notebook.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Download .ium file locally
  const handleDownloadTab = (tabId: string) => {
    const iumFile = exportTabAsIum(tabId);
    if (!iumFile) {
      toast({
        title: "Export failed",
        description: "Could not export the notebook.",
        variant: "destructive",
      });
      return;
    }

    const fileName = `${iumFile.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}.ium`;
    const fileContent = JSON.stringify(iumFile, null, 2);
    const blob = new Blob([fileContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: `${fileName} has been downloaded.`,
    });
  };

  // Rename tab
  const handleRenameTab = (tabId: string) => {
    const tab = notebookTabs.find((t) => t.id === tabId);
    if (!tab) return;

    const newName = prompt("Enter new notebook name:", tab.title);
    if (newName && newName.trim()) {
      renameNotebookTab(tabId, newName.trim());
    }
  };

  // Delete tab AND the file from Supabase
  const handleDeleteTabFromCloud = async (tabId: string) => {
    const tab = notebookTabs.find((t) => t.id === tabId);
    if (!tab) return;

    const fileId = tab.syncInfo?.fileId;
    if (!fileId) {
      // Not synced to cloud, just close locally
      deleteNotebookTab(tabId);
      toast({
        title: "Tab closed",
        description: "This tab was not saved to the cloud.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${tab.title}" from the cloud? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/workspace/file/${fileId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to delete from server");
        }
      }

      // Remove from local store
      deleteNotebookTab(tabId);

      // Refresh files list
      useAppStore.getState().fetchFiles();

      toast({
        title: "Deleted from cloud",
        description: `"${tab.title}" has been permanently deleted.`,
      });
    } catch (error) {
      console.error("Failed to delete from cloud:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete the file.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* --- Tab Bar --- */}
      <div className="flex items-center justify-between border-b bg-background">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 px-2 py-1.5 min-w-fit">
            {/* Tabs with Context Menu */}
            {notebookTabs.map((tab) => (
              <ContextMenu key={tab.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "group flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors border-b-2 border-transparent min-w-0 cursor-pointer",
                      notebookActiveTabId === tab.id
                        ? "bg-accent text-foreground border-primary"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <button
                      onClick={() => setNotebookActiveTab(tab.id)}
                      className="truncate max-w-[180px] text-left flex-1 flex items-center gap-1.5"
                      title={`${tab.title} (${tab.cells.length} cells) - Right-click for options`}
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
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuItem
                    onClick={() => handleSaveTab(tab.id)}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save to Folder (.ium)"}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleDownloadTab(tab.id)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download as .ium
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleRenameTab(tab.id)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => deleteNotebookTab(tab.id)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Close Tab
                  </ContextMenuItem>
                  {tab.syncInfo?.fileId && (
                    <ContextMenuItem
                      onClick={() => handleDeleteTabFromCloud(tab.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete from Cloud
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
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
              title="Create new tab"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 채팅 패널이 최소화된 경우에만: 패널 복원 버튼 표시 (채팅을 다시 펼치려면) */}
        {rightPanelMinimized && (
          <div className="flex items-center gap-0.5 border-l px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setLeftPanelMinimized(!leftPanelMinimized)}
              title={leftPanelMinimized ? "좌측 패널 펼치기" : "좌측 패널 최소화"}
            >
              {leftPanelMinimized ? <PanelLeftOpen className="h-4 w-4 text-muted-foreground hover:text-primary" /> : <PanelLeftClose className="h-4 w-4 text-muted-foreground hover:text-primary" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRightPanelMinimized(false)}
              title="채팅 패널 펼치기"
            >
              <PanelRightOpen className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setBottomPanelMinimized(!bottomPanelMinimized)}
              title={bottomPanelMinimized ? "하단 패널 펼치기" : "하단 패널 최소화"}
            >
              {bottomPanelMinimized ? <PanelBottomOpen className="h-4 w-4 text-muted-foreground hover:text-primary" /> : <PanelBottomClose className="h-4 w-4 text-muted-foreground hover:text-primary" />}
            </Button>
          </div>
        )}

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
          {/* Active Tab Content */}
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
        This tab is empty. Start a conversation with the AI tutor to add learning content here.
      </p>
    </div>
  );
}

// No tab selected state component
function NoTabSelectedState({ onCreateTab }: { onCreateTab: () => void }) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center px-4">
      <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">No Tab Selected</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Select a tab or create a new one to start learning.
      </p>
      <Button onClick={onCreateTab} variant="outline" size="sm">
        <Plus className="h-4 w-4 mr-2" />
        Create New Tab
      </Button>
    </div>
  );
}