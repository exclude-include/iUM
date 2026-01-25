/**
 * Shared TypeScript types for iUM Frontend
 * These types mirror the Pydantic models in the backend
 */

export type LearningUnitType = "reel" | "document" | "quiz" | "discussion";

export interface LearningUnit {
  id: string;
  title: string;
  description: string;
  type: LearningUnitType;
  author: string;
  tags: string[];
  content_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  quiz_content?: {
    title: string;
    explanation: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface FeedResponse {
  items: LearningUnit[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface Document {
  id: string;
  title: string;
  content_type: "text" | "pdf" | "markdown";
  content?: string;
  file_url?: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
  equations?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Tab {
  id: string;
  name: string;
  document?: Document;
}

export interface Folder {
  id: string;
  name: string;
  icon?: string;
  tabs: Tab[];
}

export interface HistoryItem {
  id: string;
  title: string;
  timestamp: string;
  type: "timeline" | "study" | "quiz" | "document";
  metadata?: Record<string, string>;
}

export interface Workspace {
  id: string;
  name: string;
  folders: Folder[];
  history: HistoryItem[];
  created_at?: string;
  updated_at?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: "streak" | "quiz" | "study" | "community";
  target: number;
  current: number;
  completed: boolean;
  reward?: string;
}

export interface UserProgress {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  total_learning_days: number;
  last_activity?: string;
  missions: Mission[];
  total_points: number;
  level: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sources?: Array<{
    id: string;
    title: string;
    relevance_score?: number;
  }>;
}

export interface ChatRequest {
  message: string;
  workspace_id?: string;
  context?: string[];
  conversation_id?: string;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  sources?: Array<{
    id: string;
    title: string;
    relevance_score?: number;
  }>;
  reasoning_chain?: string[];
  confidence_score?: number;
}

