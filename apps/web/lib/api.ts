/**
 * API Client for FastAPI Backend
 * Handles all HTTP requests to the backend API
 * Updated for SSE Streaming Support
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
  Comment,
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
   * Send a message to the AI agent with Streaming Support (SSE)
   * ✨ [수정됨] 스트리밍 데이터 처리 및 상태 콜백 추가
   */
  async sendMessage(
    message: string,
    options?: {
      workspaceId?: string;
      context?: string[];
      conversationId?: string;
      collectionName?: string;
      folderId?: string;
      attachments?: { type: string; url?: string; file_id?: string; storage_path?: string }[];
    },
    // ✨ [추가] 실시간 상태 업데이트를 위한 콜백 함수
    onStatusUpdate?: (status: string) => void
  ): Promise<ChatResponse> {
    const url = `${API_BASE_URL}/api/agent/message`; // Endpoint updated to match backend router


    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          workspace_id: options?.workspaceId,
          conversation_id: options?.conversationId,
          collection_name: options?.collectionName,
          folder_id: options?.folderId,
          attachments: options?.attachments,
        }),
      });

      if (!response.ok) {
        throw new Error(`API Request failed: ${response.statusText}`);
      }

      // ✨ 스트림 리더 생성
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResult: ChatResponse | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // SSE 데이터 파싱 (data: {...})
          const lines = chunk.split("\n\n");


          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.replace("data: ", "");
                const data = JSON.parse(jsonStr);

                if (data.status === "progress") {
                  // ✨ 실시간 상태 업데이트: "Searching...", "Analyzing..."
                  if (onStatusUpdate) onStatusUpdate(data.message);
                } else if (data.status === "complete") {
                  // ✨ 최종 결과 수신
                  finalResult = data.data;
                } else if (data.status === "error") {
                  throw new Error(data.message);
                }
              } catch (e) {
                // JSON 파싱 에러는 무시 (청크가 잘린 경우 등)
                // console.warn("Error parsing stream chunk:", e);
              }
            }
          }
        }
      }

      if (!finalResult) {
        throw new Error("No valid response received from the server.");
      }

      return finalResult;

    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown error occurred during streaming request");
    }
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
    folderId?: string,
    token?: string // ✨ 인증 토큰 파라미터 추가
  ): Promise<IngestResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("collection_name", collectionName);
    if (folderId) {
      formData.append("folder_id", folderId);
    }

    const url = `${API_BASE_URL}/api/ingest/upload`; // Endpoint path adjusted based on standard router

    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`; // ✨ 헤더 추가
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: headers, // ✨ 헤더 전달 (FormData는 Content-Type 자동 설정됨)
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
  async getWorkspace(workspaceId: string = "default"): Promise<Workspace> {
    return fetchApi<Workspace>(`/api/workspace/${workspaceId}`);
  },

  async getFolders(workspaceId: string = "default"): Promise<Workspace["folders"]> {
    return fetchApi<Workspace["folders"]>(
      `/api/workspace/${workspaceId}/folders`
    );
  },

  async updateFile(workspaceId: string = "default", fileId: string, name: string, token: string): Promise<any> {
    return fetchApi(`/api/workspace/${workspaceId}/files/${fileId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });
  },

  async deleteFile(workspaceId: string = "default", fileId: string, token: string): Promise<any> {
    return fetchApi(`/api/workspace/${workspaceId}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
  },

  async deleteFolder(workspaceId: string = "default", folderId: string, token: string): Promise<any> {
    return fetchApi(`/api/workspace/${workspaceId}/folders/${folderId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
  },
};

/**
 * Health check
 */
export async function checkHealth(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/api/health");
}

/**
 * Reels API Functions
 */
export const reelsApi = {
  /**
   * Import a reel from Google Drive shared URL
   */
  async importFromDrive(options: {
    driveUrl: string;
    userId: string;
    title: string;
    description?: string;
    folderName?: string;
    tags?: string[];
  }): Promise<any> {
    return fetchApi("/api/reels/import-from-drive", {
      method: "POST",
      body: JSON.stringify({
        drive_url: options.driveUrl,
        user_id: options.userId,
        title: options.title,
        description: options.description,
        folder_name: options.folderName,
        tags: options.tags,
      }),
    });
  },
};

/**
 * Comments API Functions
 */
export const commentsApi = {
  /**
   * Get all comments for a reel
   */
  async getComments(reelId: string): Promise<Comment[]> {
    return fetchApi<Comment[]>(`/api/comments/${reelId}`);
  },

  /**
   * Create a new comment
   */
  async createComment(
    reelId: string,
    content: string,
    token: string
  ): Promise<Comment> {
    return fetchApi<Comment>("/api/comments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reel_id: reelId,
        content,
      }),
    });
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, token: string): Promise<{ success: boolean; message: string }> {
    return fetchApi<{ success: boolean; message: string }>(`/api/comments/${commentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};

/**
 * Reel Interactions API
 */
export const reelInteractionsApi = {
  /**
   * Toggle like on a reel
   */
  toggleLike: async (reelId: string, token: string) => {
    return fetchApi<{ success: boolean; likes: number; is_liked: boolean }>("/api/reel-interactions/like", {
      method: "POST",
      body: JSON.stringify({ reel_id: reelId }),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  /**
   * Increment comment count
   */
  incrementCommentCount: async (reelId: string, token: string) => {
    return fetchApi<{ success: boolean; comments: number }>(
      `/api/reel-interactions/increment-comment-count/${reelId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  },

  /**
   * Decrement comment count
   */
  decrementCommentCount: async (reelId: string, token: string) => {
    return fetchApi<{ success: boolean; comments: number }>(
      `/api/reel-interactions/decrement-comment-count/${reelId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  },

  /**
   * Get user's liked reels
   */
  getUserLikes: async (token: string) => {
    return fetchApi<{ success: boolean; liked_reels: string[] }>("/api/reel-interactions/user-likes", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};

// Export all APIs as a single object for convenience
export const api = {
  chat: chatApi,
  ingest: ingestApi,
  feed: feedApi,
  workspace: workspaceApi,
  reels: reelsApi,
  comments: commentsApi,
  reelInteractions: reelInteractionsApi,
  health: checkHealth,
};