"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, X, Plus, FileText, Save, Download, Pencil, Trash2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sparkles, Star, Copy } from "lucide-react";
import { Reorder } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { MathContent } from "./MathContent";
import { CellRenderer } from "./CellRenderer";
import { SingleCellErrorBoundary } from "./SingleCellErrorBoundary";
import { DeepModeCursor } from "./DeepModeCursor";
import { TextSelectionMenu } from "./TextSelectionMenu";
import { cn } from "@/lib/utils";
import { useAppStore, type NotebookTab, type Cell } from "@/lib/store";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
    setLeftPanelMinimized,
    setRightPanelMinimized,
    addDeepCard,
    updateDeepCard,
    setSidebarMode,
    sidebarMode,
    knowledgeFolders, // ✨ Added for star status
    loadTabFromIum, // ✨ Added for duplicate functionality
    deepHistory,
    hydrateNotebookBackup,
    saveUserNotebookStateToSupabase,
    loadUserNotebookStateFromSupabase,
    reorderNotebookTabs, // ✨ Added for drag-and-drop
    appendCellToActiveTab, // ✨ Added for file drop
  } = useAppStore();

  const { user } = useAuth();

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ✨ Dialog state for rename and delete confirmation
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTabId, setRenameTabId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTabId, setDeleteTabId] = useState<string | null>(null);
  
  // ✨ File drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Ref map for scroll-to-cell functionality
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Get active notebook tab
  const activeTab = notebookTabs.find((tab) => tab.id === notebookActiveTabId);

  // ✨ [Updated] Filter visible tabs by active folder
  // Tabs without folderId (legacy) are treated as belonging to "folder-1" (default)
  const visibleTabs = notebookTabs.filter(tab =>
    (tab.folderId || "folder-1") === (activeFolderId || "folder-1")
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✨ [Restored] Auto-create tab if folder exists but no tabs (User Request)
  useEffect(() => {
    // Check if we have an active folder but NO visible tabs
    if (activeFolderId && visibleTabs.length === 0) {
      console.log("[MainContentArea] Folder exists but no tabs, creating default tab");
      createNotebookTab("Tab 1");
    }
  }, [activeFolderId, visibleTabs.length, createNotebookTab]);

  // ✨ Auto-save to Supabase (Cloud) every 10 seconds for robustness
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      const state = useAppStore.getState();
      state.notebookTabs.forEach((tab) => {
        // Only auto-save if it's already synced (has fileId) and has changes
        if (tab.syncInfo?.fileId && tab.syncInfo.lastSyncedAt && (tab.updatedAt > tab.syncInfo.lastSyncedAt)) {
          console.log(`[AutoSave] Triggering cloud save for ${tab.title}`);
          state.saveTabToSupabase(tab.id, tab.syncInfo.folderId, true);
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [notebookTabs]);

  // LocalStorage + Supabase backup: tabs, activeTabId, deepHistory (persist on refresh and across devices)
  useEffect(() => {
    const backupInterval = setInterval(() => {
      try {
        const state = useAppStore.getState();
        const hasTabs = state.notebookTabs.length > 0;
        const hasDeep = state.deepHistory.length > 0;
        if (hasTabs || hasDeep) {
          localStorage.setItem("ium_notebooks_autosave", JSON.stringify({
            tabs: state.notebookTabs,
            activeTabId: state.notebookActiveTabId,
            deepHistory: state.deepHistory,
            savedAt: Date.now(),
          }));
          if (user) state.saveUserNotebookStateToSupabase();
        }
      } catch (error) {
        // ignore
      }
    }, 30000);
    return () => clearInterval(backupInterval);
  }, [notebookTabs, notebookActiveTabId, deepHistory, user]);

  // Restore tabs + deepHistory: from Supabase when logged in, else from localStorage
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      if (user) {
        await loadUserNotebookStateFromSupabase();
        if (cancelled) return;
        return;
      }
      try {
        const raw = localStorage.getItem("ium_notebooks_autosave");
        if (!raw) return;
        const data = JSON.parse(raw) as { tabs?: unknown; activeTabId?: string | null; deepHistory?: unknown; savedAt?: number };
        if (!data || typeof data !== "object") return;
        const payload: { tabs?: NotebookTab[]; activeTabId?: string | null; deepHistory?: Cell[] } = {};
        if (Array.isArray(data.tabs) && data.tabs.length > 0) payload.tabs = data.tabs as NotebookTab[];
        if (data.activeTabId !== undefined) payload.activeTabId = data.activeTabId ?? null;
        if (Array.isArray(data.deepHistory)) payload.deepHistory = data.deepHistory as Cell[];
        if (payload.tabs || payload.deepHistory || payload.activeTabId !== undefined) {
          hydrateNotebookBackup(payload);
        }
      } catch (_) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [mounted, user, loadUserNotebookStateFromSupabase, hydrateNotebookBackup]);

  // Handle scroll-to-cell after layout settles to avoid Radix "intersectRect" errors when adding cells
  useEffect(() => {
    if (!scrollToCellId) return;

    const id = scrollToCellId;
    const timeoutId = setTimeout(() => {
      // Run after paint so Radix/Floating UI have finished any position updates
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const cellElement = cellRefs.current.get(id);
            if (cellElement) {
              cellElement.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          } catch (_) {
            // Ignore layout/position errors so the new cell still appears
          }
          clearScrollTarget();
        });
      });
    }, 300);

    return () => clearTimeout(timeoutId);
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

  // ✨ File drop handlers for file-preview cells
  const getMimeType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      // Images
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml', 'bmp': 'image/bmp',
      // Videos
      'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
      'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
      // Audio
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      // Documents
      'pdf': 'application/pdf', 'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel', 
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      'txt': 'text/plain', 'md': 'text/markdown', 'csv': 'text/csv',
      'json': 'application/json', 'xml': 'application/xml',
      // Code
      'js': 'text/javascript', 'ts': 'text/typescript', 'py': 'text/x-python',
      'html': 'text/html', 'css': 'text/css',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-ium-file')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set false if we're leaving the container, not just moving to a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const data = e.dataTransfer.getData('application/x-ium-file');
    if (!data) return;
    
    try {
      const fileData = JSON.parse(data);
      const mimeType = getMimeType(fileData.name);
      
      appendCellToActiveTab({
        type: 'file-preview',
        title: fileData.name,
        content: '', // File preview doesn't need markdown content
        file_preview: {
          fileName: fileData.name,
          fileType: mimeType,
          fileUrl: fileData.url,
          fileId: fileData.id,
        },
      });
      
      toast({
        title: "File added",
        description: `"${fileData.name}" has been added as a preview cell.`,
      });
    } catch (error) {
      console.error('Failed to parse dropped file data:', error);
      toast({
        title: "Drop failed",
        description: "Could not add the file to the tab.",
        variant: "destructive",
      });
    }
  }, [appendCellToActiveTab, toast]);

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
      // ✨ [Updated] Manual save = Permanent (isTemp: false)
      const result = await saveTabToSupabase(tabId, activeFolderId, false);
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

  // ✨ Open rename dialog (replaces browser prompt)
  const openRenameDialog = (tabId: string) => {
    const tab = notebookTabs.find((t) => t.id === tabId);
    if (!tab) return;
    setRenameTabId(tabId);
    setRenameInput(tab.title);
    setRenameDialogOpen(true);
  };

  // ✨ Confirm rename from dialog
  const confirmRenameTab = async () => {
    if (!renameTabId || !renameInput.trim()) return;

    const tab = notebookTabs.find((t) => t.id === renameTabId);
    if (!tab) return;

    // Update local tab title
    renameNotebookTab(renameTabId, renameInput.trim());

    // Also update file name in DB if synced (so sidebar updates too)
    if (tab.syncInfo?.fileId) {
      try {
        const { renameFile } = useAppStore.getState();
        await renameFile(tab.syncInfo.fileId, renameInput.trim());
        toast({ title: "Tab renamed", description: `Renamed to "${renameInput.trim()}"` });
      } catch (error) {
        console.error("Failed to sync rename to DB:", error);
      }
    }

    setRenameDialogOpen(false);
    setRenameTabId(null);
    setRenameInput("");
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

    // ✨ Open delete confirmation dialog instead of browser confirm
    setDeleteTabId(tabId);
    setDeleteDialogOpen(true);
  };

  // ✨ Confirm delete from dialog
  const confirmDeleteFromCloud = async () => {
    if (!deleteTabId) return;

    const tab = notebookTabs.find((t) => t.id === deleteTabId);
    if (!tab) return;

    const fileId = tab.syncInfo?.fileId;
    if (!fileId) return;

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
      deleteNotebookTab(deleteTabId);

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
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTabId(null);
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

          // ✨ [Updated] Restrict to content areas (ignore titles, badges, etc.)
          // Allow text selection menu for ALL cell types, not just concept cells
          const anchorElement = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
          const isInContent = anchorElement?.closest('.cell-content, .document-content, [data-cell-id]');

          if ((isInMain && isInContent) || isInDeep) {
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
      // ✨ [Fixed] Auto Deep Restriction: 
      // Do NOT trigger if there is no content (Empty Tab / No Tab / No Document)
      const hasContent = ((activeTab?.cells?.length ?? 0) > 0) || !!activeDocument;
      if (!hasContent) return;

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

      // ✨ [Updated] Restriction: MUST be inside content areas (ignore cell headers, tabs, etc.)
      if (!target.closest('.cell-content, .document-content')) {
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

            // Trigger Deep Dive (pass target so we can set source block for badge)
            const hoverText = target.innerText?.slice(0, 1000) || "";
            if (hoverText) {
              handleDeepDive(hoverText, target as HTMLElement);
              setHoverCursor({ visible: false, position: null, progress: 0 });
            }
          }
        }, 100); // 40 steps * 100ms = 4000ms
      }, 1000); // 1s delay
    };

    // ✨ Cancel hover timer on scroll (user wants auto deep to NOT trigger during scroll)
    const handleScroll = () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setHoverCursor({ visible: false, position: null, progress: 0 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll, true); // capture phase for all scroll events
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll, true);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
  }, [sidebarMode, activeTab, activeDocument]);

  const handleCopy = () => {
    if (selectionMenu.text) {
      navigator.clipboard.writeText(selectionMenu.text);
      toast({ description: "Copied to clipboard" });
      setSelectionMenu(prev => ({ ...prev, visible: false }));
      // Close menu but keep selection
    }
  };

  const handleDeepDive = async (textOverride?: string, sourceElement?: HTMLElement | null) => {
    const text = textOverride || selectionMenu.text || window.getSelection()?.toString().trim();

    if (!text) {
      toast({
        description: "Please select some text or hover over text to Deep Dive.",
      });
      return;
    }

    // Resolve source block for badge: use passed element or current selection's anchor
    let blockForBadge = sourceElement;
    if (!blockForBadge) {
      const sel = window.getSelection();
      const anchor = sel?.anchorNode;
      const node = anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor?.parentElement;
      blockForBadge = node?.closest?.("[data-cell-id][data-tab-id][data-block-index]") as HTMLElement | null ?? undefined;
    }

    // Switch to Deep Mode and open sidebar
    setSidebarMode("deep");
    setRightPanelMinimized(false);

    // Optimistic UI: Add loading card immediately (badge appears as soon as we set source)
    const tempCardId = addDeepCard({
      title: "Analyzing...",
      type: "concept",
      content: "Generating explanation...",
      equations: [],
      quiz_data: [],
      diagram_description: "",
    } as any);

    // Link deep card to source block + selected text (for partial highlight) — do this immediately
    if (blockForBadge) {
      const sourceTabId = blockForBadge.getAttribute("data-tab-id");
      const sourceCellId = blockForBadge.getAttribute("data-cell-id");
      const sourceBlockIndex = blockForBadge.getAttribute("data-block-index");
      if (sourceTabId && sourceCellId && sourceBlockIndex !== null) {
        updateDeepCard(tempCardId, {
          sourceTabId,
          sourceCellId,
          sourceBlockIndex: parseInt(sourceBlockIndex, 10),
          sourceSelectedText: text.trim(),
        });
      }
    }

    // Mark as loading
    updateDeepCard(tempCardId, {
      status: 'loading',
      title: `Deep Dive: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`
    });

    try {
      // ✨ [Updated] Context Retrieval - Get full cell content for better context
      // Try to find the specific cell the selection belongs to
      let cellFullContent = "";
      let cellTitle = "";
      let context = "";
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        const cellElement = (selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode.parentElement)?.closest('[data-cell-id]');
        if (cellElement) {
          const cellId = cellElement.getAttribute('data-cell-id');
          const sourceCell = activeTab?.cells.find(c => c.id === cellId);
          if (sourceCell) {
            cellTitle = sourceCell.title || 'Untitled';
            cellFullContent = sourceCell.content || '';
            
            // ✨ [Fix] Build structured context with full cell content and selected text
            context = `[CELL_TITLE]: ${cellTitle}\n[CELL_FULL_CONTENT]:\n${cellFullContent}\n[SELECTED_TEXT]: ${text.trim()}`;
          }
        }
      }

      // Fallback to document/tab title if no specific cell context found
      if (!context) {
        context = activeDocument ? activeDocument.title : (activeTab ? activeTab.title : "");
      }

      const response = await api.chat.generateDeepExplanation(text, context, activeFolderId || undefined);

      if (response.learning_unit) {
        // ✨ Successfully got a learning_unit from the agent
        updateDeepCard(tempCardId, { ...response.learning_unit, status: 'complete' });
      } else if (response.message || response.chat_message) {
        // ✨ Got a message response - try to parse or use directly
        let content = response.chat_message || response.message || "";
        let graph_data = undefined;
        let diagram_description = "";

        // Check if content looks like an error message
        const isErrorMessage = content.includes("Unable to answer") || 
                               content.includes("try again") ||
                               content.includes("error") ||
                               content.includes("failed");
        
        if (isErrorMessage) {
          // Try to generate a simple explanation using the text directly
          updateDeepCard(tempCardId, {
            type: "concept",
            title: `Deep Dive: ${text.slice(0, 40)}...`,
            content: `## ${text}\n\n*Failed to generate explanation. Please try again.*\n\nSelected text: "${text}"`,
            equations: [],
            quiz_data: [],
            status: 'error'
          });
          return;
        }

        try {
          let jsonStr = content.trim();

          // 1. Remove markdown code blocks if present
          if (jsonStr.includes("```")) {
            jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
          }

          // 2. Locate JSON object
          const firstOpen = jsonStr.indexOf('{');
          const lastClose = jsonStr.lastIndexOf('}');

          if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const candidate = jsonStr.substring(firstOpen, lastClose + 1);

            try {
              // Try standard parse
              const parsed = JSON.parse(candidate);
              if (parsed.text_content) content = parsed.text_content;
              if (parsed.graph_data) {
                graph_data = parsed.graph_data;
                diagram_description = "Generated diagram based on the explanation.";
              }
            } catch (parseError) {
              console.warn("JSON parse failed, attempting regex extraction:", parseError);

              // 3. Fallback: Regex Extraction (Robust against bad escaping)
              const textMatch = candidate.match(/"text_content"\s*:\s*"([\s\S]*?)",\s*"graph_data"/);
              if (textMatch && textMatch[1]) {
                content = textMatch[1]
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\');
              }

              const graphMatch = candidate.match(/"graph_data"\s*:\s*(\{[\s\S]*\})\s*}/);
              if (graphMatch && graphMatch[1]) {
                try {
                  graph_data = JSON.parse(graphMatch[1]);
                  diagram_description = "Generated diagram based on the explanation.";
                } catch (e) {
                  console.warn("Graph data extraction failed:", e);
                }
              }
            }
          }
        } catch (e) {
          console.warn("Deep Dive response processing completely failed:", e);
        }

        updateDeepCard(tempCardId, {
          type: "concept",
          title: `Deep Dive: ${text.slice(0, 40)}${text.length > 40 ? '...' : ''}`,
          content: content || `## ${text}\n\nUnable to generate explanation. Please try again.`,
          equations: [],
          quiz_data: [],
          diagram_description: diagram_description,
          graph_data: graph_data,
          status: 'complete'
        });
      } else {
        // ✨ No valid response at all
        updateDeepCard(tempCardId, {
          type: "concept",
          title: `Deep Dive: ${text.slice(0, 40)}...`,
          content: `## ${text}\n\nNo response received. Please try again.`,
          equations: [],
          quiz_data: [],
          status: 'error'
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
            <Reorder.Group
              axis="x"
              values={visibleTabs}
              onReorder={reorderNotebookTabs}
              className="flex items-center gap-1"
            >
              {visibleTabs.map((tab) => (
                <Reorder.Item
                  key={tab.id}
                  value={tab}
                  className="relative"
                >
                  <ContextMenu>
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
                          {/* ✨ Star indicator from synced file */}
                          {(() => {
                            const file = knowledgeFolders.flatMap(f => f.files).find(f => f.id === tab.syncInfo?.fileId);
                            return file?.isStarred ? <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" /> : null;
                          })()}
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
                        onClick={async () => {
                          // ✨ Duplicate tab logic
                          const iumFile = exportTabAsIum(tab.id);
                          if (iumFile) {
                            // Modify title for duplicate
                            iumFile.metadata.title = `${iumFile.metadata.title} (Copy)`;
                            // Load as new tab
                            const newTabId = loadTabFromIum(iumFile, activeFolderId || "folder-1");
                            // ✨ Only auto-save if tab has cells (empty tabs save on first cell creation)
                            if (activeFolderId && iumFile.cells && iumFile.cells.length > 0) {
                              await saveTabToSupabase(newTabId, activeFolderId, false);
                              toast({ title: "Tab duplicated", description: "Duplicate tab created and saved." });
                            } else {
                              toast({ title: "Tab duplicated", description: "Empty tab created. Save on first cell." });
                            }
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleDownloadTab(tab.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download as .ium
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => openRenameDialog(tab.id)}>
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
                </Reorder.Item>
              ))}
            </Reorder.Group>

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

            {/* ✨ Close All Tabs Button */}
            {visibleTabs.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  visibleTabs.forEach(tab => deleteNotebookTab(tab.id));
                  toast({ title: "All tabs closed", description: `Closed ${visibleTabs.length} tabs.` });
                }}
                title="Close all tabs"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
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
          <div 
            ref={containerRef as React.RefObject<HTMLDivElement>} 
            className={cn(
              "flex-1 min-w-0 flex flex-col h-full transition-colors",
              isDragOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drop overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none">
                <div className="bg-background border-2 border-dashed border-primary rounded-lg px-8 py-6 text-center">
                  <FileText className="h-10 w-10 text-primary mx-auto mb-2" />
                  <p className="text-lg font-medium text-primary">Drop file to preview</p>
                  <p className="text-sm text-muted-foreground">File will be added as a preview cell</p>
                </div>
              </div>
            )}
            <ScrollArea className="flex-1 min-w-0">
              <div className="p-4 w-full max-w-full overflow-hidden">
                {/* Float Elements */}
                {/* ✨ [Updated] Only show DeepMode cursor when there is content (active tab with cells OR active document) */}
                {((activeTab?.cells?.length ?? 0) > 0 || !!activeDocument) && (
                  <DeepModeCursor
                    visible={hoverCursor.visible}
                    progress={hoverCursor.progress}
                    position={hoverCursor.position}
                  />
                )}
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
                        <SingleCellErrorBoundary
                          key={cell.id}
                          cell={cell}
                          tabId={activeTab.id}
                          setCellRef={setCellRef}
                        >
                          <CellRenderer
                            cell={cell}
                            tabId={activeTab.id}
                            ref={(el) => setCellRef(cell.id, el)}
                            onDeepDive={handleDeepDive}
                          />
                        </SingleCellErrorBoundary>
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

      {/* ✨ Rename Tab Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Tab</DialogTitle>
            <DialogDescription>
              Enter a new name for this notebook tab.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="New tab name"
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRenameTab();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRenameTab}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete from Cloud</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{notebookTabs.find(t => t.id === deleteTabId)?.title}" from the cloud? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteFromCloud}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  // ✨ User requested "content disappear" when all tabs closed.
  // We'll return null to render nothing, or a very minimal empty state.
  return null;
}