"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, X, Plus, FileText, Save, Download, Pencil, Trash2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelBottomClose, PanelBottomOpen, Sparkles } from "lucide-react";
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
import { DeepModeCursor } from "./DeepModeCursor";
import { TextSelectionMenu } from "./TextSelectionMenu";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
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
    addDeepCard,
    updateDeepCard,
    setSidebarMode,
    sidebarMode,
  } = useAppStore();

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Ref map for scroll-to-cell functionality
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Get active notebook tab
  const activeTab = notebookTabs.find((tab) => tab.id === notebookActiveTabId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✨ [추가] 폴더가 있는데 탭이 없으면 자동으로 탭 생성
  useEffect(() => {
    if (activeFolderId && notebookTabs.length === 0) {
      console.log("[MainContentArea] Folder exists but no tabs, creating default tab");
      createNotebookTab("Tab 1");
    }
  }, [activeFolderId, notebookTabs.length, createNotebookTab]);

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

  // --- Selection & Hover Logic ---
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<{ visible: boolean; position: { top: number; left: number } | null; text: string }>({ visible: false, position: null, text: "" });
  const [hoverCursor, setHoverCursor] = useState<{ visible: boolean; position: { x: number; y: number } | null; progress: number }>({ visible: false, position: null, progress: 0 });
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Selection Change Handler
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text) {
        setIsTextSelected(true);
        // Only show menu if sidebar is NOT dragging/resizing (simplified check)
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();

        if (selection && rect && rect.width > 0) {
          // Check if selection is within Main Container OR Deep Mode View
          const anchorNode = selection.anchorNode as HTMLElement;
          const isInMain = containerRef.current && containerRef.current.contains(anchorNode);
          const isInDeep = anchorNode.parentElement?.closest('.deep-mode-view');

          if (isInMain || isInDeep) {
            setSelectionMenu({
              visible: true,
              position: { top: rect.top + window.scrollY, left: rect.left + rect.width / 2 + window.scrollX },
              text: text
            });
          } else {
            setSelectionMenu(prev => ({ ...prev, visible: false }));
          }
        }
      } else {
        setIsTextSelected(false);
        setSelectionMenu(prev => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  // Hover Logic (Deep Mode Only)
  useEffect(() => {
    // "deep 모드에서" -> Only active when Sidebar is in Deep Mode
    if (sidebarMode !== 'deep') {
      setHoverCursor({ visible: false, position: null, progress: 0 });
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Reset timers on move
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      setHoverCursor({ visible: false, position: null, progress: 0 });

      const target = e.target as HTMLElement;

      // 1. Restriction: MUST be inside Main Container (Main Tab)
      if (containerRef.current && !containerRef.current.contains(target)) {
        return;
      }

      // 2. Restriction: NO diagrams or interactive elements
      if (target.closest('svg') || target.closest('.react-flow') || target.closest('.mermaid') || target.closest('button')) {
        return;
      }

      // Rough check if hovering text-containing element
      // (User wants "hover over specific text")
      const isTextLike = target.matches('p, h1, h2, h3, h4, h5, h6, span, li, td, code, pre, div.prose, .katex');

      // If not explicit text tag, check if it has direct text content
      if (!isTextLike && !target.innerText?.trim()) return;

      const x = e.clientX;
      const y = e.clientY;

      // Start Pre-hover Timer (1s wait before showing progress)
      hoverTimerRef.current = setTimeout(() => {
        // Show Cursor & Start Progress
        setHoverCursor({ visible: true, position: { x, y }, progress: 0 });

        let progress = 0;
        // Fill progress over 4 seconds (Total 5s: 1s wait + 4s fill)
        progressIntervalRef.current = setInterval(() => {
          progress += 2.5; // 100 / 40 steps = 2.5
          setHoverCursor(prev => ({ ...prev, progress }));

          if (progress >= 100) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

            // Trigger Deep Dive
            const hoverText = target.innerText?.slice(0, 1000) || "";
            if (hoverText) {
              handleDeepDive(hoverText);
              setHoverCursor({ visible: false, position: null, progress: 0 });
            }
          }
        }, 100); // 40 steps * 100ms = 4000ms
      }, 1000); // 1s delay
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
  }, [sidebarMode]);

  const handleCopy = () => {
    if (selectionMenu.text) {
      navigator.clipboard.writeText(selectionMenu.text);
      toast({ description: "Copied to clipboard" });
      setSelectionMenu(prev => ({ ...prev, visible: false }));
      // Close menu but keep selection
    }
  };

  const handleDeepDive = async (textOverride?: string) => {
    const text = textOverride || selectionMenu.text || window.getSelection()?.toString().trim();

    if (!text) {
      toast({
        description: "Please select some text or hover over text to Deep Dive.",
      });
      return;
    }

    // Switch to Deep Mode and open sidebar
    setSidebarMode("deep");
    setRightPanelMinimized(false);

    // Optimistic UI: Add loading card immediately
    // Note: addDeepCard returns the new cellId
    const tempCardId = addDeepCard({
      title: "Analyzing...",
      type: "concept",
      content: "Generating explanation...",
      equations: [],
      quiz_data: [],
      diagram_description: "",
      mermaid_code: "",
    });

    // Mark as loading
    updateDeepCard(tempCardId, {
      status: 'loading',
      title: `Deep Dive: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`
    });

    try {
      // Context: Active Document title or Tab title
      const context = activeDocument ? activeDocument.title : (activeTab ? activeTab.title : "");

      const response = await api.chat.generateDeepExplanation(text, context, activeFolderId || undefined);

      if (response.learning_unit) {
        updateDeepCard(tempCardId, { ...response.learning_unit, status: 'complete' });
      } else {
        // Fallback if no structured unit
        updateDeepCard(tempCardId, {
          type: "concept",
          title: "Explanation",
          content: response.message,
          equations: [],
          quiz_data: [],
          diagram_description: "",
          mermaid_code: "",
          status: 'complete'
        });
      }
    } catch (error) {
      console.error("Deep dive failed:", error);
      updateDeepCard(tempCardId, {
        content: "Failed to generate explanation. Please try again.",
        status: 'error',
        title: "Error"
      });
      toast({
        title: "Deep Dive Failed",
        description: "Could not generate explanation.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-hidden min-w-0">
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
              data-tutorial="tutorial-main-new-tab"
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
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 min-w-0 flex flex-col overflow-hidden relative" disabled={!isTextSelected}>
          <div ref={containerRef as React.RefObject<HTMLDivElement>} className="flex-1 min-w-0 flex flex-col h-full">
            <ScrollArea className="flex-1 min-w-0">
              <div className="p-4 w-full max-w-full overflow-hidden">
                {/* Float Elements */}
                <DeepModeCursor
                  visible={hoverCursor.visible}
                  progress={hoverCursor.progress}
                  position={hoverCursor.position}
                />
                <TextSelectionMenu
                  visible={selectionMenu.visible}
                  position={selectionMenu.position}
                  onCopy={handleCopy}
                  onDeepDive={() => handleDeepDive(selectionMenu.text)}
                />

                {/* Active Tab Content */}
                {activeTab && notebookActiveTabId ? (
                  activeTab.cells.length > 0 ? (
                    <div className="space-y-4 w-full max-w-full">
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={() => handleDeepDive()}>
            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
            Deep Dive Selection
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
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