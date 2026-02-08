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
  quiz_data?: QuizQuestion[];
  isBookmarked: boolean;
  createdAt: number;
  updatedAt?: number;
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
}

// Bookmark reference for sidebar navigation
export interface BookmarkRef {
  cellId: string;
  tabId: string;
  cellTitle: string;
  cellType: CellType;
}

// Input type from API/Chat responses (matches backend contract)
export interface LearningUnitInput {
  title: string;
  type: CellType;
  content: string; // Markdown text
  equations?: string[]; // LaTeX strings
  diagram_description?: string;
  mermaid_code?: string;
  quiz_data?: QuizQuestion[];
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
  uploadedAt: number;
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
  notebookTabs: NotebookTab[];
  notebookActiveTabId: string | null;
  scrollToCellId: string | null;

  // Notebook Tab Actions
  createNotebookTab: (title?: string) => string;
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

  // ✨ [추가] 서버에서 파일 목록 불러오기 액션
  fetchFiles: () => Promise<void>;

  // .ium file actions - save/load notebook tabs
  exportTabAsIum: (tabId: string) => IumFile | null;
  saveTabToSupabase: (tabId: string, folderId: string) => Promise<{ success: boolean; fileId?: string; error?: string }>;
  loadTabFromIum: (iumData: IumFile, folderId?: string, fileId?: string) => string;

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
  scrollToCellId: null,

  createNotebookTab: (title) => {
    const state = get();
    let finalTitle: string;

    // Auto-generate unique title if not provided or is default
    if (!title || title === "New Tab" || title === "Untitled Tab" || title === "New Notebook" || title === "Untitled Notebook") {
      const existingTitles = state.notebookTabs.map((t) => t.title);
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
    };
    set((state) => ({
      notebookTabs: [...state.notebookTabs, newTab],
      notebookActiveTabId: id,
    }));
    return id;
  },

  deleteNotebookTab: (tabId) => {
    set((state) => {
      const newTabs = state.notebookTabs.filter((tab) => tab.id !== tabId);
      let newActiveTabId = state.notebookActiveTabId;

      if (state.notebookActiveTabId === tabId) {
        if (newTabs.length > 0) {
          const closedIndex = state.notebookTabs.findIndex((tab) => tab.id === tabId);
          if (closedIndex > 0) {
            newActiveTabId = state.notebookTabs[closedIndex - 1].id;
          } else {
            newActiveTabId = newTabs[0]?.id || null;
          }
        } else {
          newActiveTabId = null;
        }
      }

      return {
        notebookTabs: newTabs,
        notebookActiveTabId: newActiveTabId,
      };
    });
  },

  setNotebookActiveTab: (tabId) => set({ notebookActiveTabId: tabId }),

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

    // If no active tab exists, create one first
    if (!tabId || !state.notebookTabs.find((t) => t.id === tabId)) {
      tabId = get().createNotebookTab("Chat Session");
    }

    const cellId = `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCell: Cell = {
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
      notebookTabs: state.notebookTabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, cells: [...tab.cells, newCell], updatedAt: Date.now() }
          : tab
      ),
      scrollToCellId: cellId,
    }));

    // Queue auto-sync
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
        if (index !== undefined && index >= 0 && index <= cells.length) {
          cells.splice(index, 0, newCell);
        } else {
          cells.push(newCell);
        }
        return { ...tab, cells, updatedAt: Date.now() };
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
    const newTab: NotebookTab = {
      id: newTabId,
      title: newTabTitle || cell.title || "Moved Cell",
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
    }));

    // Queue auto-sync for source tab (cell was removed)
    get().queueTabSync(sourceTabId);

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

  setActiveFolder: (id) => set({ activeFolderId: id }),

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

  // ✨ [추가] 파일 목록 동기화 액션
  fetchFiles: async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Get session token from Supabase
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
                  url: f.storage_path
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

  saveTabToSupabase: async (tabId, folderId) => {
    const state = get();
    const tab = state.notebookTabs.find((t) => t.id === tabId);
    const iumFile = state.exportTabAsIum(tabId);

    if (!iumFile || !tab) {
      return { success: false, error: "Tab not found" };
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const fileName = `${iumFile.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}.ium`;
      const fileContent = JSON.stringify(iumFile, null, 2);
      const blob = new Blob([fileContent], { type: "application/json" });

      // Get auth token
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("collection_name", "user_knowledge");
      formData.append("folder_id", folderId);

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
        const uploadedFile = {
          id: fileId,
          name: fileName,
          uploadedAt: Date.now(),
        };
        get().addFileToFolder(folderId, uploadedFile);
      }

      // Update tab with sync info
      const syncInfo: TabSyncInfo = {
        fileId,
        folderId,
        fileName,
        lastSyncedAt: Date.now(),
      };
      get().setSyncInfo(tabId, syncInfo);

      return { success: true, fileId };
    } catch (error) {
      console.error("Failed to save .ium file:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  loadTabFromIum: (iumData, folderId, fileId) => {
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
    const fileName = `${iumData.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}.ium`;

    const newTab: NotebookTab = {
      id: tabId,
      title: iumData.metadata.title,
      cells: iumData.cells.map((cell) => ({
        id: cell.id || `cell-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        type: cell.type,
        title: cell.title,
        content: cell.content,
        equations: cell.equations,
        diagram_description: cell.diagram_description,
        mermaid_code: cell.mermaid_code,
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
        folderId: folderId || "",
        fileName,
        lastSyncedAt: Date.now(),
      } : undefined,
    };

    set((state) => ({
      notebookTabs: [...state.notebookTabs, newTab],
      notebookActiveTabId: tabId,
    }));

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
      formData.append("file_id", syncInfo.fileId);
      formData.append("update_existing", "true");

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
                    f.id === syncInfo.fileId ? { ...f, name: newFileName } : f
                  ),
                }
                : folder
            ),
          }));
        }

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

    // Only queue if tab has sync info (has been saved before)
    if (!tab?.syncInfo) return;

    // Clear existing timer for this tab
    const existingTimer = state._syncDebounceTimers.get(tabId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Immediate sync or debounced
    if (immediate) {
      get().syncTabToSupabase(tabId);
    } else {
      // Set new debounce timer (500ms for quick feedback)
      const timer = setTimeout(() => {
        get().syncTabToSupabase(tabId);
        get()._syncDebounceTimers.delete(tabId);
      }, 500);

      state._syncDebounceTimers.set(tabId, timer);
    }
  },
}));