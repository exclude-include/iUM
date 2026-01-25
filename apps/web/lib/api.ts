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
  HistoryItem,
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

  /**
   * Get history for a workspace
   */
  async getHistory(
    workspaceId: string = "default",
    accountId: string,
    options?: {
      folderId?: string;
      historyType?: string;
      limit?: number;
    }
  ): Promise<HistoryItem[]> {
    const params = new URLSearchParams();
    params.append("account_id", accountId);
    if (options?.folderId) params.append("folder_id", options.folderId);
    if (options?.historyType) params.append("history_type", options.historyType);
    if (options?.limit) params.append("limit", options.limit.toString());

    return fetchApi<HistoryItem[]>(
      `/api/workspace/${workspaceId}/history?${params.toString()}`
    );
  },

  /**
   * Create a history item
   */
  async createHistory(
    workspaceId: string = "default",
    history: {
      account_id: string;
      folder_id?: string;
      title: string;
      history_type: string;
      content?: Record<string, unknown>;
    }
  ): Promise<{ id: string; message: string }> {
    return fetchApi<{ id: string; message: string }>(
      `/api/workspace/${workspaceId}/history`,
      {
        method: "POST",
        body: JSON.stringify(history),
      }
    );
  },
};

/**
 * Health check
 */
export async function checkHealth(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/api/health");
}

/**
 * Account API Functions
 */
export interface Account {
  id?: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const accountApi = {
  /**
   * Create a new account
   */
  async create(account: Omit<Account, "id" | "created_at" | "updated_at">): Promise<Account> {
    return fetchApi<Account>("/api/accounts", {
      method: "POST",
      body: JSON.stringify(account),
    });
  },

  /**
   * Get account by ID
   */
  async getById(accountId: string): Promise<Account> {
    return fetchApi<Account>(`/api/accounts/${accountId}`);
  },

  /**
   * Get account by email
   */
  async getByEmail(email: string): Promise<Account> {
    return fetchApi<Account>(`/api/accounts/email/${encodeURIComponent(email)}`);
  },

  /**
   * Update account
   */
  async update(accountId: string, account: Partial<Account>): Promise<Account> {
    return fetchApi<Account>(`/api/accounts/${accountId}`, {
      method: "PUT",
      body: JSON.stringify(account),
    });
  },

  /**
   * Delete account
   */
  async delete(accountId: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/api/accounts/${accountId}`, {
      method: "DELETE",
    });
  },
};

/**
 * Google Drive API Functions
 */
export const googleDriveApi = {
  /**
   * Save Google OAuth tokens
   */
  async saveAuth(auth: {
    account_id: string;
    access_token: string;
    refresh_token?: string;
    scope?: string;
  }): Promise<{ message: string; account_id: string }> {
    return fetchApi<{ message: string; account_id: string }>("/api/google-drive/auth", {
      method: "POST",
      body: JSON.stringify(auth),
    });
  },

  /**
   * Get Google integration status
   */
  async getAuthStatus(accountId: string): Promise<{
    account_id: string;
    has_access_token: boolean;
    has_refresh_token: boolean;
    scope?: string;
    created_at?: string;
  }> {
    return fetchApi(`/api/google-drive/auth/${accountId}`);
  },

  /**
   * Revoke Google integration
   */
  async revokeAuth(accountId: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/api/google-drive/auth/${accountId}`, {
      method: "DELETE",
    });
  },

  /**
   * Sync files from Google Drive
   */
  async syncFiles(data: {
    account_id: string;
    files: Array<{
      drive_file_id: string;
      name: string;
      mime_type?: string;
      folder_id?: string;
    }>;
  }): Promise<{ synced: number; files: string[] }> {
    return fetchApi<{ synced: number; files: string[] }>("/api/google-drive/files/sync", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Get synced Drive files for an account
   */
  async getFiles(accountId: string, folderId?: string): Promise<Array<{
    id: string;
    drive_file_id: string;
    name: string;
    mime_type?: string;
    synced_at?: string;
  }>> {
    const params = new URLSearchParams();
    params.append("account_id", accountId);
    if (folderId) params.append("folder_id", folderId);
    
    return fetchApi(`/api/google-drive/files?${params.toString()}`);
  },
};

// Export all APIs as a single object for convenience
export const api = {
  chat: chatApi,
  ingest: ingestApi,
  feed: feedApi,
  workspace: workspaceApi,
  account: accountApi,
  googleDrive: googleDriveApi,
  health: checkHealth,
};

