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
  content: string; // Markdown text. For diagrams, use mermaid code blocks like ```mermaid ... ```
  equations?: string[]; // LaTeX strings
  diagram_description?: string; // Deprecated - use mermaid in content instead
  quiz_data?: QuizQuestion[]; // Structured quiz questions (required when type is 'quiz')
}

export interface LearningTab extends LearningUnit {
  id: string;
  timestamp: number;
}

// Knowledge Folder System
export interface UploadedFile {
  name: string;
  url?: string; // or path
  uploadedAt: number;
}

export interface KnowledgeFolder {
  id: string;
  name: string;
  color: string; // e.g., "#3B82F6" (Blue), "#EF4444" (Red)
  files: UploadedFile[];
  chatHistory: ChatMessage[]; // Each folder has its own chat context
}

// Legacy ChatSession interface (deprecated - use KnowledgeFolder)
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
  title: string; // e.g., "RAG Study"
  category: 'concept' | 'code' | 'review' | 'quiz';
  startTime: string; // ISO String
  duration: number; // in minutes (visual width)
}

// Learning Streaks
export interface UserStreak {
  currentStreak: number;
  lastStudyDate: string | null; // YYYY-MM-DD
  history: string[]; // List of dates studied (YYYY-MM-DD format)
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
  createFolder: (name: string, color?: string) => string; // Creates new folder, returns folder ID
  setActiveFolder: (id: string | null) => void;
  updateFolder: (id: string, updates: Partial<KnowledgeFolder>) => void;
  deleteFolder: (id: string) => void;
  renameFolder: (id: string, newName: string) => void;
  addFileToFolder: (folderId: string, file: UploadedFile) => void;
  removeFileFromFolder: (folderId: string, fileName: string) => void;
  addMessageToFolder: (folderId: string, message: ChatMessage) => void;
  
  // Legacy Chat Sessions (deprecated - kept for backward compatibility)
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
  updateStreak: (date?: string) => void; // Updates streak based on current date or provided date
  resetStreak: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // View mode state - default to 'hard'
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
      activeTabId: id, // Auto-focus the new tab
    }));
  },
  
  setActiveTab: (id) => set({ activeTabId: id }),
  
  closeTab: (id) => {
    set((state) => {
      const newTabs = state.learningTabs.filter((tab) => tab.id !== id);
      let newActiveTabId = state.activeTabId;
      
      // If the closed tab was active, switch to the nearest tab
      if (state.activeTabId === id) {
        if (newTabs.length > 0) {
          // Find the index of the closed tab
          const closedIndex = state.learningTabs.findIndex((tab) => tab.id === id);
          // Switch to the tab before it, or the first tab if it was the first
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
  
  // Knowledge Folders state - default to empty
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
      activeFolderId: id, // Immediately set as active folder
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
      
      // If the deleted folder was active, switch to the nearest folder
      if (state.activeFolderId === id) {
        if (newFolders.length > 0) {
          // Find the index of the deleted folder
          const deletedIndex = state.knowledgeFolders.findIndex((folder) => folder.id === id);
          // Switch to the folder before it, or the first folder if it was the first
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
  
  // Legacy Chat Sessions (deprecated - kept for backward compatibility)
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
      activeChatSessionId: id, // Immediately set as active session
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
      activeChatSessionId: id, // Immediately set as active session
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
      
      // If the deleted session was active, switch to the nearest session
      if (state.activeChatSessionId === id) {
        if (newSessions.length > 0) {
          // Find the index of the deleted session
          const deletedIndex = state.chatSessions.findIndex((session) => session.id === id);
          // Switch to the session before it, or the first session if it was the first
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
    // Alias for deleteSession - use the same logic
    set((state) => {
      const newSessions = state.chatSessions.filter((session) => session.id !== id);
      let newActiveSessionId = state.activeChatSessionId;
      
      // If the deleted session was active, switch to the nearest session
      if (state.activeChatSessionId === id) {
        if (newSessions.length > 0) {
          // Find the index of the deleted session
          const deletedIndex = state.chatSessions.findIndex((session) => session.id === id);
          // Switch to the session before it, or the first session if it was the first
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
  
  // History timeline state - default to empty
  timelineEvents: [],
  
  addTimelineEvent: (event) => {
    const id = `timeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newEvent: TimelineEvent = {
      id,
      title: event.title,
      category: event.category,
      startTime: event.startTime || now, // Use provided startTime or current time
      duration: event.duration || 5, // Default to 5 minutes if not provided
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
  
  // Learning streaks state - start with Day 1
  userStreak: {
    currentStreak: 1,
    lastStudyDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
    history: [],
  },
  
  updateStreak: (date) => {
    const today = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    set((state) => {
      const { userStreak } = state;
      const { lastStudyDate, history, currentStreak } = userStreak;
      
      // If already studied today, don't update
      if (lastStudyDate === today || history.includes(today)) {
        return state;
      }
      
      // Calculate new streak
      let newStreak = 1;
      if (lastStudyDate) {
        const lastDate = new Date(lastStudyDate);
        const currentDate = new Date(today);
        const diffDays = Math.floor(
          (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (diffDays === 1) {
          // Consecutive day - increment streak
          newStreak = currentStreak + 1;
        } else if (diffDays > 1) {
          // Streak broken - reset to 1
          newStreak = 1;
        } else {
          // Same day - keep current streak
          newStreak = currentStreak;
        }
      }
      
      return {
        userStreak: {
          currentStreak: newStreak,
          lastStudyDate: today,
          history: [...history, today].filter((d, i, arr) => arr.indexOf(d) === i), // Remove duplicates
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
}));

