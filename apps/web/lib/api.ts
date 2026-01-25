/**
 * API Client for FastAPI Backend
 * Handles all HTTP requests to the backend API
 */

import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  IngestResponse,
  IngestStatusResponse,
  FeedResponse,
  Workspace,
  ApiError,
} from "@/types/api";

// Get API base URL from environment variable
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
        status_code: response.status,
      }));
      throw new Error(error.detail || `API request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred during API request");
  }
}

/**
 * Chat API Functions
 */
export const chatApi = {
  /**
   * Send a message to the AI agent
   */
  async sendMessage(
    message: string,
    options?: {
      workspaceId?: string;
      context?: string[];
      conversationId?: string;
      collectionName?: string;
      folderId?: string;
    }
  ): Promise<ChatResponse> {
    const request: ChatRequest = {
      message,
      workspace_id: options?.workspaceId,
      context: options?.context,
      conversation_id: options?.conversationId,
      collection_name: options?.collectionName,
      folder_id: options?.folderId,
    };

    return fetchApi<ChatResponse>("/api/agent/chat", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Get conversation history
   */
  async getHistory(conversationId: string): Promise<ChatMessage[]> {
    return fetchApi<ChatMessage[]>(
      `/api/agent/chat/${conversationId}/history`
    );
  },

  /**
   * Generate study summary from conversation messages
   */
  async generateSummary(messages: ChatMessage[]): Promise<{ title: string; category: string }> {
    // Convert ChatMessage objects to plain dicts for API
    const messageDicts = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      sources: msg.sources,
    }));

    return fetchApi<{ title: string; category: string }>("/api/agent/chat/summary", {
      method: "POST",
      body: JSON.stringify({ messages: messageDicts }),
    });
  },
};

/**
 * Document Ingestion API Functions
 */
export const ingestApi = {
  /**
   * Upload and ingest a document (PDF or Text)
   */
  async uploadFile(
    file: File,
    collectionName: string = "user_knowledge",
    folderId?: string
  ): Promise<IngestResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("collection_name", collectionName);
    if (folderId) {
      formData.append("folder_id", folderId);
    }

    const url = `${API_BASE_URL}/api/ingest`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary
      });

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
          status_code: response.status,
        }));
        throw new Error(error.detail || `Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown error occurred during file upload");
    }
  },

  /**
   * Get ingestion status for a collection
   */
  async getStatus(
    collectionName: string = "user_knowledge"
  ): Promise<IngestStatusResponse> {
    return fetchApi<IngestStatusResponse>(
      `/api/ingest/status?collection_name=${encodeURIComponent(collectionName)}`
    );
  },
};

/**
 * Feed API Functions
 */
export const feedApi = {
  /**
   * Get learning feed for Soft View
   */
  async getFeed(options?: {
    limit?: number;
    offset?: number;
    category?: string;
  }): Promise<FeedResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.category) params.append("category", options.category);

    const queryString = params.toString();
    return fetchApi<FeedResponse>(
      `/api/feed${queryString ? `?${queryString}` : ""}`
    );
  },
};

/**
 * Workspace API Functions
 */
export const workspaceApi = {
  /**
   * Get workspace data for Hard View
   */
  async getWorkspace(workspaceId: string = "default"): Promise<Workspace> {
    return fetchApi<Workspace>(`/api/workspace/${workspaceId}`);
  },

  /**
   * Get folders in a workspace
   */
  async getFolders(workspaceId: string = "default"): Promise<Workspace["folders"]> {
    return fetchApi<Workspace["folders"]>(
      `/api/workspace/${workspaceId}/folders`
    );
  },
};

/**
 * Health check
 */
export async function checkHealth(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/api/health");
}

// Export all APIs as a single object for convenience
export const api = {
  chat: chatApi,
  ingest: ingestApi,
  feed: feedApi,
  workspace: workspaceApi,
  health: checkHealth,
};

