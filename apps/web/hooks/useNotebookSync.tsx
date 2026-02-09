"use client";

/**
 * useNotebookSync - Bridge between Zustand store and Supabase PostgreSQL
 *
 * This hook synchronizes the existing NotebookTab state from store.ts
 * with the new PostgreSQL-backed notebooks table.
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAppStore, NotebookTab, Cell } from "@/lib/store";
import type { NotebookContent, NotebookCell, SaveStatus } from "@/types/notebook";

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Debounce delay
const DEBOUNCE_MS = 1500;

// =============================================================================
// Type Converters
// =============================================================================

/**
 * Convert store Cell to NotebookCell (DB format)
 */
function cellToNotebookCell(cell: Cell): NotebookCell {
  return {
    id: cell.id,
    type: cell.type,
    title: cell.title,
    content: cell.content,
    equations: cell.equations,
    diagram_description: cell.diagram_description,
    mermaid_code: cell.mermaid_code,
    graph_data: cell.graph_data, // ✨ [Fix] Include graph_data
    quiz_data: cell.quiz_data,
    flashcard_data: cell.flashcard_data, // ✨ [Fix] Include flashcard_data
    table_data: cell.table_data, // ✨ [Fix] Include table_data
    file_preview: cell.file_preview, // ✨ [Fix] Include file_preview
    isBookmarked: cell.isBookmarked,
    createdAt: cell.createdAt,
    updatedAt: cell.updatedAt,
  };
}

/**
 * Convert NotebookCell (DB format) to store Cell
 */
function notebookCellToCell(cell: NotebookCell): Cell {
  return {
    id: cell.id,
    type: cell.type,
    title: cell.title,
    content: cell.content,
    equations: cell.equations,
    diagram_description: cell.diagram_description,
    mermaid_code: cell.mermaid_code,
    graph_data: cell.graph_data, // ✨ [Fix] Include graph_data
    quiz_data: cell.quiz_data,
    flashcard_data: cell.flashcard_data, // ✨ [Fix] Include flashcard_data
    table_data: cell.table_data, // ✨ [Fix] Include table_data
    file_preview: cell.file_preview, // ✨ [Fix] Include file_preview
    isBookmarked: cell.isBookmarked,
    createdAt: cell.createdAt,
    updatedAt: cell.updatedAt,
  };
}

/**
 * Convert NotebookTab to NotebookContent (DB JSONB format)
 */
function tabToNotebookContent(tab: NotebookTab): NotebookContent {
  return {
    version: "1.0",
    metadata: {
      title: tab.title,
      createdAt: tab.createdAt,
      updatedAt: tab.updatedAt,
    },
    cells: tab.cells.map(cellToNotebookCell),
  };
}

/**
 * Convert NotebookContent (DB JSONB) to NotebookTab
 */
function notebookContentToTab(
  content: NotebookContent,
  tabId: string,
  dbNotebookId?: string
): NotebookTab {
  return {
    id: tabId,
    title: content.metadata.title,
    cells: content.cells.map(notebookCellToCell),
    createdAt: content.metadata.createdAt,
    updatedAt: content.metadata.updatedAt,
    syncInfo: dbNotebookId
      ? {
          fileId: dbNotebookId,
          folderId: "",
          fileName: `${content.metadata.title}.ium`,
          lastSyncedAt: Date.now(),
        }
      : undefined,
  };
}

// =============================================================================
// Main Hook
// =============================================================================

interface UseNotebookSyncOptions {
  userId: string | null;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseNotebookSyncReturn {
  saveStatus: SaveStatus;
  lastSyncedAt: Date | null;
  error: Error | null;
  syncNow: () => Promise<void>;
  loadFromDatabase: (notebookId: string) => Promise<void>;
  createInDatabase: (tabId: string, folderId?: string) => Promise<string | null>;
}

export function useNotebookSync(options: UseNotebookSyncOptions): UseNotebookSyncReturn {
  const { userId, enabled = true, debounceMs = DEBOUNCE_MS } = options;

  // Zustand store
  const notebookTabs = useAppStore((state) => state.notebookTabs);
  const notebookActiveTabId = useAppStore((state) => state.notebookActiveTabId);
  const setSyncInfo = useAppStore((state) => state.setSyncInfo);

  // Local state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousContentRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);

  // Get active tab
  const activeTab = notebookTabs.find((t) => t.id === notebookActiveTabId);

  // ==========================================================================
  // Sync to Database
  // ==========================================================================

  const syncToDatabase = useCallback(
    async (tab: NotebookTab) => {
      if (!userId || !tab.syncInfo?.fileId || isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      setSaveStatus("saving");

      try {
        const content = tabToNotebookContent(tab);

        const { error: updateError } = await supabase
          .from("notebooks")
          .update({
            title: content.metadata.title,
            content,
          })
          .eq("id", tab.syncInfo.fileId)
          .eq("user_id", userId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        setSaveStatus("saved");
        setLastSyncedAt(new Date());
        setError(null);

        // Update sync info in store
        setSyncInfo(tab.id, {
          ...tab.syncInfo,
          lastSyncedAt: Date.now(),
        });

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus((current) => (current === "saved" ? "idle" : current));
        }, 2000);
      } catch (err) {
        setSaveStatus("error");
        setError(err instanceof Error ? err : new Error("Sync failed"));
      } finally {
        isSyncingRef.current = false;
      }
    },
    [userId, setSyncInfo]
  );

  // ==========================================================================
  // Watch for Changes and Debounce Sync
  // ==========================================================================

  useEffect(() => {
    if (!enabled || !activeTab || !activeTab.syncInfo?.fileId) {
      return;
    }

    // Serialize current content for comparison
    const currentContent = JSON.stringify(tabToNotebookContent(activeTab));

    // Skip if content hasn't changed
    if (currentContent === previousContentRef.current) {
      return;
    }

    previousContentRef.current = currentContent;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      syncToDatabase(activeTab);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activeTab, enabled, debounceMs, syncToDatabase]);

  // ==========================================================================
  // Manual Actions
  // ==========================================================================

  const syncNow = useCallback(async () => {
    if (!activeTab) return;

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    await syncToDatabase(activeTab);
  }, [activeTab, syncToDatabase]);

  const loadFromDatabase = useCallback(
    async (notebookId: string) => {
      if (!userId) return;

      try {
        const { data, error: fetchError } = await supabase
          .from("notebooks")
          .select("*")
          .eq("id", notebookId)
          .eq("user_id", userId)
          .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (data) {
          // Convert and add to store via loadTabFromIum
          const loadTabFromIum = useAppStore.getState().loadTabFromIum;
          const content = data.content as NotebookContent;

          // Use existing loadTabFromIum function with IumFile format
          loadTabFromIum(
            {
              version: content.version,
              metadata: content.metadata,
              cells: content.cells,
            },
            data.folder_id || undefined
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load notebook"));
      }
    },
    [userId]
  );

  const createInDatabase = useCallback(
    async (tabId: string, folderId?: string): Promise<string | null> => {
      if (!userId) return null;

      const tab = notebookTabs.find((t) => t.id === tabId);
      if (!tab) return null;

      try {
        const content = tabToNotebookContent(tab);

        const { data, error: insertError } = await supabase
          .from("notebooks")
          .insert({
            user_id: userId,
            folder_id: folderId || null,
            title: content.metadata.title,
            content,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        if (data) {
          // Update sync info in store
          setSyncInfo(tabId, {
            fileId: data.id,
            folderId: folderId || "",
            fileName: `${content.metadata.title}.ium`,
            lastSyncedAt: Date.now(),
          });

          return data.id;
        }

        return null;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to create notebook"));
        return null;
      }
    },
    [userId, notebookTabs, setSyncInfo]
  );

  return {
    saveStatus,
    lastSyncedAt,
    error,
    syncNow,
    loadFromDatabase,
    createInDatabase,
  };
}

// =============================================================================
// Simple Status Indicator Component
// =============================================================================

export function NotebookSyncStatus({
  status,
  lastSyncedAt,
}: {
  status: SaveStatus;
  lastSyncedAt: Date | null;
}) {
  if (status === "saving") {
    return <span className="text-xs text-muted-foreground animate-pulse">Syncing...</span>;
  }

  if (status === "saved") {
    return <span className="text-xs text-green-600">Synced</span>;
  }

  if (status === "error") {
    return <span className="text-xs text-red-600">Sync error</span>;
  }

  if (lastSyncedAt) {
    const diffMs = Date.now() - lastSyncedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return (
      <span className="text-xs text-muted-foreground">
        {diffMins < 1 ? "Synced just now" : `Synced ${diffMins}m ago`}
      </span>
    );
  }

  return null;
}
