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
  Settings,
  LogOut,
  User,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types/api";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

import { DeepModeView } from "./DeepModeView";

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
    sidebarMode, // ✨
    setSidebarMode, // ✨
  } = useAppStore();

  const { toast } = useToast();
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
  const [responseType, setResponseType] = useState<"auto" | "concept" | "diagram" | "quiz">("auto");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userMessageCountRef = useRef(0);

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

  // ✨ [Added] Message Queue State
  const queueRef = useRef<{ content: string; files: File[] }[]>([]);
  const isProcessingRef = useRef(false);

  // ✨ [Refactored] Actual execution logic (previously handleSend)
  const executeMessageTask = async (content: string, files: File[]) => {
    // Note: We use arguments instead of state because state might have changed

    // ✨ [수정] 파일 업로드 처리
    let attachments: { type: string; url?: string; file_id?: string; storage_path?: string; name?: string }[] = [];

    if (files.length > 0) {
      setIsUploading(true);
      setLoadingStatus("Embedding file(s)... Please wait.");

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const uploadPromises = files.map((file) =>
          api.ingest.uploadFile(
            file,
            "user_knowledge",
            activeFolderId || undefined,
            token
          )
        );

        const uploadResults = await Promise.all(uploadPromises);

        attachments = uploadResults.map((result, index) => ({
          type: files[index].type.startsWith("image/") ? "image" : "file",
          storage_path: result.storage_path,
          file_id: result.document_ids?.[0] ?? "",
          name: files[index].name,
        }));

        // Ensure we have valid file_ids for RAG
        if (attachments.some((a) => !a.file_id)) {
          throw new Error("File embedding did not return document IDs.");
        }
      } catch (error) {
        console.error("File upload failed:", error);
        toast({
          title: "Upload failed",
          description: "Failed to upload or embed attached files. Please try again.",
          variant: "destructive",
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
      content: content.trim(),
      timestamp: new Date().toISOString(),
      // ✨ [추가] 사용자 의도 저장
      intent: responseType,
      // ✨ [추가] 첨부파일 메타데이터 (UI 표시용)
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

    // Input clearing is handled in handleSend now
    userMessageCountRef.current += 1;
    setLoadingStatus("Starting agent...");

    try {
      // RAG: selected files (Files section) + chat-added attachment file IDs
      const attachmentFileIds = attachments.map((a) => a.file_id).filter(Boolean) as string[];
      const documentIdsForRag = [
        ...attachmentFileIds,
        ...(activeFolderId
          ? selectedDocumentIds.filter(
              (id) => activeFolder?.files?.some((f) => f.id === id)
            )
          : selectedDocumentIds),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      const response = await api.chat.sendMessage(
        userMessage.content,
        {
          conversationId: conversationId || undefined,
          collectionName: "user_knowledge",
          folderId: activeFolderId || undefined,
          documentIds: documentIdsForRag.length > 0 ? documentIdsForRag : undefined,
          attachments: attachments,
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

      // ✨ [핵심 수정] learning_unit이 없어도 항상 탭에 콘텐츠 추가
      if (response.learning_unit) {
        console.log("[ChatSidebar] Learning unit received:", response.learning_unit);
        appendCellToActiveTab(response.learning_unit);
      }

      // ✨ [Removed] Fallback cell creation to prevent "AI Response" cells with generic text


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

  // ✨ [Added] Queue Processor
  const processQueue = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (queueRef.current.length > 0) {
      const task = queueRef.current.shift();
      if (task) {
        await executeMessageTask(task.content, task.files);
      }
    }

    isProcessingRef.current = false;
  };

  // ✨ [Modified] New handleSend pushes to queue
  const handleSend = async (manualContent?: string) => {
    let contentToSend = manualContent || input;
    const filesToSend = [...selectedFiles];

    if ((!contentToSend.trim() && filesToSend.length === 0)) return;

    // ✨ [추가] 답변 유형별 지침 추가
    if (!manualContent) {
      if (responseType === "concept") {
        contentToSend = `[Instruction: Provide a detailed conceptual explanation] ${contentToSend}`;
      } else if (responseType === "diagram") {
        contentToSend = `[Instruction: Focus on providing a clear diagram. Keep text explanations concise] ${contentToSend}`;
      } else if (responseType === "quiz") {
        contentToSend = `[Instruction: Provide a quiz on this topic] ${contentToSend}`;
      }
    }

    if (!activeFolderId) {
      toast({
        title: "No folder selected",
        description: "Chatting without a folder will search all documents. Create or select a folder for focused learning.",
        variant: "default",
      });
      // Allow sending anyway for general chat? The original logic didn't return.
    }

    // Clear Input Immediately
    if (!manualContent) {
      setInput("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    // Push to Queue
    queueRef.current.push({ content: contentToSend, files: filesToSend });

    // Trigger Processor
    processQueue();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ✨ [Fixed] Allow typing even when loading
    // ✨ [Updated] Enter to send, Shift+Enter for new line
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  // ✨ [추가] 메시지 표시용 텍스트 필터링 (Instruction 제거)
  const getDisplayContent = (content: string) => {
    return content.replace(/\[Instruction:.*?\]\s*/g, "").trim();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header: Mode Switcher & Panel Controls */}
      <div className="flex items-center justify-between border-b px-2 py-2 shrink-0">
        <div className="flex items-center bg-muted/50 p-1 rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs px-3 rounded-md transition-all",
              sidebarMode === "chat"
                ? "bg-background shadow-sm text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSidebarMode("chat")}
          >
            Chat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs px-3 rounded-md transition-all",
              sidebarMode === "deep"
                ? "bg-background shadow-sm text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSidebarMode("deep")}
            data-tutorial="tutorial-deep"
          >
            Deep
          </Button>
        </div>

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

      {sidebarMode === "deep" ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <DeepModeView />
        </div>
      ) : (
        <>
          {/* Content Area - min-h-0 so flex child can shrink and scroll to bottom */}
          <ScrollArea className="flex-1 min-h-0">
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
                          "rounded-lg px-3 py-2 text-sm shadow-sm",
                          message.role === "assistant"
                            ? "bg-muted text-foreground border border-border"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                            <ReactMarkdown
                              remarkPlugins={[remarkMath, remarkGfm]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                code: ({ inline, className, children, ...rest }: any) => {
                                  const match = /language-(\w+)/.exec(className || "");
                                  return !inline && match ? (
                                    <div className="relative">
                                      <div className="absolute right-2 top-2">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                          onClick={() => handleCopy(message.id, String(children))}
                                        >
                                          {copiedMessageId === message.id ? (
                                            <Check className="h-3 w-3" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </div>
                                      <pre className={cn("bg-muted/50 p-3 rounded-md overflow-x-auto", className)}>
                                        <code {...rest} className={className}>
                                          {children}
                                        </code>
                                      </pre>
                                    </div>
                                  ) : (
                                    <code {...rest} className={cn("bg-muted/30 px-1 py-0.5 rounded text-xs font-mono", className)}>
                                      {children}
                                    </code>
                                  );
                                }
                              }}
                            >
                              {getDisplayContent(message.content)}
                            </ReactMarkdown>
                            {message.reasoning_chain && (
                              <div className="mt-2 text-xs text-muted-foreground border-t pt-2 border-border/50">
                                <details>
                                  <summary className="cursor-pointer hover:text-foreground transition-colors font-medium">
                                    View Reasoning
                                  </summary>
                                  <div className="mt-1 pl-2 border-l-2 border-primary/20">
                                    {message.reasoning_chain.map((step, i) => (
                                      <div key={i} className="mb-1 last:mb-0">
                                        {step}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {message.intent && message.intent !== "auto" && (
                              <div className="flex justify-end mb-0.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/20 font-medium uppercase tracking-wider">
                                  {message.intent}
                                </span>
                              </div>
                            )}
                            <div className="whitespace-pre-wrap break-words">{getDisplayContent(message.content)}</div>
                          </div>
                        )}

                        {/* 첨부파일 표시 */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {message.sources.map((source, i) => (
                              <div key={i} className="flex items-center gap-1 bg-background/20 px-2 py-1 rounded text-xs">
                                <Paperclip className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">{source.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ✨ [Added] Retry Button */}
                      {message.role === "assistant" && messages.indexOf(message) === messages.length - 1 && !loadingStatus && (
                        <div className="mt-2 flex justify-end border-t border-border/50 pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              // Find last user message
                              const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
                              if (lastUserMsg) {
                                handleSend(lastUserMsg.content);
                              }
                            }}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" /> Retry
                          </Button>
                        </div>
                      )}

                      {/* Feedback & Actions */}
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-1 px-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopy(message.id, message.content)}
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
                            className="h-6 w-6"
                            onClick={() => handleFeedback(message.id, "like")}
                          >
                            <ThumbsUp
                              className={cn(
                                "h-3 w-3",
                                message.feedback === "like"
                                  ? "text-primary fill-primary"
                                  : "text-muted-foreground"
                              )}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleFeedback(message.id, "dislike")}
                          >
                            <ThumbsDown
                              className={cn(
                                "h-3 w-3",
                                message.feedback === "dislike"
                                  ? "text-destructive fill-destructive"
                                  : "text-muted-foreground"
                              )}
                            />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loadingStatus && (
                  <div className="flex gap-2">
                    <Avatar className="h-7 w-7 border border-border shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">i</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted text-foreground border border-border rounded-lg px-3 py-2 text-sm shadow-sm flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">{loadingStatus || "Thinking..."}</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="relative p-3 border-t bg-background shrink-0">
            {/* Embedding overlay: block interaction and show message until embedding is done */}
            {(isUploading || (loadingStatus && loadingStatus.startsWith("Embedding"))) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[2px] rounded-lg">
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">Embedding file(s)...</p>
                  <p className="text-xs text-muted-foreground">Questions are disabled until embedding finishes.</p>
                </div>
              </div>
            )}
            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs border">
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button onClick={() => handleRemoveFile(index)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Response Type Selector */}
            <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "auto", label: "자동" },
                { id: "concept", label: "Concept" },
                { id: "diagram", label: "Diagram" },
                { id: "quiz", label: "Quiz" },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setResponseType(type.id as any)}
                  className={cn(
                    "px-3 py-1 text-[11px] rounded-full border transition-all whitespace-nowrap",
                    responseType === type.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div data-tutorial="tutorial-chat" className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                multiple
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                disabled={!!loadingStatus || isUploading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <div className="relative flex-1">
                <Textarea
                  placeholder={
                    isUploading
                      ? "Embedding file(s)..."
                      : loadingStatus
                        ? "Please wait..."
                        : activeFolderId
                          ? `Message ${activeFolder?.name}...`
                          : "Select a folder to chat..."
                  }
                  className="w-full min-h-[40px] max-h-[200px] px-3 py-2 text-sm rounded-md border border-input bg-transparent shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-y-auto"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={!!loadingStatus || isUploading}
                />
              </div>
              <Button
                onClick={() => handleSend()}
                disabled={
                  (!input.trim() && selectedFiles.length === 0) ||
                  !!loadingStatus ||
                  isUploading
                }
                size="icon"
                className="shrink-0 h-9 w-9"
              >
                {loadingStatus || isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3 text-yellow-500" />
              AI can make mistakes. Check important info.
            </p>
          </div>
        </>
      )}
    </div>
  );
}