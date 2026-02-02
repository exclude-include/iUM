"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import type {
  NotebookRow,
  NotebookContent,
  NotebookCell,
  SaveStatus,
  UseAutoSaveNotebookReturn,
} from "@/types/notebook";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 1500;

// Default empty notebook content
const createEmptyContent = (title: string = "Untitled Notebook"): NotebookContent => ({
  version: "1.0",
  metadata: {
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  cells: [],
});

/**
 * useAutoSaveNotebook - Auto-save notebook to Supabase PostgreSQL with debouncing
 *
 * @param notebookId - UUID of the notebook to load/save (null for new notebook)
 * @param userId - Current user's UUID
 * @param options - Optional configuration
 */
export function useAutoSaveNotebook(
  notebookId: string | null,
  userId: string | null,
  options?: {
    debounceMs?: number;
    onSaveSuccess?: () => void;
    onSaveError?: (error: Error) => void;
  }
): UseAutoSaveNotebookReturn {
  const debounceMs = options?.debounceMs ?? DEBOUNCE_DELAY;

  // State
  const [notebook, setNotebook] = useState<NotebookRow | null>(null);
  const [content, setContent] = useState<NotebookContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs for tracking changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<NotebookContent | null>(null);
  const isSavingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);

  // Load notebook on mount or when notebookId changes
  useEffect(() => {
    if (!notebookId || !userId) {
      setIsLoading(false);
      return;
    }

    const loadNotebook = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("notebooks")
          .select("*")
          .eq("id", notebookId)
          .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (data) {
          setNotebook(data as NotebookRow);
          setContent(data.content as NotebookContent);
          setLastSavedAt(new Date(data.updated_at));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load notebook"));
      } finally {
        setIsLoading(false);
      }
    };

    loadNotebook();
  }, [notebookId, userId]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Save function (internal)
  const saveToDatabase = useCallback(
    async (contentToSave: NotebookContent) => {
      if (!notebookId || !userId || isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      setSaveStatus("saving");

      try {
        const { error: updateError } = await supabase
          .from("notebooks")
          .update({
            title: contentToSave.metadata.title,
            content: contentToSave,
            // updated_at is handled by the trigger
          })
          .eq("id", notebookId)
          .eq("user_id", userId); // Extra safety check

        if (updateError) {
          throw new Error(updateError.message);
        }

        setSaveStatus("saved");
        setLastSavedAt(new Date());
        hasUnsavedChangesRef.current = false;
        options?.onSaveSuccess?.();

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus((current) => (current === "saved" ? "idle" : current));
        }, 2000);
      } catch (err) {
        setSaveStatus("error");
        const error = err instanceof Error ? err : new Error("Failed to save");
        setError(error);
        options?.onSaveError?.(error);
      } finally {
        isSavingRef.current = false;

        // Check if there are more pending changes
        if (pendingContentRef.current) {
          const pendingContent = pendingContentRef.current;
          pendingContentRef.current = null;
          saveToDatabase(pendingContent);
        }
      }
    },
    [notebookId, userId, options]
  );

  // Debounced save trigger
  const triggerDebouncedSave = useCallback(
    (newContent: NotebookContent) => {
      hasUnsavedChangesRef.current = true;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // If currently saving, queue the content for later
      if (isSavingRef.current) {
        pendingContentRef.current = newContent;
        return;
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        saveToDatabase(newContent);
      }, debounceMs);
    },
    [debounceMs, saveToDatabase]
  );

  // Update content (main editing function)
  const updateContent = useCallback(
    (newContent: NotebookContent) => {
      // Update local state immediately (Optimistic UI)
      setContent(newContent);

      // Trigger debounced save
      triggerDebouncedSave(newContent);
    },
    [triggerDebouncedSave]
  );

  // Update a single cell
  const updateCell = useCallback(
    (cellId: string, updates: Partial<NotebookCell>) => {
      if (!content) return;

      const newContent: NotebookContent = {
        ...content,
        metadata: {
          ...content.metadata,
          updatedAt: Date.now(),
        },
        cells: content.cells.map((cell) =>
          cell.id === cellId
            ? { ...cell, ...updates, updatedAt: Date.now() }
            : cell
        ),
      };

      updateContent(newContent);
    },
    [content, updateContent]
  );

  // Add a new cell
  const addCell = useCallback(
    (cellData: Omit<NotebookCell, "id" | "createdAt" | "isBookmarked">): string => {
      const cellId = `cell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const newCell: NotebookCell = {
        ...cellData,
        id: cellId,
        isBookmarked: false,
        createdAt: Date.now(),
      };

      if (!content) {
        // Create new content with this cell
        const newContent = createEmptyContent();
        newContent.cells = [newCell];
        updateContent(newContent);
      } else {
        const newContent: NotebookContent = {
          ...content,
          metadata: {
            ...content.metadata,
            updatedAt: Date.now(),
          },
          cells: [...content.cells, newCell],
        };
        updateContent(newContent);
      }

      return cellId;
    },
    [content, updateContent]
  );

  // Delete a cell
  const deleteCell = useCallback(
    (cellId: string) => {
      if (!content) return;

      const newContent: NotebookContent = {
        ...content,
        metadata: {
          ...content.metadata,
          updatedAt: Date.now(),
        },
        cells: content.cells.filter((cell) => cell.id !== cellId),
      };

      updateContent(newContent);
    },
    [content, updateContent]
  );

  // Update title
  const updateTitle = useCallback(
    (newTitle: string) => {
      if (!content) return;

      const newContent: NotebookContent = {
        ...content,
        metadata: {
          ...content.metadata,
          title: newTitle,
          updatedAt: Date.now(),
        },
      };

      updateContent(newContent);
    },
    [content, updateContent]
  );

  // Force save immediately (bypass debounce)
  const forceSave = useCallback(async () => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (content) {
      await saveToDatabase(content);
    }
  }, [content, saveToDatabase]);

  return {
    notebook,
    content,
    isLoading,
    saveStatus,
    error,
    lastSavedAt,
    updateContent,
    updateCell,
    addCell,
    deleteCell,
    updateTitle,
    forceSave,
    hasUnsavedChanges: hasUnsavedChangesRef.current,
  };
}

// =============================================================================
// Helper: Create a new notebook
// =============================================================================

export async function createNotebook(
  userId: string,
  title: string = "Untitled Notebook",
  folderId?: string
): Promise<NotebookRow | null> {
  const content = createEmptyContent(title);

  const { data, error } = await supabase
    .from("notebooks")
    .insert({
      user_id: userId,
      folder_id: folderId || null,
      title,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create notebook:", error);
    return null;
  }

  return data as NotebookRow;
}

// =============================================================================
// Helper: Delete a notebook
// =============================================================================

export async function deleteNotebook(
  notebookId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notebooks")
    .delete()
    .eq("id", notebookId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete notebook:", error);
    return false;
  }

  return true;
}

// =============================================================================
// Helper: List user's notebooks
// =============================================================================

export async function listNotebooks(
  userId: string,
  folderId?: string
): Promise<NotebookRow[]> {
  let query = supabase
    .from("notebooks")
    .select("id, user_id, folder_id, title, created_at, updated_at, content")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (folderId) {
    query = query.eq("folder_id", folderId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to list notebooks:", error);
    return [];
  }

  return data as NotebookRow[];
}
