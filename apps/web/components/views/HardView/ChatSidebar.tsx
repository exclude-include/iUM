"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Send, Loader2, MessageCircle, LogOut, User, Settings, 
  ThumbsUp, ThumbsDown, Sparkles, Search, Brain, PenTool 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// ✨ [추가] 로딩 상태 텍스트 시퀀스
const LOADING_STEPS = [
  { text: "Searching knowledge base...", icon: Search },
  { text: "Analyzing context...", icon: Brain },
  { text: "Formulating response...", icon: PenTool },
];

export function ChatSidebar() {
  const {
    addLearningTab,
    addTimelineEvent,
    knowledgeFolders,
    activeFolderId,
    addMessageToFolder,
    setActiveSources,
  } = useAppStore();

  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const activeFolder = knowledgeFolders.find((f) => f.id === activeFolderId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // ✨ [추가] 현재 로딩 단계 상태
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [lastSavedMessageId, setLastSavedMessageId] = useState<string | null>(null);
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // ✨ [추가] 로딩 중일 때 1.5초마다 단계 변경
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStepIndex(0); // 시작할 때 0으로 초기화
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      router.push("/login");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

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
  }, [messages, isLoading]);

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

  // ✨ [추가] 피드백 핸들러
  const handleFeedback = (messageId: string, type: "like" | "dislike") => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, feedback: msg.feedback === type ? null : type } // 토글 기능
          : msg
      )
    );

    // 실제로는 여기서 API를 호출하여 피드백을 서버에 저장할 수 있습니다.
    toast({
      description: type === "like" ? "Thanks for the positive feedback!" : "Thanks for the feedback. We'll improve.",
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!activeFolderId) {
      toast({
        title: "No folder selected",
        description: "Chatting without a folder will search all documents. Create or select a folder for focused learning.",
        variant: "default",
      });
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    
    if (activeFolderId) {
      addMessageToFolder(activeFolderId, userMessage);
    }
    
    setInput("");
    setIsLoading(true);
    userMessageCountRef.current += 1;

    try {
      const response = await api.chat.sendMessage(input.trim(), {
        conversationId: conversationId || undefined,
        collectionName: "user_knowledge",
        folderId: activeFolderId || undefined,
      });

      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      if (response.sources && response.sources.length > 0) {
        setActiveSources(response.sources as any);
      } else {
        setActiveSources([]);
      }

      if (response.learning_unit) {
        addLearningTab(response.learning_unit);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
        // ✨ [추가] 서버에서 받은 reasoning_chain이 있다면 저장 (없으면 undefined)
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
      setIsLoading(false);
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
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">Chat</h3>
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

                {/* ✨ [추가] 피드백 버튼 (Assistant 메시지인 경우에만 표시) */}
                {message.role === "assistant" && (
                  <div className="flex items-center gap-1 px-1">
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
                )}
              </div>
            </div>
          ))}

          {/* ✨ [추가] 스마트 로딩 인디케이터 */}
          {isLoading && (
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
                
                {/* 텍스트 애니메이션 영역 */}
                <div className="flex items-center gap-2 text-muted-foreground h-5 overflow-hidden">
                   {/* 현재 단계 아이콘과 텍스트 */}
                   {(() => {
                     const StepIcon = LOADING_STEPS[loadingStepIndex].icon;
                     return (
                       <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300" key={loadingStepIndex}>
                         <StepIcon className="h-3 w-3" />
                         <span>{LOADING_STEPS[loadingStepIndex].text}</span>
                       </div>
                     );
                   })()}
                </div>
              </div>
            </div>
          )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

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
        {isSaved && (
          <div className="flex justify-end">
            <span className="text-[10px] text-muted-foreground">Saved!</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1 rounded border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring border-border disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Profile Section */}
      <div className="border-t p-2">
        {user ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-auto p-2 hover:bg-accent"
              >
                <Avatar className="h-8 w-8">
                  {user.user_metadata?.avatar_url ? (
                    <AvatarImage
                      src={user.user_metadata.avatar_url}
                      alt={user.email || "User"}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(user.email || "U")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate flex-1 text-left">
                  {user.email}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-64 p-3 z-[100]">
              <div className="space-y-2">
                <div className="flex items-center gap-3 pb-2 border-b">
                  <Avatar className="h-10 w-10">
                    {user.user_metadata?.avatar_url ? (
                      <AvatarImage
                        src={user.user_metadata.avatar_url}
                        alt={user.email || "User"}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user.email || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Signed in</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    toast({
                      title: "Settings",
                      description: "Settings page coming soon.",
                    });
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 h-auto p-2 hover:bg-accent"
            onClick={() => router.push("/login")}
          >
            <User className="h-8 w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Log In</span>
          </Button>
        )}
      </div>
    </div>
  );
}