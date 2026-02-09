/**
 * Type definitions for notebook data structures
 * Compatible with .ipynb-like JSON format
 */

// Cell types matching the existing store.ts definitions
export type CellType = "concept" | "math" | "code" | "summary" | "quiz" | "flashcard" | "table" | "file-preview" | "notes";

export interface QuizOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: QuizOption[];
  explanation: string;
}

// Single cell within a notebook
export interface NotebookCell {
  id: string;
  type: CellType;
  title: string;
  content: string; // Markdown content
  equations?: string[]; // LaTeX strings
  diagram_description?: string;
  mermaid_code?: string;
  graph_data?: { // ✨ [Fix] Include graph_data for diagram cells
    nodes: Array<{ id: string; label: string; type?: string }>;
    edges: Array<{ source: string; target: string; label?: string }>;
  };
  quiz_data?: QuizQuestion[];
  flashcard_data?: Array<{ front: string; back: string }>; // ✨ [Fix] Include flashcard_data
  table_data?: { // ✨ [Fix] Include table_data for table cells
    headers: string[];
    rows: string[][];
  };
  file_preview?: { // ✨ [Fix] Include file_preview for file-preview cells
    fileName: string;
    fileType: string;
    fileUrl: string;
    fileId?: string;
  };
  isBookmarked: boolean;
  createdAt: number;
  updatedAt?: number;
}

// Notebook metadata
export interface NotebookMetadata {
  title: string;
  createdAt: number;
  updatedAt: number;
  author?: string;
  description?: string;
  tags?: string[];
}

// Full notebook content structure (stored in JSONB)
export interface NotebookContent {
  version: string; // e.g., "1.0"
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

// Database row type
export interface NotebookRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  content: NotebookContent;
  created_at: string;
  updated_at: string;
}

// For creating a new notebook
export interface CreateNotebookInput {
  title?: string;
  folder_id?: string;
  content?: Partial<NotebookContent>;
}

// For updating a notebook
export interface UpdateNotebookInput {
  title?: string;
  folder_id?: string;
  content?: NotebookContent;
}

// Save status for UI feedback
export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Hook return type
export interface UseAutoSaveNotebookReturn {
  // Data
  notebook: NotebookRow | null;
  content: NotebookContent | null;

  // Status
  isLoading: boolean;
  saveStatus: SaveStatus;
  error: Error | null;
  lastSavedAt: Date | null;

  // Actions
  updateContent: (newContent: NotebookContent) => void;
  updateCell: (cellId: string, updates: Partial<NotebookCell>) => void;
  addCell: (cell: Omit<NotebookCell, "id" | "createdAt" | "isBookmarked">) => string;
  deleteCell: (cellId: string) => void;
  updateTitle: (newTitle: string) => void;
  forceSave: () => Promise<void>;

  // Utilities
  hasUnsavedChanges: boolean;
}
