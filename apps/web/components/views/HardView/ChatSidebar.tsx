"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Sparkles,

  Search,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Copy,
  Check,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types/api";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

export function ChatSidebar() {
  const {
    appendCellToActiveTab,
    addTimelineEvent,
    knowledgeFolders,
    activeFolderId,
    addMessageToFolder,
    setActiveSources,
    selectedDocumentIds,
    leftPanelMinimized,
    rightPanelMinimized,
    bottomPanelMinimized,
    setLeftPanelMinimized,
    setRightPanelMinimized,
    setBottomPanelMinimized,
  } = useAppStore();

  const { toast } = useToast();
  const supabase = createClient();
  const activeFolder = knowledgeFolders.find((f) => f.id === activeFolderId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // ✨ [수정] 단순 boolean 대신 현재 진행 상태 메시지를 저장 (null이면 로딩 아님)
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [lastSavedMessageId, setLastSavedMessageId] = useState<string | null>(null);

  // ✨ [추가] 파일 업로드 및 복사 상태
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userMessageCountRef = useRef(0);

  // Fetch user and listen for auth changes
  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error fetching user:", error);
        setUser(null);
      }
    };

    getUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load messages from active folder's chat history
  useEffect(() => {
    if (activeFolder) {
      setMessages(
        activeFolder.chatHistory.length > 0
          ? activeFolder.chatHistory
          : []
      );
    } else {
      setMessages([]);
    }
  }, [activeFolder]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loadingStatus]);

  const generateStudySummary = useCallback(async () => {
    if (isGeneratingSummary || messages.length < 2) return;

    const lastAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant");
    if (lastAssistantMessage && lastSavedMessageId === lastAssistantMessage.id) {
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const summary = await api.chat.generateSummary(messages);
      const estimatedDuration = Math.max(5, messages.length);

      addTimelineEvent({
        title: summary.title,
        category: summary.category as 'concept' | 'code' | 'review' | 'quiz',
        startTime: messages[0].timestamp,
        duration: estimatedDuration,
      });

      if (lastAssistantMessage) {
        setLastSavedMessageId(lastAssistantMessage.id);
      }
      setIsSaved(true);

      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to generate study summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [messages, isGeneratingSummary, addTimelineEvent, lastSavedMessageId]);

  useEffect(() => {
    const userMessages = messages.filter((msg) => msg.role === "user");
    if (userMessages.length >= 3 && userMessages.length > userMessageCountRef.current) {
      userMessageCountRef.current = userMessages.length;
      const timer = setTimeout(() => {
        generateStudySummary();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages, generateStudySummary]);

  // 피드백 핸들러
  const handleFeedback = (messageId: string, type: "like" | "dislike") => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, feedback: msg.feedback === type ? null : type }
          : msg
      )
    );

    toast({
      description: type === "like" ? "Thanks for the positive feedback!" : "Thanks for the feedback. We'll improve.",
    });
  };

  // ✨ [추가] 복사 핸들러
  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast({
        description: "Message copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  // ✨ [추가] 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      // 최대 3개까지만 허용
      if (selectedFiles.length + newFiles.length > 3) {
        toast({
          title: "Too many files",
          description: "You can upload up to 3 files at once.",
          variant: "destructive"
        });
        return;
      }
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input value to allow selecting same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ✨ [추가] 파일 제거 핸들러
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || loadingStatus || isUploading) return;

    if (!activeFolderId) {
      toast({
        title: "No folder selected",
        description: "Chatting without a folder will search all documents. Create or select a folder for focused learning.",
        variant: "default",
      });
    }

    // ✨ [수정] 파일 업로드 처리
    let attachments: { type: string; url?: string; file_id?: string; storage_path?: string; name?: string }[] = [];

    if (selectedFiles.length > 0) {
      setIsUploading(true);
      setLoadingStatus("Uploading files...");

      try {
        const uploadPromises = selectedFiles.map(file =>
          api.ingest.uploadFile(
            file,
            "user_knowledge",
            activeFolderId || undefined
          )
        );

        const uploadResults = await Promise.all(uploadPromises);

        attachments = uploadResults.map((result, index) => ({
          type: selectedFiles[index].type.startsWith("image/") ? "image" : "file",
          storage_path: result.storage_path,
          file_id: result.document_ids[0],
          name: selectedFiles[index].name
        }));

      } catch (error) {
        console.error("File upload failed:", error);
        toast({
          title: "Upload failed",
          description: "Failed to upload attached files.",
          variant: "destructive"
        });
        setIsUploading(false);
        setLoadingStatus(null);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
      // ✨ [추가] 첨부파일 메타데이터 (UI 표시용 - 실제 API 응답과 다를 수 있음)
      sources: attachments.map(att => ({
        title: att.name || "Attached File",
        id: att.file_id || "",
        content: "",
        relevance_score: 1
      }))
    };

    setMessages((prev) => [...prev, userMessage]);

    if (activeFolderId) {
      addMessageToFolder(activeFolderId, userMessage);
    }

    setInput("");
    setSelectedFiles([]); // ✨ 파일 초기화

    setLoadingStatus("Starting agent...");
    userMessageCountRef.current += 1;

    try {
      const response = await api.chat.sendMessage(
        userMessage.content,
        {
          conversationId: conversationId || undefined,
          collectionName: "user_knowledge",
          folderId: activeFolderId || undefined,
          attachments: attachments, // ✨ [추가] 첨부파일 전달
        },
        (statusMessage) => {
          setLoadingStatus(statusMessage);
        }
      );

      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      if (response.sources && response.sources.length > 0) {
        setActiveSources(response.sources as any);
      } else {
        setActiveSources([]);
      }

      if (response.learning_unit) {
        appendCellToActiveTab(response.learning_unit);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        // Use chat_message for short status (Cursor-like), fall back to message
        content: response.chat_message || response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
        reasoning_chain: response.reasoning_chain,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (activeFolderId) {
        addMessageToFolder(activeFolderId, assistantMessage);
      }

      setIsSaved(false);
      setLastSavedMessageId(null);
    } catch (error) {
      toast({
        title: "Chat error",
        description: error instanceof Error
          ? error.message
          : "Failed to send message. Please try again.",
        variant: "destructive",
      });

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error
          ? `Sorry, I encountered an error: ${error.message}. Please make sure the backend is running and documents are ingested.`
          : "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      if (activeFolderId) {
        addMessageToFolder(activeFolderId, errorMessage);
      }
    } finally {
      setLoadingStatus(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header: Chat 탭 오른쪽 상단에 패널 최소화/복원 버튼 */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">Chat</h3>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setLeftPanelMinimized(!leftPanelMinimized)}
            title={leftPanelMinimized ? "좌측 패널 펼치기" : "좌측 패널 최소화"}
          >
            {leftPanelMinimized ? (
              <PanelLeftOpen className="h-4 w-4 text-muted-foreground hover:text-primary" />
            ) : (
              <PanelLeftClose className="h-4 w-4 text-muted-foreground hover:text-primary" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setRightPanelMinimized(!rightPanelMinimized)}
            title={rightPanelMinimized ? "채팅 패널 펼치기" : "채팅 패널 최소화"}
          >
            {rightPanelMinimized ? (
              <PanelRightOpen className="h-4 w-4 text-muted-foreground hover:text-primary" />
            ) : (
              <PanelRightClose className="h-4 w-4 text-muted-foreground hover:text-primary" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setBottomPanelMinimized(!bottomPanelMinimized)}
            title={bottomPanelMinimized ? "하단 패널 펼치기" : "하단 패널 최소화"}
          >
            {bottomPanelMinimized ? (
              <PanelBottomOpen className="h-4 w-4 text-muted-foreground hover:text-primary" />
            ) : (
              <PanelBottomClose className="h-4 w-4 text-muted-foreground hover:text-primary" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages or Empty State */}
      <ScrollArea className="flex-1">
        {!activeFolderId ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center px-4">
            <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              Select a folder from the sidebar to start.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center px-4">
            <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              Start chatting about <span className="font-medium text-foreground">{activeFolder?.name}</span>!
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.role === "assistant" ? "flex-row" : "flex-row-reverse"
                )}
              >
                <Avatar className="h-7 w-7 border border-border shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                    {message.role === "assistant" ? "i" : "U"}
                  </AvatarFallback>
                </Avatar>

                <div className={cn("flex flex-col gap-1 max-w-[85%]", message.role === "user" && "items-end")}>
                  <div
                    className={cn(
                      "rounded border px-3 py-2 text-xs shadow-sm",
                      message.role === "assistant"
                        ? "bg-muted text-foreground border-border"
                        : "bg-primary text-primary-foreground border-primary"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1 opacity-70">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-medium">iUM Agent</span>
                      </div>
                    )}

                    <div
                      className={cn(
                        "leading-relaxed prose prose-sm max-w-none",
                        message.role === "user"
                          ? "prose-invert text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code: (props: any) => {
                              const { inline, className, children, ...rest } = props;
                              return !inline ? (
                                <code
                                  className={cn(
                                    "block rounded bg-muted/50 border p-2 text-xs overflow-x-auto my-1",
                                    className
                                  )}
                                  {...rest}
                                >
                                  {children}
                                </code>
                              ) : (
                                <code
                                  className={cn(
                                    "rounded bg-muted/50 px-1 py-0.5 text-xs border",
                                    className
                                  )}
                                  {...rest}
                                >
                                  {children}
                                </code>
                              );
                            },
                            p: ({ children }: { children?: React.ReactNode }) => (
                              <p className="mb-1 last:mb-0">{children}</p>
                            ),
                            ul: ({ children }: { children?: React.ReactNode }) => (
                              <ul className="list-disc list-inside mb-1 space-y-0.5 pl-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }: { children?: React.ReactNode }) => (
                              <ol className="list-decimal list-inside mb-1 space-y-0.5 pl-1">
                                {children}
                              </ol>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                          <Search className="h-3 w-3" />
                          Sources used:
                        </p>
                        <div className="space-y-0.5 pl-1">
                          {message.sources.map((source, idx) => (
                            <p
                              key={idx}
                              className="text-[10px] text-muted-foreground truncate opacity-80"
                              title={source.title}
                            >
                              • {source.title}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>



                  {/* ✨ [수정] 복사 및 피드백 버튼 (Assistant 메시지인 경우에만 표시) */}
                  {message.role === "assistant" && (
                    <div className="flex flex-col gap-1 self-start mt-1">
                      <div className="flex items-center gap-1 px-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-muted transition-colors"
                          onClick={() => handleCopy(message.id, message.content)}
                          title="Copy message"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-6 w-6 rounded-full hover:bg-muted transition-colors",
                            message.feedback === "like" && "text-primary bg-primary/10"
                          )}
                          onClick={() => handleFeedback(message.id, "like")}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-6 w-6 rounded-full hover:bg-muted transition-colors",
                            message.feedback === "dislike" && "text-destructive bg-destructive/10"
                          )}
                          onClick={() => handleFeedback(message.id, "dislike")}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ✨ [수정] 스마트 로딩 인디케이터 (진짜 상태 표시) */}
            {loadingStatus && (
              <div className="flex gap-2">
                <Avatar className="h-7 w-7 border border-border shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                    i
                  </AvatarFallback>
                </Avatar>
                <div className="rounded border bg-muted/50 px-3 py-2 text-xs w-full max-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="font-medium text-[10px] text-primary">Processing...</span>
                  </div>

                  {/* 실시간 상태 메시지 표시 */}
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <span>{loadingStatus}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )
        }
      </ScrollArea >

      <Separator />

      {/* Input Area */}
      <div className="p-2 border-t space-y-1.5">
        {messages.filter((m) => m.role === "user").length >= 1 && !isSaved && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={generateStudySummary}
              disabled={isGeneratingSummary || isSaved}
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : isSaved ? (
                "Saved!"
              ) : (
                "Save Progress"
              )}
            </Button>
          </div>
        )}


        {/* ✨ [추가] 파일 미리보기 */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pb-1">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-[10px] border border-border"
              >
                <span className="truncate max-w-[100px]">{file.name}</span>
                <span className="text-muted-foreground/70">({(file.size / 1024).toFixed(0)}KB)</span>
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="hover:bg-background rounded-full p-0.5"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!!loadingStatus} // 로딩 중 입력 비활성화
            className="flex-1 rounded border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring border-border disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* ✨ [추가] 파일 입력 (Hidden) */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            // 이미지 등 허용 형식 제한 가능
            accept="image/*,.pdf,.txt,.md,.py,.js,.ts"
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!loadingStatus || isUploading}
            title="Attach files"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSend}
            disabled={!!loadingStatus || !input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div >
  );
}