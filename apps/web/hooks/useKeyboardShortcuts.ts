"use client";

import { useEffect, useCallback, useState } from "react";
import { useAppStore } from "@/lib/store";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac
  description: string;
  category: "navigation" | "editing" | "panels" | "general";
  action: () => void;
}

// Check if we're on Mac
const isMac = typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;

export function useKeyboardShortcuts() {
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  const {
    // Panel controls
    leftPanelMinimized,
    rightPanelMinimized,
    bottomPanelMinimized,
    setLeftPanelMinimized,
    setRightPanelMinimized,
    setBottomPanelMinimized,
    
    // Tab controls
    notebookTabs,
    notebookActiveTabId,
    createNotebookTab,
    deleteNotebookTab,
    setNotebookActiveTab,
    
    // Other
    activeFolderId,
  } = useAppStore();

  // Navigate to previous tab
  const goToPrevTab = useCallback(() => {
    if (!notebookActiveTabId || notebookTabs.length <= 1) return;
    const currentIndex = notebookTabs.findIndex(t => t.id === notebookActiveTabId);
    const prevIndex = (currentIndex - 1 + notebookTabs.length) % notebookTabs.length;
    setNotebookActiveTab(notebookTabs[prevIndex].id);
  }, [notebookActiveTabId, notebookTabs, setNotebookActiveTab]);

  // Navigate to next tab
  const goToNextTab = useCallback(() => {
    if (!notebookActiveTabId || notebookTabs.length <= 1) return;
    const currentIndex = notebookTabs.findIndex(t => t.id === notebookActiveTabId);
    const nextIndex = (currentIndex + 1) % notebookTabs.length;
    setNotebookActiveTab(notebookTabs[nextIndex].id);
  }, [notebookActiveTabId, notebookTabs, setNotebookActiveTab]);

  // Create new tab
  const createNewTab = useCallback(() => {
    createNotebookTab("New Tab", activeFolderId || undefined);
  }, [createNotebookTab, activeFolderId]);

  // Close current tab
  const closeCurrentTab = useCallback(() => {
    if (notebookActiveTabId) {
      deleteNotebookTab(notebookActiveTabId);
    }
  }, [notebookActiveTabId, deleteNotebookTab]);

  // Toggle panels
  const toggleLeftPanel = useCallback(() => {
    setLeftPanelMinimized(!leftPanelMinimized);
  }, [leftPanelMinimized, setLeftPanelMinimized]);

  const toggleRightPanel = useCallback(() => {
    setRightPanelMinimized(!rightPanelMinimized);
  }, [rightPanelMinimized, setRightPanelMinimized]);

  const toggleBottomPanel = useCallback(() => {
    setBottomPanelMinimized(!bottomPanelMinimized);
  }, [bottomPanelMinimized, setBottomPanelMinimized]);

  // Focus chat input
  const focusChat = useCallback(() => {
    const chatInput = document.querySelector('[data-chat-input]') as HTMLTextAreaElement;
    if (chatInput) {
      chatInput.focus();
    }
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea (except for panel toggles)
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + B: Toggle left panel (sidebar)
      if (modKey && e.key === "b") {
        e.preventDefault();
        toggleLeftPanel();
        return;
      }

      // Ctrl/Cmd + J: Toggle bottom panel
      if (modKey && e.key === "j") {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      // Ctrl/Cmd + /: Toggle right panel (chat) & focus
      if (modKey && e.key === "/") {
        e.preventDefault();
        if (rightPanelMinimized) {
          setRightPanelMinimized(false);
          setTimeout(focusChat, 100);
        } else {
          focusChat();
        }
        return;
      }

      // Skip remaining shortcuts if in input field
      if (isInputField) return;

      // Ctrl/Cmd + N: New tab
      if (modKey && e.key === "n") {
        e.preventDefault();
        createNewTab();
        return;
      }

      // Ctrl/Cmd + W: Close current tab
      if (modKey && e.key === "w") {
        e.preventDefault();
        closeCurrentTab();
        return;
      }

      // Ctrl/Cmd + Tab or Ctrl + PageDown: Next tab
      if ((modKey && e.key === "Tab" && !e.shiftKey) || (e.ctrlKey && e.key === "PageDown")) {
        e.preventDefault();
        goToNextTab();
        return;
      }

      // Ctrl/Cmd + Shift + Tab or Ctrl + PageUp: Previous tab
      if ((modKey && e.key === "Tab" && e.shiftKey) || (e.ctrlKey && e.key === "PageUp")) {
        e.preventDefault();
        goToPrevTab();
        return;
      }

      // Escape: Close modals or unfocus
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement)?.blur();
        return;
      }

      // Ctrl/Cmd + 1-9: Switch to tab by number
      if (modKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < notebookTabs.length) {
          setNotebookActiveTab(notebookTabs[tabIndex].id);
        }
        return;
      }

      // ? key: Open shortcuts dialog
      if (e.key === "?" && e.shiftKey) {
        e.preventDefault();
        // Trigger custom event to open dialog
        window.dispatchEvent(new CustomEvent("openKeyboardShortcuts"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
    createNewTab,
    closeCurrentTab,
    goToNextTab,
    goToPrevTab,
    focusChat,
    rightPanelMinimized,
    setRightPanelMinimized,
    notebookTabs,
    setNotebookActiveTab,
  ]);

  return {
    goToPrevTab,
    goToNextTab,
    createNewTab,
    closeCurrentTab,
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
    focusChat,
  };
}

// Exported shortcut definitions for the help dialog
export const KEYBOARD_SHORTCUTS = [
  // Panels
  { keys: ["⌘/Ctrl", "B"], description: "Toggle sidebar", category: "panels" },
  { keys: ["⌘/Ctrl", "J"], description: "Toggle bottom panel", category: "panels" },
  { keys: ["⌘/Ctrl", "/"], description: "Focus chat", category: "panels" },
  
  // Tabs
  { keys: ["⌘/Ctrl", "N"], description: "New tab", category: "tabs" },
  { keys: ["⌘/Ctrl", "W"], description: "Close current tab", category: "tabs" },
  { keys: ["⌘/Ctrl", "Tab"], description: "Next tab", category: "tabs" },
  { keys: ["⌘/Ctrl", "⇧", "Tab"], description: "Previous tab", category: "tabs" },
  { keys: ["⌘/Ctrl", "1-9"], description: "Switch to tab #", category: "tabs" },
  
  // Flashcard (when focused)
  { keys: ["Space"], description: "Flip card", category: "flashcard" },
  { keys: ["←", "→"], description: "Navigate cards", category: "flashcard" },
  
  // General
  { keys: ["?"], description: "Open shortcuts help", category: "general" },
  { keys: ["Esc"], description: "Unfocus / Close modal", category: "general" },
] as const;
