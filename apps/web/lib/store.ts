import { create } from "zustand";
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

export interface LearningUnit {
  title: string;
  type: "concept" | "math" | "code" | "summary" | "quiz";
  content: string; // Markdown text
  equations?: string[]; // LaTeX strings
  diagram_description?: string; 
  mermaid_code?: string; 
  quiz_data?: QuizQuestion[]; 
}

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
  
  // Learning tabs state
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
}

export const useAppStore = create<AppState>((set) => ({
  // View mode state
  viewMode: "hard",
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // Active document state
  activeDocument: null,
  setActiveDocument: (document) => set({ activeDocument: document }),
  
  // Learning tabs state
  learningTabs: [],
  activeTabId: null,
  
  addLearningTab: (unit) => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTab: LearningTab = {
      ...unit, 
      id,
      timestamp: Date.now(),
    };
    set((state) => ({
      learningTabs: [...state.learningTabs, newTab],
      activeTabId: id, 
    }));
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
      // 백엔드에서 파일 목록을 가져옵니다.
      const response = await fetch(`${apiUrl}/api/workspace/default/folders`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      
      if (data.files && Array.isArray(data.files)) {
        set((state) => {
          // 1. 만약 폴더가 하나도 없다면 기본 폴더를 생성해줍니다.
          let currentFolders = state.knowledgeFolders;
          if (currentFolders.length === 0) {
            currentFolders = [{
               id: "folder-1",
               name: "General",
               color: "#3B82F6",
               files: [],
               chatHistory: []
            }];
          }

          // 2. DB에서 가져온 파일들을 각 폴더에 매핑합니다.
          const updatedFolders = currentFolders.map((folder) => {
            // 이 폴더 ID(folder.id)에 속하거나, folder_id가 없으면 첫번째 폴더에 넣습니다.
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

            // 기존 파일과 DB 파일을 병합 (DB가 우선)
            return {
              ...folder,
              files: folderFiles
            };
          });

          return { 
             knowledgeFolders: updatedFolders,
             // 폴더가 생성되었으면 활성 폴더 ID도 설정
             activeFolderId: state.activeFolderId || updatedFolders[0].id
          };
        });
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  },
}));