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
      /** 선택/첨부한 파일 ID 목록 — 백엔드가 이 파일들만 RAG에 사용 */
      documentIds?: string[];
      attachments?: { type?: string; url?: string; file_id?: string; storage_path?: string; name?: string }[];
    },
    onStatusUpdate?: (status: string) => void
  ): Promise<ChatResponse> {
    const url = `${API_BASE_URL}/api/agent/message`;

    const documentIds = (options?.documentIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
    const attachments = (options?.attachments ?? []).map((a) => ({
      type: typeof a.type === "string" ? a.type : "file",
      ...(a.file_id != null && { file_id: String(a.file_id) }),
      ...(a.storage_path != null && { storage_path: String(a.storage_path) }),
      ...(a.name != null && { name: String(a.name) }),
    }));

    const body: Record<string, unknown> = {
      message: String(message ?? "").trim(),
      use_react: true,
      collection_name: options?.collectionName ?? "user_knowledge",
    };
    if (options?.workspaceId != null) body.workspace_id = options.workspaceId;
    if (options?.conversationId != null && options.conversationId !== "") body.conversation_id = options.conversationId;
    if (options?.folderId != null && options.folderId !== "") body.folder_id = options.folderId;
    if (documentIds.length > 0) body.document_ids = documentIds;
    if (attachments.length > 0) body.attachments = attachments;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const detail = errBody?.detail;
        const msg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((e: { msg?: string }) => e?.msg).filter(Boolean).join("; ") || response.statusText
              : response.statusText;
        throw new Error(`API Request failed: ${msg}`);
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

  /**
   * ✨ [추가] 딥 다이브 설명 생성 요청
   */
  async generateDeepExplanation(
    text: string,
    context: string,
    activeFolderId?: string
  ): Promise<ChatResponse> {
    const prompt = `
[DEEP EXPLANATION REQUEST]
Target Text: "${text}"
Context: "${context}"

Please provide a deep, detailed explanation of the "Target Text" considering the provided "Context". 
Explain it as if you are teaching a student who wants to master this specific concept.
IMPORTANT: Respond in the same language as the "Target Text" and "Context". If the text is Korean, the explanation MUST be in Korean.

Include:
1. Definition and Core Concept
2. Detailed Explanation (Why? How?)
3. Examples or Analogies
4. Related Concepts
5. Flowchart Data for Reactflow. Provide strictly valid JSON:
   "graph_data": {
     "nodes": [{ "id": "1", "label": "Start", "type": "input" }, ...],
     "edges": [{ "id": "e1-2", "source": "1", "target": "2", "label": "next" }, ...]
   }
   - Use short, clear labels.
   - Node IDs must be strings.
   - Edges connect source ID to target ID.

 Output format should be the standard Learning Unit JSON.
`;

    return this.sendMessage(prompt, {
      folderId: activeFolderId,
      collectionName: "user_knowledge"
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
    folderId?: string;
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
        folder_id: options.folderId,
        tags: options.tags,
      }),
    });
  },

  /**
   * Create a reel with optional quiz and optional video URL
   * Used for video-less reels with pastel backgrounds
   */
  async createWithQuiz(options: {
    user_id: string;
    title: string;
    description?: string;
    video_url?: string;
    folder_name?: string;
    folderId?: string;
    tags?: string[];
    quiz?: any;
  }): Promise<any> {
    return fetchApi("/api/reels/create-with-quiz", {
      method: "POST",
      body: JSON.stringify({
        user_id: options.user_id,
        title: options.title,
        description: options.description,
        video_url: options.video_url,
        folder_name: options.folder_name,
        folder_id: options.folderId,
        tags: options.tags,
        quiz: options.quiz,
      }),
    });
  },

  /**
   * Create a reel from a notebook cell: auto-generate hashtags and quiz from cell content.
   * No video; reel appears in Soft mode feed.
   */
  async createFromCell(options: {
    user_id: string;
    cell_content: string;
    cell_title?: string;
    quiz_data?: Array<{
      id?: string;
      question_text?: string;
      question?: string;
      options?: Array<{ id?: string; key?: string; text: string; is_correct?: boolean }>;
      explanation?: string;
    }>;
  }): Promise<{ success: boolean; message?: string; reel?: any }> {
    return fetchApi("/api/reels/generate-from-cell", {
      method: "POST",
      body: JSON.stringify({
        user_id: options.user_id,
        cell_content: options.cell_content,
        cell_title: options.cell_title,
        quiz_data: options.quiz_data,
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

/**
 * Users API - public metadata and account actions
 */
export const usersApi = {
  getUserMetadata: async (userId: string): Promise<{ name?: string; avatar_url?: string }> => {
    return fetchApi<{ name?: string; avatar_url?: string }>(`/api/users/${userId}/metadata`);
  },

  deleteAccount: async (accessToken: string): Promise<{ success: boolean; message: string }> => {
    return fetchApi<{ success: boolean; message: string }>("/api/users/delete-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
  users: usersApi,
  health: checkHealth,
};

/**
 * Feed Pagination API Functions
 */
export async function fetchFeed(params: {
  page: number;
  pageSize?: number;
  lastReelId?: string;
  userId?: string;
  activeFolderIds?: string[];  // NEW: Active folder IDs for filtering
  similarityThreshold?: number; // NEW: Similarity threshold (default 0.7)
}): Promise<{ reels: any[]; hasMore: boolean }> {
  const queryParams = new URLSearchParams();
  queryParams.append("page", params.page.toString());
  if (params.pageSize) queryParams.append("page_size", params.pageSize.toString());
  if (params.lastReelId) queryParams.append("last_reel_id", params.lastReelId);
  if (params.userId) queryParams.append("user_id", params.userId);
  if (params.activeFolderIds && params.activeFolderIds.length > 0) {
    queryParams.append("active_folder_ids", params.activeFolderIds.join(","));
  }
  if (params.similarityThreshold !== undefined) {
    queryParams.append("similarity_threshold", params.similarityThreshold.toString());
  }

  return fetchApi<{ reels: any[]; hasMore: boolean }>(
    `/api/reels/feed?${queryParams.toString()}`
  );
}

export async function fetchReelContext(reelId: string): Promise<{
  reel: any;
  nextReels: any[];
}> {
  return fetchApi<{ reel: any; nextReels: any[] }>(
    `/api/reels/reel/${reelId}`
  );
}