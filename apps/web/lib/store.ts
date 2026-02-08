import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Document } from "@/types";
import type { ChatMessage } from "@/types/api";

type ViewMode = "hard" | "soft";

interface ActiveDocument {
  id: string;
  title: string;
  content?: string;
  content_type?: "text" | "pdf" | "markdown";
  sections?: Array<{
    title: string;
    content: string;
  }>;
  equations?: string[];
}

export interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
  relevance_score?: number;
}

export interface QuizOption {
  id: string; // e.g., 'A', 'B', 'C', 'D'
  text: string;
  is_correct: boolean;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: QuizOption[];
  explanation: string;
}



// Graph Data for Reactflow
export interface GraphNode {
  id: string;
  label: string;
  type?: string; // 'input', 'output', 'default'
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Cell type for notebook cells
export type CellType = "concept" | "math" | "code" | "summary" | "quiz";

// Cell interface - a single learning unit within a notebook tab
export interface Cell {
  id: string;
  type: CellType;
  title: string;
  content: string; // Markdown text
  equations?: string[]; // LaTeX strings
  diagram_description?: string;
  mermaid_code?: string;
  graph_data?: GraphData;
  quiz_data?: QuizQuestion[];
  isBookmarked: boolean;
  createdAt: number;
  updatedAt?: number;
  status?: 'loading' | 'complete' | 'error';
  /** Deep card: source in main tab that triggered this card */
  sourceTabId?: string;
  sourceCellId?: string;
  sourceBlockIndex?: number;
  /** Exact text the user selected for this Deep Dive (for partial highlight) */
  sourceSelectedText?: string;
  /** Notebook cell: added from Deep sidebar */
  fromDeep?: boolean;
}

// Sync info for tabs linked to Supabase files
export interface TabSyncInfo {
  fileId: string;       // Supabase file ID
  folderId: string;     // Folder where the file is stored
  fileName: string;     // Current file name in storage
  lastSyncedAt: number; // Last successful sync timestamp
}

// NotebookTab interface - container for multiple cells (like .ipynb)
export interface NotebookTab {
  id: string;
  title: string;
  cells: Cell[];
  createdAt: number;
  updatedAt: number;
  syncInfo?: TabSyncInfo; // Optional sync info when saved to Supabase
  folderId?: string;      // ✨ [Added] Folder ID this tab belongs to
}

// Bookmark reference for sidebar navigation
export interface BookmarkRef {
  cellId: string;
  tabId: string;
  cellTitle: string;
  cellType: CellType;
  /** e.g. ['deep'] when cell was added from Deep */
  tags?: string[];
}

// Input type from API/Chat responses (matches backend contract)
export interface LearningUnitInput {
  title: string;
  type: CellType;
  content: string; // Markdown text
  equations?: string[]; // LaTeX strings
  diagram_description?: string;
  mermaid_code?: string;
  graph_data?: GraphData;
  quiz_data?: QuizQuestion[];
  /** When true, cell is marked as added from Deep (for bookmark tag) */
  fromDeep?: boolean;
}

// .ium file format - like .ipynb but for iUM notebooks
export interface IumFile {
  version: string; // e.g., "1.0"
  metadata: {
    title: string;
    createdAt: number;
    updatedAt: number;
    author?: string;
  };
  cells: Array<{
    id: string;
    type: CellType;
    title: string;
    content: string;
    equations?: string[];
    diagram_description?: string;
    mermaid_code?: string;
    graph_data?: GraphData;
    quiz_data?: QuizQuestion[];
    isBookmarked: boolean;
    createdAt: number;
    updatedAt?: number;
  }>;
}

/** @deprecated Use LearningUnitInput for API inputs, Cell for internal state */
export interface LearningUnit {
  title: string;
  type: "concept" | "math" | "code" | "summary" | "quiz";
  content: string; // Markdown text
  equations?: string[]; // LaTeX strings
  diagram_description?: string;
  mermaid_code?: string;
  graph_data?: GraphData;
  quiz_data?: QuizQuestion[];
}

/** @deprecated Use NotebookTab instead */
export interface LearningTab extends LearningUnit {
  id: string;
  timestamp: number;
}

// Knowledge Folder System
export interface UploadedFile {
  id: string;
  name: string;
  url?: string; // or path
  uploadedAt: number; // ✨ [Updated] Unix timestamp
  is_temp?: boolean; // ✨ Added for temporary save status
  isStarred?: boolean; // ✨ Added for starred status
  isOpen?: boolean; // ✨ Added for open tab state tracking
}

export interface KnowledgeFolder {
  id: string;
  name: string;
  color: string; // e.g., "#3B82F6" (Blue), "#EF4444" (Red)
  files: UploadedFile[];
  chatHistory: ChatMessage[];
}

// Legacy ChatSession interface
export interface ChatSession {
  id: string;
  title: string;
  folderId?: string;
  messages: ChatMessage[];
  lastUpdated: number;
}

// History Timeline
export interface TimelineEvent {
  id: string;
  title: string;
  category: 'concept' | 'code' | 'review' | 'quiz';
  startTime: string; // ISO String
  duration: number; // in minutes
}

// Learning Streaks
export interface UserStreak {
  currentStreak: number;
  lastStudyDate: string | null; // YYYY-MM-DD
  history: string[];
}

interface AppState {
  // View mode state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Active document state
  activeDocument: ActiveDocument | null;
  setActiveDocument: (document: ActiveDocument | null) => void;

  // === NEW: Notebook Tabs State (Multi-Cell like .ipynb) ===
  // ✨ [Added] Track active tab per folder
  folderActiveTabs: Record<string, string | null>;
  notebookTabs: NotebookTab[];
  notebookActiveTabId: string | null;
  scrollToCellId: string | null;

  // Notebook Tab Actions
  createNotebookTab: (title?: string, folderId?: string) => string;
  deleteNotebookTab: (tabId: string) => void;
  setNotebookActiveTab: (tabId: string | null) => void;
  renameNotebookTab: (tabId: string, newTitle: string) => void;

  // Cell Actions
  appendCellToActiveTab: (unit: LearningUnitInput) => string;
  insertCell: (tabId: string, cell: Omit<Cell, "id" | "createdAt" | "isBookmarked">, index?: number) => string;
  deleteCell: (tabId: string, cellId: string) => void;
  moveCellToNewTab: (sourceTabId: string, cellId: string, newTabTitle?: string) => string;
  updateCell: (tabId: string, cellId: string, updates: Partial<Cell>) => void;

  // Bookmark Actions
  toggleBookmark: (tabId: string, cellId: string) => void;
  getBookmarkedCells: () => BookmarkRef[];

  // Navigation Actions
  navigateToCell: (tabId: string, cellId: string) => void;
  clearScrollTarget: () => void;

  // === DEPRECATED: Legacy Learning Tabs (kept for backward compatibility) ===
  learningTabs: LearningTab[];
  activeTabId: string | null;
  addLearningTab: (unit: LearningUnit) => void;
  setActiveTab: (id: string | null) => void;
  closeTab: (id: string) => void;

  // Knowledge Folders state
  knowledgeFolders: KnowledgeFolder[];
  activeFolderId: string | null;
  createFolder: (name: string, color?: string) => string;
  setActiveFolder: (id: string | null) => void;
  updateFolder: (id: string, updates: Partial<KnowledgeFolder>) => void;
  deleteFolder: (id: string) => void;
  renameFolder: (id: string, newName: string) => void;
  addFileToFolder: (folderId: string, file: UploadedFile) => void;
  removeFileFromFolder: (folderId: string, fileName: string) => void;
  addMessageToFolder: (folderId: string, message: ChatMessage) => void;

  // Legacy Chat Sessions
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  createSession: () => string;
  addChatSession: (title: string, folderId?: string) => string;
  setActiveChatSession: (id: string | null) => void;
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void;
  addMessageToSession: (sessionId: string, message: ChatMessage) => void;
  deleteSession: (id: string) => void;
  deleteChatSession: (id: string) => void;
  renameSession: (id: string, newTitle: string) => void;

  // History timeline state
  timelineEvents: TimelineEvent[];
  addTimelineEvent: (event: { title: string; category: 'concept' | 'code' | 'review' | 'quiz'; startTime?: string; duration?: number }) => void;
  removeTimelineEvent: (id: string) => void;

  // Learning streaks state
  userStreak: UserStreak;
  updateStreak: (date?: string) => void;
  resetStreak: () => void;

  // 출처 패널 상태 관리
  activeSources: Source[];
  setActiveSources: (sources: Source[]) => void;

  // 파일 선택 상태 (NotebookLM 스타일)
  selectedDocumentIds: string[];
  toggleDocumentSelection: (id: string) => void;
  setSelectedDocuments: (ids: string[]) => void;

  // 마인드맵 팝업 상태
  isMindMapOpen: boolean;
  setMindMapOpen: (isOpen: boolean) => void;

  // 패널 최소화 상태 (Cursor 스타일: 좌측 메뉴, 채팅창, 하단 토글 탭)
  leftPanelMinimized: boolean;
  rightPanelMinimized: boolean;
  bottomPanelMinimized: boolean;
  setLeftPanelMinimized: (minimized: boolean) => void;
  setRightPanelMinimized: (minimized: boolean) => void;
  setBottomPanelMinimized: (minimized: boolean) => void;

  // ✨ Deep Mode State
  sidebarMode: "chat" | "deep";
  deepHistory: Cell[];
  scrollToDeepCardId: string | null;
  setSidebarMode: (mode: "chat" | "deep") => void;
  addDeepCard: (unit: LearningUnitInput) => string;
  updateDeepCard: (id: string, updates: Partial<Cell>) => void;
  setScrollToDeepCardId: (id: string | null) => void;
  clearScrollToDeepCardTarget: () => void;
  clearDeepHistory: () => void;
  setDeepHistory: (history: Cell[]) => void;
  hydrateNotebookBackup: (data: { tabs?: NotebookTab[]; activeTabId?: string | null; deepHistory?: Cell[] }) => void;
  saveUserNotebookStateToSupabase: () => Promise<void>;
  loadUserNotebookStateFromSupabase: () => Promise<void>;

  // ✨ [추가] 서버에서 파일 목록 불러오기 액션
  fetchFiles: () => Promise<void>;
  restoreOpenTabs: () => Promise<void>; // ✨ Restore open tabs on app load
  renameFile: (fileId: string, newName: string) => Promise<void>;
  toggleFileStar: (fileId: string, isStarred: boolean) => Promise<void>;
  toggleFileOpen: (fileId: string, isOpen: boolean) => Promise<void>;

  // .ium file actions - save/load notebook tabs
  exportTabAsIum: (tabId: string) => IumFile | null;
  saveTabToSupabase: (tabId: string, folderId: string, isTemp?: boolean) => Promise<{ success: boolean; fileId?: string; error?: string }>;
  loadTabFromIum: (iumData: IumFile, folderId?: string, fileId?: string, fileName?: string) => string;

  // Auto-sync actions
  syncTabToSupabase: (tabId: string) => Promise<void>;
  setSyncInfo: (tabId: string, syncInfo: TabSyncInfo) => void;
  _pendingSyncs: Set<string>; // Track tabs that need syncing
  _syncDebounceTimers: Map<string, NodeJS.Timeout>; // Debounce timers per tab
  queueTabSync: (tabId: string, immediate?: boolean) => void; // Queue a tab for sync with debounce
}

export const useAppStore = create<AppState>((set, get) => ({
  // View mode state
  viewMode: "hard",
  setViewMode: (mode) => set({ viewMode: mode }),

  // Active document state
  activeDocument: null,
  setActiveDocument: (document) => set({ activeDocument: document }),

  // === NEW: Notebook Tabs State ===
  notebookTabs: [],
  notebookActiveTabId: null,
  folderActiveTabs: {}, // ✨ [Added]
  scrollToCellId: null,

  createNotebookTab: (title, folderId) => {
    const state = get();
    // ✨ [Updated] Use provided folderId or current activeFolderId (or default)
    const targetFolderId = folderId || state.activeFolderId || "folder-1";
    let finalTitle: string;

    // Auto-generate unique title if not provided or is default
    if (!title || title === "New Tab" || title === "Untitled Tab" || title === "New Notebook" || title === "Untitled Notebook") {
      // Filter by folder for unique name check
      const existingTitles = state.notebookTabs
        .filter(t => t.folderId === targetFolderId || (!t.folderId && targetFolderId === "folder-1"))
        .map((t) => t.title);
      let counter = 1;
      let candidateTitle = "Tab 1";

      while (existingTitles.includes(candidateTitle)) {
        counter++;
        candidateTitle = `Tab ${counter}`;
      }
      finalTitle = candidateTitle;
    } else {
      finalTitle = title;
    }

    const id = `notebook-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const newTab: NotebookTab = {
      id,
      title: finalTitle,
      cells: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      folderId: targetFolderId, // ✨ [Added]
    };

    set((state) => ({
      notebookTabs: [...state.notebookTabs, newTab],
      notebookActiveTabId: id,
      // ✨ [Added] Update active tab for this folder
      folderActiveTabs: {
        ...state.folderActiveTabs,
        [targetFolderId]: id
      }
    }));
    return id;
  },

  deleteNotebookTab: (tabId) => {
    set((state) => {
      const tabToDelete = state.notebookTabs.find(t => t.id === tabId);
      const folderId = tabToDelete?.folderId || state.activeFolderId || "folder-1";

      const newTabs = state.notebookTabs.filter((tab) => tab.id !== tabId);
      let newActiveTabId = state.notebookActiveTabId;

      // If we are deleting the currently active tab
      if (state.notebookActiveTabId === tabId) {
        // Find other tabs in the SAME folder
        const folderTabs = newTabs.filter(t => (t.folderId || "folder-1") === folderId);

        if (folderTabs.length > 0) {
          // Try to find a previous sibling in the same folder, or pick first one
          // (Simplified: just pick the last one opened in that folder, or the last in list)
          newActiveTabId = folderTabs[folderTabs.length - 1].id;
        } else {
          newActiveTabId = null;
        }
      }

      return {
        notebookTabs: newTabs,
        notebookActiveTabId: newActiveTabId,
        // ✨ [Added] Update local history for that folder
        folderActiveTabs: {
          ...state.folderActiveTabs,
          [folderId]: newActiveTabId
        }
      };
    });

    // ✨ Mark file as closed in DB if it was synced
    const state = get();
    const closedTab = state.notebookTabs.find(t => t.id === tabId);
    if (closedTab?.syncInfo?.fileId) {
      get().toggleFileOpen(closedTab.syncInfo.fileId, false);
    }
  },

  setNotebookActiveTab: (tabId) => {
    const state = get();
    // If tabId is null, just clear it
    if (!tabId) {
      set({ notebookActiveTabId: null });
      return;
    }

    // Find the tab to get its folderId
    const tab = state.notebookTabs.find(t => t.id === tabId);
    if (!tab) return;

    // Use folderId from tab, or fallback to current active folder, or default
    const folderId = tab.folderId || state.activeFolderId || "folder-1";

    set((state) => ({
      notebookActiveTabId: tabId,
      // ✨ [Added] Remember this tab as active for its folder
      folderActiveTabs: {
        ...state.folderActiveTabs,
        [folderId]: tabId
      }
    }));
  },

  renameNotebookTab: (tabId, newTitle) => {
    set((state) => ({
      notebookTabs: state.notebookTabs.map((tab) =>
        tab.id === tabId ? { ...tab, title: newTitle, updatedAt: Date.now() } : tab
      ),
    }));
    // Immediate sync for rename (user expects file name to change right away)
    get().queueTabSync(tabId, true);
  },

  appendCellToActiveTab: (unit) => {
    const state = get();
    let tabId = state.notebookActiveTabId;

    console.log("[Store] appendCellToActiveTab called, activeTabId:", tabId, "tabs:", state.notebookTabs.length);

    // If no active tab exists or can't find it, try to use first existing tab
    if (!tabId || !state.notebookTabs.find((t) => t.id === tabId)) {
      if (state.notebookTabs.length > 0) {
        // Use existing first tab instead of creating new one
        tabId = state.notebookTabs[0].id;
        set({ notebookActiveTabId: tabId });
        console.log("[Store] Using existing first tab:", tabId);
      } else {
        // Only create new tab if no tabs exist
        tabId = get().createNotebookTab("Chat Session");
        console.log("[Store] Created new tab:", tabId);
      }
    }

    const cellId = `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Normalize graph_data so ReactFlow receives valid shape (nodes/edges arrays)
    let graph_data = unit.graph_data;
    if (graph_data && typeof graph_data === "object") {
      const nodes = Array.isArray(graph_data.nodes) ? graph_data.nodes : [];
      const edges = Array.isArray(graph_data.edges) ? graph_data.edges : [];
      if (nodes.length === 0 && edges.length === 0) graph_data = undefined;
      else graph_data = { nodes, edges };
    }
    const newCell: Cell = {
      id: cellId,
      type: unit.type,
      title: unit.title,
      content: unit.content,
      equations: unit.equations,
      diagram_description: unit.diagram_description,
      mermaid_code: unit.mermaid_code,
      graph_data,
      quiz_data: unit.quiz_data,
      isBookmarked: false,
      createdAt: Date.now(),
      fromDeep: unit.fromDeep ?? false,
    };

    console.log("[Store] Adding cell to tab:", tabId, "cell:", newCell.title);

    set((state) => ({
      notebookTabs: state.notebookTabs.map((tab) =>
        tab.id === tabId
          ? {
            ...tab,
            // ✨ Auto-title if first cell
            title: (tab.cells.length === 0 && newCell.title) ? newCell.title : tab.title,
            cells: [newCell, ...tab.cells],
            updatedAt: Date.now()
          }
          : tab
      ),
      scrollToCellId: cellId,
    }));

    // ✨ Auto-save (trigger even if new)
    if (tabId) get().queueTabSync(tabId);

    return cellId;
  },

  insertCell: (tabId, cellData, index) => {
    const cellId = `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCell: Cell = {
      ...cellData,
      id: cellId,
      isBookmarked: false,
      createdAt: Date.now(),
    };

    set((state) => ({
      notebookTabs: state.notebookTabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const cells = [...tab.cells];

        // ✨ Auto-title logic
        let newTitle = tab.title;
        if (cells.length === 0 && newCell.title) {
          newTitle = newCell.title;
        }

        if (index !== undefined && index >= 0 && index <= cells.length) {
          cells.splice(index, 0, newCell);
        } else {
          cells.push(newCell);
        }
        return { ...tab, title: newTitle, cells, updatedAt: Date.now() };
      }),
    }));

    // Queue auto-sync
    get().queueTabSync(tabId);

    return cellId;
  },

  deleteCell: (tabId, cellId) => {
    set((state) => ({
      notebookTabs: state.notebookTabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, cells: tab.cells.filter((c) => c.id !== cellId), updatedAt: Date.now() }
          : tab
      ),
    }));
    // Queue auto-sync
    get().queueTabSync(tabId);
  },

  moveCellToNewTab: (sourceTabId, cellId, newTabTitle) => {
    const state = get();
    const sourceTab = state.notebookTabs.find((t) => t.id === sourceTabId);
    const cell = sourceTab?.cells.find((c) => c.id === cellId);

    if (!cell) {
      console.error("Cell not found");
      return "";
    }

    const newTabId = `notebook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // ✨ Fix: Inherit folderId from source tab or use active folder
    const folderId = sourceTab?.folderId || state.activeFolderId || "folder-1";

    const newTab: NotebookTab = {
      id: newTabId,
      title: newTabTitle || cell.title || "Moved Cell",
      folderId, // ✨ Added: So tab shows in tab bar
      cells: [{ ...cell }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      notebookTabs: [
        ...state.notebookTabs.map((tab) =>
          tab.id === sourceTabId
            ? { ...tab, cells: tab.cells.filter((c) => c.id !== cellId), updatedAt: Date.now() }
            : tab
        ),
        newTab,
      ],
      notebookActiveTabId: newTabId,
      scrollToCellId: cellId,
      // ✨ Added: Update folderActiveTabs so new tab is visible
      folderActiveTabs: {
        ...state.folderActiveTabs,
        [folderId]: newTabId
      }
    }));

    // Queue auto-sync for source tab (cell was removed)
    get().queueTabSync(sourceTabId);

    // ✨ Added: Queue auto-save for new tab
    get().queueTabSync(newTabId);

    return newTabId;
  },

  updateCell: (tabId, cellId, updates) => {
    set((state) => ({
      notebookTabs: state.notebookTabs.map((tab) =>
        tab.id === tabId
          ? {
            ...tab,
            cells: tab.cells.map((cell) =>
              cell.id === cellId ? { ...cell, ...updates, updatedAt: Date.now() } : cell
            ),
            updatedAt: Date.now(),
          }
          : tab
      ),
    }));
    // Queue auto-sync
    get().queueTabSync(tabId);

    // ✨ Auto-update Tab Title from First Cell
    // If it's the first cell (index 0) and tab title is generic
    const state = get();
    const currentTab = state.notebookTabs.find((t) => t.id === tabId);
    if (currentTab && currentTab.cells.length > 0 && currentTab.cells[0].id === cellId) {
      const firstCell = currentTab.cells[0]; // The updated cell
      const genericTitles = ["Untitled", "New Tab", "New Notebook"];
      const isGeneric = genericTitles.some(t => currentTab.title.startsWith(t));

      if (isGeneric && firstCell.title && firstCell.title.trim() !== "") {
        // Auto-rename tab
        set((state) => ({
          notebookTabs: state.notebookTabs.map((tab) =>
            tab.id === tabId ? { ...tab, title: firstCell.title } : tab
          )
        }));
      }
    }
  },

  toggleBookmark: (tabId, cellId) => {
    set((state) => ({
      notebookTabs: state.notebookTabs.map((tab) =>
        tab.id === tabId
          ? {
            ...tab,
            cells: tab.cells.map((cell) =>
              cell.id === cellId ? { ...cell, isBookmarked: !cell.isBookmarked } : cell
            ),
            updatedAt: Date.now(),
          }
          : tab
      ),
    }));
    // Queue auto-sync
    get().queueTabSync(tabId);
  },

  getBookmarkedCells: () => {
    const state = get();
    const bookmarks: BookmarkRef[] = [];

    state.notebookTabs.forEach((tab) => {
      tab.cells.forEach((cell) => {
        if (cell.isBookmarked) {
          bookmarks.push({
            cellId: cell.id,
            tabId: tab.id,
            cellTitle: cell.title,
            cellType: cell.type,
            tags: cell.fromDeep ? ["deep"] : undefined,
          });
        }
      });
    });

    return bookmarks;
  },

  navigateToCell: (tabId, cellId) => {
    set({
      notebookActiveTabId: tabId,
      scrollToCellId: cellId,
    });
  },

  clearScrollTarget: () => set({ scrollToCellId: null }),

  // === DEPRECATED: Legacy Learning Tabs (backward compatibility) ===
  learningTabs: [],
  activeTabId: null,

  addLearningTab: (unit) => {
    // Bridge to new system - append as cell to active notebook tab
    get().appendCellToActiveTab(unit as LearningUnitInput);
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  closeTab: (id) => {
    set((state) => {
      const newTabs = state.learningTabs.filter((tab) => tab.id !== id);
      let newActiveTabId = state.activeTabId;

      if (state.activeTabId === id) {
        if (newTabs.length > 0) {
          const closedIndex = state.learningTabs.findIndex((tab) => tab.id === id);
          if (closedIndex > 0) {
            newActiveTabId = state.learningTabs[closedIndex - 1].id;
          } else {
            newActiveTabId = newTabs[0]?.id || null;
          }
        } else {
          newActiveTabId = null;
        }
      }

      return {
        learningTabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  // Knowledge Folders state
  knowledgeFolders: [],
  activeFolderId: null,

  createFolder: (name, color = "#3B82F6") => {
    const id = `folder-${Date.now()}`;
    const newFolder: KnowledgeFolder = {
      id,
      name,
      color,
      files: [],
      chatHistory: [],
    };
    set((state) => ({
      knowledgeFolders: [...state.knowledgeFolders, newFolder],
      activeFolderId: id,
    }));
    return id;
  },

  setActiveFolder: (id) => {
    const state = get();
    // ✨ [Updated] Restore active tab for this folder
    const targetFolderId = id || "folder-1";
    let nextTabId = state.folderActiveTabs[targetFolderId];

    // Use fallback if recorded tab no longer exists
    if (!nextTabId) {
      const folderTabs = state.notebookTabs.filter(t => (t.folderId || "folder-1") === targetFolderId);
      if (folderTabs.length > 0) {
        nextTabId = folderTabs[0].id;
      } else {
        nextTabId = null;
      }
    } else {
      // Verify it still exists in current tabs
      if (!state.notebookTabs.find(t => t.id === nextTabId)) {
        const folderTabs = state.notebookTabs.filter(t => (t.folderId || "folder-1") === targetFolderId);
        nextTabId = folderTabs.length > 0 ? folderTabs[0].id : null;
      }
    }

    set({
      activeFolderId: id,
      notebookActiveTabId: nextTabId
    });
  },

  updateFolder: (id, updates) => {
    set((state) => ({
      knowledgeFolders: state.knowledgeFolders.map((folder) =>
        folder.id === id
          ? { ...folder, ...updates }
          : folder
      ),
    }));
  },

  deleteFolder: (id) => {
    set((state) => {
      const newFolders = state.knowledgeFolders.filter((folder) => folder.id !== id);
      let newActiveFolderId = state.activeFolderId;

      if (state.activeFolderId === id) {
        if (newFolders.length > 0) {
          const deletedIndex = state.knowledgeFolders.findIndex((folder) => folder.id === id);
          if (deletedIndex > 0) {
            newActiveFolderId = state.knowledgeFolders[deletedIndex - 1].id;
          } else {
            newActiveFolderId = newFolders[0]?.id || null;
          }
        } else {
          newActiveFolderId = null;
        }
      }

      return {
        knowledgeFolders: newFolders,
        activeFolderId: newActiveFolderId,
      };
    });
  },

  renameFolder: (id, newName) => {
    set((state) => ({
      knowledgeFolders: state.knowledgeFolders.map((folder) =>
        folder.id === id
          ? { ...folder, name: newName }
          : folder
      ),
    }));
  },

  addFileToFolder: (folderId, file) => {
    set((state) => ({
      knowledgeFolders: state.knowledgeFolders.map((folder) =>
        folder.id === folderId
          ? { ...folder, files: [...folder.files, file] }
          : folder
      ),
    }));
  },

  removeFileFromFolder: (folderId, fileName) => {
    set((state) => ({
      knowledgeFolders: state.knowledgeFolders.map((folder) =>
        folder.id === folderId
          ? { ...folder, files: folder.files.filter((f) => f.name !== fileName) }
          : folder
      ),
    }));
  },

  addMessageToFolder: (folderId, message) => {
    set((state) => ({
      knowledgeFolders: state.knowledgeFolders.map((folder) =>
        folder.id === folderId
          ? { ...folder, chatHistory: [...folder.chatHistory, message] }
          : folder
      ),
    }));
  },

  // Legacy Chat Sessions
  chatSessions: [],
  activeChatSessionId: null,

  createSession: () => {
    const id = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: "New Chat",
      messages: [],
      lastUpdated: Date.now(),
    };
    set((state) => ({
      chatSessions: [...state.chatSessions, newSession],
      activeChatSessionId: id,
    }));
    return id;
  },

  addChatSession: (title = "New Chat", folderId) => {
    const id = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title,
      folderId,
      messages: [],
      lastUpdated: Date.now(),
    };
    set((state) => ({
      chatSessions: [...state.chatSessions, newSession],
      activeChatSessionId: id,
    }));
    return id;
  },

  setActiveChatSession: (id) => set({ activeChatSessionId: id }),

  updateChatSession: (id, updates) => {
    set((state) => ({
      chatSessions: state.chatSessions.map((session) =>
        session.id === id
          ? { ...session, ...updates, lastUpdated: Date.now() }
          : session
      ),
    }));
  },

  addMessageToSession: (sessionId, message) => {
    set((state) => ({
      chatSessions: state.chatSessions.map((session) =>
        session.id === sessionId
          ? {
            ...session,
            messages: [...session.messages, message],
            lastUpdated: Date.now(),
          }
          : session
      ),
    }));
  },

  deleteSession: (id) => {
    set((state) => {
      const newSessions = state.chatSessions.filter((session) => session.id !== id);
      let newActiveSessionId = state.activeChatSessionId;

      if (state.activeChatSessionId === id) {
        if (newSessions.length > 0) {
          const deletedIndex = state.chatSessions.findIndex((session) => session.id === id);
          if (deletedIndex > 0) {
            newActiveSessionId = state.chatSessions[deletedIndex - 1].id;
          } else {
            newActiveSessionId = newSessions[0]?.id || null;
          }
        } else {
          newActiveSessionId = null;
        }
      }

      return {
        chatSessions: newSessions,
        activeChatSessionId: newActiveSessionId,
      };
    });
  },

  deleteChatSession: (id) => {
    set((state) => {
      const newSessions = state.chatSessions.filter((session) => session.id !== id);
      let newActiveSessionId = state.activeChatSessionId;

      if (state.activeChatSessionId === id) {
        if (newSessions.length > 0) {
          const deletedIndex = state.chatSessions.findIndex((session) => session.id === id);
          if (deletedIndex > 0) {
            newActiveSessionId = state.chatSessions[deletedIndex - 1].id;
          } else {
            newActiveSessionId = newSessions[0]?.id || null;
          }
        } else {
          newActiveSessionId = null;
        }
      }

      return {
        chatSessions: newSessions,
        activeChatSessionId: newActiveSessionId,
      };
    });
  },

  renameSession: (id, newTitle) => {
    set((state) => ({
      chatSessions: state.chatSessions.map((session) =>
        session.id === id
          ? { ...session, title: newTitle, lastUpdated: Date.now() }
          : session
      ),
    }));
  },

  // History timeline state
  timelineEvents: [],

  addTimelineEvent: (event) => {
    const id = `timeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newEvent: TimelineEvent = {
      id,
      title: event.title,
      category: event.category,
      startTime: event.startTime || now,
      duration: event.duration || 5,
    };
    set((state) => ({
      timelineEvents: [...state.timelineEvents, newEvent].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    }));
  },

  removeTimelineEvent: (id) => {
    set((state) => ({
      timelineEvents: state.timelineEvents.filter((event) => event.id !== id),
    }));
  },

  // Learning streaks state
  userStreak: {
    currentStreak: 1,
    lastStudyDate: new Date().toISOString().split('T')[0],
    history: [],
  },

  updateStreak: (date) => {
    const today = date || new Date().toISOString().split('T')[0];

    set((state) => {
      const { userStreak } = state;
      const { lastStudyDate, history, currentStreak } = userStreak;

      if (lastStudyDate === today || history.includes(today)) {
        return state;
      }

      let newStreak = 1;
      if (lastStudyDate) {
        const lastDate = new Date(lastStudyDate);
        const currentDate = new Date(today);
        const diffDays = Math.floor(
          (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          newStreak = currentStreak + 1;
        } else if (diffDays > 1) {
          newStreak = 1;
        } else {
          newStreak = currentStreak;
        }
      }

      return {
        userStreak: {
          currentStreak: newStreak,
          lastStudyDate: today,
          history: [...history, today].filter((d, i, arr) => arr.indexOf(d) === i),
        },
      };
    });
  },

  resetStreak: () => {
    set({
      userStreak: {
        currentStreak: 0,
        lastStudyDate: null,
        history: [],
      },
    });
  },

  // 출처 패널 초기화 및 액션
  activeSources: [],
  setActiveSources: (sources) => set({ activeSources: sources }),

  // 파일 선택 상태 (NotebookLM 스타일)
  selectedDocumentIds: [],
  toggleDocumentSelection: (id) => set((state) => {
    const isSelected = state.selectedDocumentIds.includes(id);
    return {
      selectedDocumentIds: isSelected
        ? state.selectedDocumentIds.filter((docId) => docId !== id)
        : [...state.selectedDocumentIds, id]
    };
  }),
  setSelectedDocuments: (ids) => set({ selectedDocumentIds: ids }),

  // 마인드맵 팝업 상태
  isMindMapOpen: false,
  setMindMapOpen: (isOpen) => set({ isMindMapOpen: isOpen }),

  leftPanelMinimized: false,
  rightPanelMinimized: false,
  bottomPanelMinimized: false,
  setLeftPanelMinimized: (minimized) => set({ leftPanelMinimized: minimized }),
  setRightPanelMinimized: (minimized) => set({ rightPanelMinimized: minimized }),
  setBottomPanelMinimized: (minimized) => set({ bottomPanelMinimized: minimized }),

  // ✨ Deep Mode Implementation
  sidebarMode: "chat",
  deepHistory: [],
  scrollToDeepCardId: null,
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  setScrollToDeepCardId: (id) => set({ scrollToDeepCardId: id }),
  clearScrollToDeepCardTarget: () => set({ scrollToDeepCardId: null }),

  addDeepCard: (unit) => {
    const cellId = `deep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCard: Cell = {
      id: cellId,
      type: unit.type,
      title: unit.title,
      content: unit.content,
      equations: unit.equations,
      diagram_description: unit.diagram_description,
      mermaid_code: unit.mermaid_code,
      quiz_data: unit.quiz_data,
      isBookmarked: false,
      createdAt: Date.now(),
    };

    set((state) => ({
      deepHistory: [newCard, ...state.deepHistory]
    }));
    return cellId;
  },

  updateDeepCard: (id, updates) => {
    set((state) => ({
      deepHistory: state.deepHistory.map((cell) =>
        cell.id === id ? { ...cell, ...updates } : cell
      ),
    }));
  },

  clearDeepHistory: () => set({ deepHistory: [], scrollToDeepCardId: null }),
  setDeepHistory: (history) => set({ deepHistory: Array.isArray(history) ? history : [] }),
  hydrateNotebookBackup: (data) => {
    set((state) => {
      const next: Partial<AppState> = {};
      const tabs = data.tabs != null && Array.isArray(data.tabs) && data.tabs.length > 0 ? data.tabs : null;
      if (tabs) next.notebookTabs = tabs;
      if (data.activeTabId !== undefined) next.notebookActiveTabId = data.activeTabId;
      if (data.deepHistory != null && Array.isArray(data.deepHistory)) next.deepHistory = data.deepHistory;
      if (tabs && data.activeTabId) {
        const activeTab = tabs.find((t) => t.id === data.activeTabId);
        if (activeTab) {
          const fid = activeTab.folderId || "folder-1";
          next.folderActiveTabs = { ...state.folderActiveTabs, [fid]: activeTab.id };
        }
      }
      return next;
    });
  },

  saveUserNotebookStateToSupabase: async () => {
    const { supabase } = await import("@/lib/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const state = get();
    const payload = {
      tabs: state.notebookTabs,
      activeTabId: state.notebookActiveTabId,
      deepHistory: state.deepHistory,
    };
    try {
      await supabase
        .from("user_notebook_state")
        .upsert(
          { user_id: session.user.id, payload, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    } catch (e) {
      console.warn("[Store] saveUserNotebookStateToSupabase failed:", e);
    }
  },

  loadUserNotebookStateFromSupabase: async () => {
    const { supabase } = await import("@/lib/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from("user_notebook_state")
        .select("payload")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error || !data?.payload || typeof data.payload !== "object") return;
      const p = data.payload as { tabs?: unknown; activeTabId?: string | null; deepHistory?: unknown };
      const payload: { tabs?: NotebookTab[]; activeTabId?: string | null; deepHistory?: Cell[] } = {};
      if (Array.isArray(p.tabs) && p.tabs.length > 0) payload.tabs = p.tabs as NotebookTab[];
      if (p.activeTabId !== undefined) payload.activeTabId = p.activeTabId ?? null;
      if (Array.isArray(p.deepHistory)) payload.deepHistory = p.deepHistory as Cell[];
      if (payload.tabs || payload.deepHistory || payload.activeTabId !== undefined) {
        get().hydrateNotebookBackup(payload);
      }
    } catch (e) {
      console.warn("[Store] loadUserNotebookStateFromSupabase failed:", e);
    }
  },

  // ✨ [추가] 파일 목록 동기화 액션
  fetchFiles: async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const { supabase } = await import("@/lib/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();

      // If not logged in, don't try to fetch
      if (!session?.access_token) {
        console.log("No session, skipping fetch");
        return;
      }

      // 백엔드에서 폴더 및 파일 목록을 가져옵니다.
      const response = await fetch(`${apiUrl}/api/workspace/default/folders`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();

      // Handle folders from DB
      if (data.folders && Array.isArray(data.folders)) {
        set((state) => {
          // Convert DB folders to KnowledgeFolder format
          const dbFolders = data.folders.map((f: any) => ({
            id: f.id,
            name: f.name,
            color: f.color || "#3B82F6",
            files: [],
            chatHistory: []
          }));

          // If no folders from DB, don't create a default one
          let allFolders = dbFolders;

          // Map files to folders
          if (data.files && Array.isArray(data.files)) {
            allFolders = allFolders.map((folder: any) => {
              const folderFiles = data.files
                .filter((f: any) =>
                  f.folder_id === folder.id ||
                  (folder.id === "folder-1" && (!f.folder_id || f.folder_id === "root"))
                )
                .map((f: any) => ({
                  id: f.id,
                  name: f.name,
                  uploadedAt: new Date(f.created_at).getTime(),
                  url: f.storage_path,
                  isStarred: f.is_starred || false, // ✨ Map starred status
                  isOpen: f.is_open || false // ✨ Map open status
                }));

              return {
                ...folder,
                files: folderFiles
              };
            });
          }

          return {
            knowledgeFolders: allFolders,
            activeFolderId: state.activeFolderId || allFolders[0]?.id
          };
        });
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  },

  // ✨ [Added] Restore open tabs on app load
  restoreOpenTabs: async () => {
    const state = get();
    const openFiles = state.knowledgeFolders.flatMap(folder =>
      folder.files.filter(file => file.isOpen)
    );

    if (openFiles.length === 0) return;

    // Check if tabs are already loaded (avoid duplicates)
    const existingFileIds = state.notebookTabs
      .map(tab => tab.syncInfo?.fileId)
      .filter(Boolean);

    const { supabase } = await import("@/lib/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    for (const file of openFiles) {
      if (existingFileIds.includes(file.id)) continue; // Skip already open tabs

      try {
        // Find folder for this file
        const folder = state.knowledgeFolders.find(f =>
          f.files.some(fl => fl.id === file.id)
        );
        const folderId = folder?.id || "folder-1";

        // ✨ Fetch actual file content from API
        const response = await fetch(`${apiUrl}/api/workspace/file/${file.id}/content`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });

        if (!response.ok) {
          console.warn(`Failed to fetch content for file ${file.name}`);
          continue;
        }

        const iumData = await response.json();

        // Load the file as a tab with actual content
        get().loadTabFromIum(iumData, folderId, file.id, file.name);
        console.log(`✓ Restored tab: ${file.name}`);
      } catch (error) {
        console.warn(`Failed to restore tab for file ${file.name}:`, error);
      }
    }
  },

  // ✨ [Added] File management actions
  renameFile: async (fileId: string, newName: string) => {
    try {
      const { supabase } = await import("@/lib/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const state = get();

      // ✨ [Added] Duplicate Name Handling
      let finalName = newName.trim();
      if (!finalName.endsWith('.ium')) finalName += '.ium';

      const existingFile = state.knowledgeFolders
        .flatMap(f => f.files)
        .find(f => f.name === finalName && f.id !== fileId);

      if (existingFile) {
        const baseName = finalName.replace('.ium', '');
        let counter = 1;
        while (state.knowledgeFolders.flatMap(f => f.files).some(f => f.name === `${baseName}_${counter}.ium` && f.id !== fileId)) {
          counter++;
        }
        finalName = `${baseName}_${counter}.ium`;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/workspace/default/files/${fileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: finalName })
      });

      if (!response.ok) throw new Error("Failed to rename file");

      // Update local state
      await get().fetchFiles();

      // ✨ Update open tabs if any
      const currentState = get();
      currentState.notebookTabs.forEach(tab => {
        if (tab.syncInfo?.fileId === fileId) {
          // Update tab title and syncInfo
          const newTitle = newName.replace('.ium', '');
          get().renameNotebookTab(tab.id, newTitle);

          // Determine folderId (fallback to active or default)
          const folderId = tab.folderId || currentState.activeFolderId || "folder-1";

          // Update syncInfo specifically
          get().setSyncInfo(tab.id, {
            ...tab.syncInfo!,
            fileName: newName,
            folderId: folderId // Ensure folderId is preserved/set
          });
        }
      });

    } catch (error) {
      console.error("Error renaming file:", error);
      throw error;
    }
  },

  toggleFileStar: async (fileId: string, isStarred: boolean) => {
    // ✨ Update local state immediately (fail gracefully if DB column missing)
    set((state) => ({
      knowledgeFolders: state.knowledgeFolders.map(folder => ({
        ...folder,
        files: folder.files.map(file =>
          file.id === fileId ? { ...file, isStarred } : file
        )
      }))
    }));

    try {
      const { supabase } = await import("@/lib/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/api/workspace/default/files/${fileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ is_starred: isStarred })
      });
      // Don't throw on error - DB column may not exist yet
    } catch (error) {
      console.warn("toggleFileStar API call failed (column may not exist):", error);
    }
  },

  toggleFileOpen: async (fileId: string, isOpen: boolean) => {
    // ✨ Update local state immediately (fail gracefully if DB column missing)
    set((state) => ({
      knowledgeFolders: state.knowledgeFolders.map(folder => ({
        ...folder,
        files: folder.files.map(file =>
          file.id === fileId ? { ...file, isOpen } : file
        )
      }))
    }));

    try {
      const { supabase } = await import("@/lib/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/api/workspace/default/files/${fileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ is_open: isOpen })
      });
      // Don't throw on error - DB column may not exist yet
    } catch (error) {
      console.warn("toggleFileOpen API call failed (column may not exist):", error);
    }
  },

  // .ium file actions
  exportTabAsIum: (tabId) => {
    const state = get();
    const tab = state.notebookTabs.find((t) => t.id === tabId);

    if (!tab) {
      console.error("Tab not found:", tabId);
      return null;
    }

    const iumFile: IumFile = {
      version: "1.0",
      metadata: {
        title: tab.title,
        createdAt: tab.createdAt,
        updatedAt: tab.updatedAt,
        author: undefined, // Can be set from user context
      },
      cells: tab.cells.map((cell) => ({
        id: cell.id,
        type: cell.type,
        title: cell.title,
        content: cell.content,
        equations: cell.equations,
        diagram_description: cell.diagram_description,
        mermaid_code: cell.mermaid_code,
        quiz_data: cell.quiz_data,
        isBookmarked: cell.isBookmarked,
        createdAt: cell.createdAt,
        updatedAt: cell.updatedAt,
      })),
    };

    return iumFile;
  },

  saveTabToSupabase: async (tabId, folderId, isTemp = true) => {
    const state = get();
    const tab = state.notebookTabs.find((t) => t.id === tabId);
    const iumFile = state.exportTabAsIum(tabId);

    if (!iumFile || !tab) {
      return { success: false, error: "Tab not found" };
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      // ✨ [Improved] Duplicate Name Handling for NEW files
      let finalFileName = `${iumFile.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}.ium`;

      // Only check for duplicates if this is a NEW save (no fileId)
      if (!tab.syncInfo?.fileId) {
        const folder = state.knowledgeFolders.find(f => f.id === folderId);
        if (folder) {
          const baseName = finalFileName.replace('.ium', '');
          let counter = 1;

          const checkNameExists = (name: string) => folder.files.some(f => f.name === name);

          if (checkNameExists(finalFileName)) {
            while (checkNameExists(`${baseName}_${counter}.ium`)) {
              counter++;
            }
            finalFileName = `${baseName}_${counter}.ium`;
          }
        }
      }

      const fileContent = JSON.stringify(iumFile, null, 2);
      const blob = new Blob([fileContent], { type: "application/json" });

      // Use singleton supabase client
      const { supabase } = await import("@/lib/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", blob, finalFileName);
      formData.append("collection_name", "user_knowledge");
      formData.append("folder_id", folderId);
      // ✨ [Refined] Handle updates and is_temp
      if (tab.syncInfo?.fileId) {
        formData.append("file_id", tab.syncInfo.fileId);
        formData.append("update_existing", "true");
      }
      formData.append("is_temp", isTemp.toString());

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${apiUrl}/api/ingest/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || "Upload failed" };
      }

      const data = await response.json();
      const fileId = data.document_ids?.[0] || `ium-${Date.now()}`;

      // Add to folder files (check if not already exists)
      const folder = state.knowledgeFolders.find((f) => f.id === folderId);
      if (folder && !folder.files.some((f) => f.id === fileId)) {
        const uploadedFile: UploadedFile = {
          id: fileId,
          name: finalFileName,
          uploadedAt: Date.now(),
        };
        get().addFileToFolder(folderId, uploadedFile);
      }

      // Update tab with sync info
      const syncInfo: TabSyncInfo = {
        fileId,
        folderId,
        fileName: finalFileName,
        lastSyncedAt: Date.now(),
      };
      get().setSyncInfo(tabId, syncInfo);

      return { success: true, fileId };
    } catch (error) {
      console.error("Failed to save .ium file:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  loadTabFromIum: (iumData, folderId, fileId, fileName) => {
    const state = get();

    // Check if this file is already open (by fileId in syncInfo)
    if (fileId) {
      const existingTab = state.notebookTabs.find(
        (tab) => tab.syncInfo?.fileId === fileId
      );
      if (existingTab) {
        // Already open - just focus on it
        set({ notebookActiveTabId: existingTab.id });
        return existingTab.id;
      }
    }

    const tabId = `notebook-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    // ✨ Use fileName for title if present (remove .ium), otherwise use metadata title
    const title = fileName ? fileName.replace('.ium', '') : (iumData.metadata.title || "Untitled");

    // Explicitly construct string to avoid template literal issues if any
    const safeTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, "_");
    const finalFileName = fileName || (safeTitle + ".ium");

    const newTab: NotebookTab = {
      id: tabId,
      title: title,
      // ✨ [Fixed] Assign folderId so it shows up in the correct folder's tab bar
      folderId: folderId || state.activeFolderId || "folder-1",
      cells: iumData.cells.map((cell) => ({
        id: cell.id || `cell-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        type: cell.type,
        title: cell.title,
        content: cell.content,
        equations: cell.equations,
        diagram_description: cell.diagram_description,
        mermaid_code: cell.mermaid_code,
        graph_data: cell.graph_data, // ✨ [Fix] Correctly map graph_data
        quiz_data: cell.quiz_data,
        isBookmarked: cell.isBookmarked || false,
        createdAt: cell.createdAt || Date.now(),
        updatedAt: cell.updatedAt,
      })),
      createdAt: iumData.metadata.createdAt || Date.now(),
      updatedAt: Date.now(),
      // Set syncInfo if fileId is provided (so auto-sync works)
      syncInfo: fileId ? {
        fileId,
        folderId: folderId || state.activeFolderId || "folder-1",
        fileName: finalFileName,
        lastSyncedAt: Date.now(),
      } : undefined,
    };

    set((state) => ({
      notebookTabs: [...state.notebookTabs, newTab],
      notebookActiveTabId: tabId,
      // ✨ [Added] Update local history for that folder so it's active immediately
      folderActiveTabs: {
        ...state.folderActiveTabs,
        [newTab.folderId || "folder-1"]: tabId
      }
    }));

    // ✨ Mark file as open in DB if it has a fileId
    if (fileId) {
      get().toggleFileOpen(fileId, true);
    }

    return tabId;
  },

  // Auto-sync state
  _pendingSyncs: new Set<string>(),
  _syncDebounceTimers: new Map<string, NodeJS.Timeout>(),

  setSyncInfo: (tabId, syncInfo) => {
    set((state) => ({
      notebookTabs: state.notebookTabs.map((tab) =>
        tab.id === tabId ? { ...tab, syncInfo } : tab
      ),
    }));
  },

  // Sync a single tab to Supabase (update existing file)
  syncTabToSupabase: async (tabId) => {
    const state = get();
    const tab = state.notebookTabs.find((t) => t.id === tabId);

    if (!tab || !tab.syncInfo) {
      // Not synced yet, skip auto-sync
      return;
    }

    const { syncInfo } = tab;
    const iumFile = state.exportTabAsIum(tabId);

    if (!iumFile) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const newFileName = `${iumFile.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}.ium`;
      const fileContent = JSON.stringify(iumFile, null, 2);
      const blob = new Blob([fileContent], { type: "application/json" });

      // Get auth token
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", blob, newFileName);
      formData.append("collection_name", "user_knowledge");
      formData.append("folder_id", syncInfo.folderId);
      // Signal to backend to update existing file
      // Signal to backend to update existing file
      formData.append("file_id", syncInfo.fileId);
      formData.append("update_existing", "true");
      // ✨ Mark as temporary save
      formData.append("is_temp", "true");

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${apiUrl}/api/ingest/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (response.ok) {
        // Update sync info with new timestamp and filename
        const updatedSyncInfo: TabSyncInfo = {
          ...syncInfo,
          fileName: newFileName,
          lastSyncedAt: Date.now(),
        };
        get().setSyncInfo(tabId, updatedSyncInfo);

        // Update file name in folder if changed
        if (syncInfo.fileName !== newFileName) {
          set((state) => ({
            knowledgeFolders: state.knowledgeFolders.map((folder) =>
              folder.id === syncInfo.folderId
                ? {
                  ...folder,
                  files: folder.files.map((f) =>
                    f.id === syncInfo.fileId ? { ...f, name: newFileName, is_temp: true } : f
                  ),
                }
                : folder
            ),
          }));
        }

        // ✨ Also update is_temp in local state immediately
        set((state) => ({
          knowledgeFolders: state.knowledgeFolders.map((folder) =>
            folder.id === syncInfo.folderId
              ? {
                ...folder,
                files: folder.files.map((f) =>
                  f.id === syncInfo.fileId ? { ...f, is_temp: true } : f
                ),
              }
              : folder
          ),
        }));

        console.log(`Auto-synced tab "${tab.title}" to Supabase`);
      }
    } catch (error) {
      console.error("Auto-sync failed:", error);
    }
  },

  // Queue a tab for sync with debounce (500ms default, can be immediate)
  queueTabSync: (tabId, immediate = false) => {
    const state = get();
    const tab = state.notebookTabs.find((t) => t.id === tabId);

    // ✨ Handle unsaved tabs (no syncInfo) -> Create new file
    if (!tab?.syncInfo) {
      // Debounce creation too
      const existingTimer = state._syncDebounceTimers.get(tabId);
      if (existingTimer) clearTimeout(existingTimer);

      const createAndSync = () => {
        const folderId = tab?.folderId || state.activeFolderId || "folder-1";
        // ✨ Auto-save is always temp
        get().saveTabToSupabase(tabId, folderId, true);
      };

      if (immediate) {
        createAndSync();
      } else {
        const timer = setTimeout(() => {
          createAndSync();
          state._syncDebounceTimers.delete(tabId);
        }, 1000); // Slightly longer delay for creation
        state._syncDebounceTimers.set(tabId, timer);
      }
      return;
    }

    // Existing sync logic (Debounce)
    const existingTimer = state._syncDebounceTimers.get(tabId);
    if (existingTimer) clearTimeout(existingTimer);

    const performSync = () => {
      // ✨ Use saveTabToSupabase for updates too (it handles update_existing now)
      // Auto-sync preserves current temp status (or re-marks as temp if logic dictates, but usually valid save)
      // Actually, auto-sync ON EXISTING file is better handled by syncTabToSupabase if we want separate logic,
      // BUT to satisfy "save button makes permanent", auto-sync should probably keep it temp?
      // Let's use saveTabToSupabase(..., true) for auto-syncs to keep them temp.
      const folderId = tab.syncInfo?.folderId || tab.folderId || state.activeFolderId || "folder-1";
      get().saveTabToSupabase(tabId, folderId, true);
    };

    if (immediate) {
      performSync();
    } else {
      const timer = setTimeout(() => {
        performSync();
        state._syncDebounceTimers.delete(tabId);
      }, 500);
      state._syncDebounceTimers.set(tabId, timer);
    }
  },
}));