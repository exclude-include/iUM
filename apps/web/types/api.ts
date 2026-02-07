/**
 * API Types - Matching Backend Pydantic Models
 * These types correspond to the FastAPI backend models
 */

// Chat Types
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
  // ✨ [추가] 사고 과정 (로딩 중 또는 완료 후 표시용)
  reasoning_chain?: string[];
  // ✨ [추가] 사용자 피드백 상태
  feedback?: "like" | "dislike" | null;
}

export interface ChatRequest {
  message: string;
  workspace_id?: string;
  context?: string[];
  conversation_id?: string;
  collection_name?: string;
  folder_id?: string; // Folder ID to filter RAG context
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

// Reel Quiz Types (for interactive video quizzes in Soft Mode)
export interface ReelQuizOption {
  key: string; // 'A', 'B', 'C', 'D', etc.
  text: string;
}

export interface ReelQuiz {
  question: string;
  options: ReelQuizOption[];
  answer: string; // Correct answer key ('A', 'B', 'C', etc.)
  explanation?: string;
  timestamp_seconds?: number; // When quiz appears in video (seconds)
}

export interface LearningUnitResponse {
  title: string;
  type: "concept" | "math" | "code" | "summary" | "quiz";
  content: string; // Markdown text. For diagrams, use mermaid code blocks like ```mermaid ... ```
  equations?: string[]; // LaTeX strings
  diagram_description?: string; // Deprecated - use mermaid in content instead
  quiz_data?: QuizQuestion[]; // Structured quiz questions (required when type is 'quiz')
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
  learning_unit?: LearningUnitResponse;
}

// Document Ingestion Types
export interface IngestResponse {
  message: string;
  filename: string;
  chunks_created: number;
  document_ids: string[];
  collection: string;
}

export interface IngestStatusResponse {
  collection_name: string;
  document_count: number;
  status: "active" | "error";
  error?: string;
}

// Learning Unit Types (for content area)
export interface LearningUnit {
  id: string;
  title: string;
  description: string;
  type: "reel" | "document" | "quiz" | "discussion";
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

// Workspace Types
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

// Comment Types
export interface Comment {
  id: string;
  reel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar?: string;
}

// API Error Types
export interface ApiError {
  detail: string;
  status_code?: number;
}