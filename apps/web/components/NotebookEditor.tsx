"use client";

import { useState, useEffect } from "react";
import { useAutoSaveNotebook, createNotebook } from "@/hooks/useAutoSaveNotebook";
import type { NotebookCell, SaveStatus } from "@/types/notebook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  BookOpen,
  FileText,
  Code,
  Calculator,
  ListChecks,
  Sparkles,
} from "lucide-react";

// =============================================================================
// Save Status Indicator Component
// =============================================================================

function SaveStatusIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: Date | null }) {
  const getStatusDisplay = () => {
    switch (status) {
      case "saving":
        return (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Saving...</span>
          </div>
        );
      case "saved":
        return (
          <div className="flex items-center gap-1.5 text-green-600">
            <Check className="h-3.5 w-3.5" />
            <span className="text-xs">Saved</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs">Error saving</span>
          </div>
        );
      default:
        return lastSavedAt ? (
          <span className="text-xs text-muted-foreground">
            Last saved {formatRelativeTime(lastSavedAt)}
          </span>
        ) : null;
    }
  };

  return <div className="h-5">{getStatusDisplay()}</div>;
}

// Helper to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

// =============================================================================
// Cell Type Icon
// =============================================================================

function CellTypeIcon({ type }: { type: NotebookCell["type"] }) {
  const iconProps = { className: "h-4 w-4" };

  switch (type) {
    case "concept":
      return <BookOpen {...iconProps} />;
    case "math":
      return <Calculator {...iconProps} />;
    case "code":
      return <Code {...iconProps} />;
    case "summary":
      return <FileText {...iconProps} />;
    case "quiz":
      return <ListChecks {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
}

// =============================================================================
// Single Cell Editor
// =============================================================================

interface CellEditorProps {
  cell: NotebookCell;
  onUpdate: (updates: Partial<NotebookCell>) => void;
  onDelete: () => void;
}

function CellEditor({ cell, onUpdate, onDelete }: CellEditorProps) {
  return (
    <div className="group border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
      {/* Cell Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/10 text-primary">
            <CellTypeIcon type={cell.type} />
          </div>
          <Input
            value={cell.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Cell title..."
            className="h-8 w-48 text-sm font-medium border-none bg-transparent focus-visible:ring-1"
          />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {cell.type}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Cell Content */}
      <Textarea
        value={cell.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder="Write your content in Markdown..."
        className="min-h-[120px] resize-y text-sm font-mono break-all whitespace-pre-wrap"
      />

      {/* Cell Footer */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>ID: {cell.id.slice(0, 12)}...</span>
        {cell.updatedAt && (
          <span>Updated: {new Date(cell.updatedAt).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main NotebookEditor Component
// =============================================================================

interface NotebookEditorProps {
  notebookId: string | null;
  userId: string;
  folderId?: string;
  onNotebookCreated?: (notebookId: string) => void;
}

export function NotebookEditor({
  notebookId,
  userId,
  folderId,
  onNotebookCreated,
}: NotebookEditorProps) {
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(notebookId);
  const [isCreating, setIsCreating] = useState(false);

  const {
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
  } = useAutoSaveNotebook(currentNotebookId, userId, {
    debounceMs: 1500,
    onSaveSuccess: () => {
      console.log("Notebook saved successfully!");
    },
    onSaveError: (err) => {
      console.error("Save failed:", err);
    },
  });

  // Create new notebook if none provided
  const handleCreateNotebook = async () => {
    setIsCreating(true);
    try {
      const newNotebook = await createNotebook(userId, "New Notebook", folderId);
      if (newNotebook) {
        setCurrentNotebookId(newNotebook.id);
        onNotebookCreated?.(newNotebook.id);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Add new cell
  const handleAddCell = (type: NotebookCell["type"]) => {
    addCell({
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      content: "",
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No notebook - show create button
  if (!currentNotebookId || !content) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <BookOpen className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">No notebook selected</p>
        <Button onClick={handleCreateNotebook} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create New Tab
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Input
            value={content.metadata.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="text-lg font-semibold border-none bg-transparent w-64 focus-visible:ring-1"
            placeholder="Notebook title..."
          />
          <span className="text-xs text-muted-foreground">
            {content.cells.length} cell{content.cells.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          <Button variant="outline" size="sm" onClick={forceSave}>
            Save Now
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 inline mr-2" />
          {error.message}
        </div>
      )}

      {/* Cells */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {content.cells.map((cell) => (
          <CellEditor
            key={cell.id}
            cell={cell}
            onUpdate={(updates) => updateCell(cell.id, updates)}
            onDelete={() => deleteCell(cell.id)}
          />
        ))}

        {/* Empty state */}
        {content.cells.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-2">This tab is empty</p>
            <p className="text-sm text-muted-foreground/70">
              Add a cell below to get started
            </p>
          </div>
        )}
      </div>

      {/* Add Cell Toolbar */}
      <div className="border-t px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-2">Add cell:</span>
          {(["concept", "math", "code", "summary", "quiz"] as const).map((type) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAddCell(type)}
            >
              <CellTypeIcon type={type} />
              <span className="ml-1.5 capitalize">{type}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Usage Example Component
// =============================================================================

export function NotebookEditorExample() {
  // In a real app, you'd get these from auth context and routing
  const mockUserId = "user-123-456-789";
  const [notebookId, setNotebookId] = useState<string | null>(null);

  return (
    <div className="h-screen bg-background">
      <NotebookEditor
        notebookId={notebookId}
        userId={mockUserId}
        folderId="folder-1"
        onNotebookCreated={(id) => {
          setNotebookId(id);
          console.log("Created notebook:", id);
        }}
      />
    </div>
  );
}
