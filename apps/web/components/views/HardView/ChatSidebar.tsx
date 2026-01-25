"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types/api";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

export function ChatSidebar() {
  const {
    addLearningTab,
    addTimelineEvent,
    knowledgeFolders,
    activeFolderId,
    addMessageToFolder,
  } = useAppStore();

  const { toast } = useToast();
  const activeFolder = knowledgeFolders.find((f) => f.id === activeFolderId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [lastSavedMessageId, setLastSavedMessageId] = useState<string | null>(null);
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Generate study summary from last AI message content
  const generateStudySummary = useCallback(async () => {
    if (isGeneratingSummary || messages.length < 2) return;
    
    // Check if already saved for current conversation
    const lastAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant");
    if (lastAssistantMessage && lastSavedMessageId === lastAssistantMessage.id) {
      return; // Already saved this conversation
    }

    setIsGeneratingSummary(true);
    try {
      // Generate summary based on the conversation
      const summary = await api.chat.generateSummary(messages);
      
      // Calculate duration (estimate: 1 minute per message, minimum 5 minutes)
      const estimatedDuration = Math.max(5, messages.length);

      // Add timeline event with the generated title
      addTimelineEvent({
        title: summary.title,
        category: summary.category as 'concept' | 'code' | 'review' | 'quiz',
        startTime: messages[0].timestamp, // Use first message timestamp
        duration: estimatedDuration,
      });
      
      // Mark as saved
      if (lastAssistantMessage) {
        setLastSavedMessageId(lastAssistantMessage.id);
      }
      setIsSaved(true);
      
      // Reset "Saved!" state after 2 seconds
      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to generate study summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [messages, isGeneratingSummary, addTimelineEvent, lastSavedMessageId]);

  // Auto-trigger summary after 3 user messages
  useEffect(() => {
    const userMessages = messages.filter((msg) => msg.role === "user");
    if (userMessages.length >= 3 && userMessages.length > userMessageCountRef.current) {
      userMessageCountRef.current = userMessages.length;
      // Delay to ensure all messages are processed
      const timer = setTimeout(() => {
        generateStudySummary();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages, generateStudySummary]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Safety check: Warn if no folder is active (but allow chat to work)
    if (!activeFolderId) {
      toast({
        title: "No folder selected",
        description: "Chatting without a folder will search all documents. Create or select a folder for focused learning.",
        variant: "default",
      });
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    
    // Save user message to active folder's chat history
    if (activeFolderId) {
      addMessageToFolder(activeFolderId, userMessage);
    }
    
    setInput("");
    setIsLoading(true);
    userMessageCountRef.current += 1;

    try {
      // Send message to API with folder_id for folder-aware RAG
      const response = await api.chat.sendMessage(input.trim(), {
        conversationId: conversationId || undefined,
        collectionName: "user_knowledge",
        folderId: activeFolderId || undefined,
      });

      // Update conversation ID if we got one
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      // Check for learning unit and add as a new tab
      if (response.learning_unit) {
        addLearningTab(response.learning_unit);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to active folder's chat history
      if (activeFolderId) {
        addMessageToFolder(activeFolderId, assistantMessage);
      }
      
      // Reset saved state when new AI message arrives
      setIsSaved(false);
      setLastSavedMessageId(null);
    } catch (error) {
      // Show error toast
      toast({
        title: "Chat error",
        description: error instanceof Error 
          ? error.message 
          : "Failed to send message. Please try again.",
        variant: "destructive",
      });

      // Handle error
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "assistant",
        content: error instanceof Error 
          ? `Sorry, I encountered an error: ${error.message}. Please make sure the backend is running and documents are ingested.`
          : "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      
      // Save error message to folder if active
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
          <div className="p-3 space-y-3">
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
              <div
                className={cn(
                  "max-w-[80%] rounded border px-2.5 py-1.5 text-xs",
                  message.role === "assistant"
                    ? "bg-muted text-foreground border-border"
                    : "bg-primary text-primary-foreground border-primary"
                )}
              >
                {message.role === "assistant" && (
                  <p className="font-medium text-[10px] mb-0.5">iUM!</p>
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
                        // Style code blocks
                        code: (props: any) => {
                          const { inline, className, children, ...rest } = props;
                          return !inline ? (
                            <code
                              className={cn(
                                "block rounded bg-muted p-2 text-xs overflow-x-auto",
                                className
                              )}
                              {...rest}
                            >
                              {children}
                            </code>
                          ) : (
                            <code
                              className={cn(
                                "rounded bg-muted/50 px-1 py-0.5 text-xs",
                                className
                              )}
                              {...rest}
                            >
                              {children}
                            </code>
                          );
                        },
                        // Style paragraphs
                        p: ({ children }: { children?: React.ReactNode }) => (
                          <p className="mb-1 last:mb-0">{children}</p>
                        ),
                        // Style lists
                        ul: ({ children }: { children?: React.ReactNode }) => (
                          <ul className="list-disc list-inside mb-1 space-y-0.5">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }: { children?: React.ReactNode }) => (
                          <ol className="list-decimal list-inside mb-1 space-y-0.5">
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
                    <p className="text-[10px] text-muted-foreground mb-1">
                      Sources:
                    </p>
                    <div className="space-y-0.5">
                      {message.sources.map((source, idx) => (
                        <p
                          key={idx}
                          className="text-[10px] text-muted-foreground truncate"
                          title={source.title}
                        >
                          • {source.title}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7 border border-border shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                  i
                </AvatarFallback>
              </Avatar>
              <div className="rounded border bg-muted px-2.5 py-1.5 text-xs">
                <p className="font-medium text-[10px] mb-0.5">iUM!</p>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-[10px]">Thinking...</span>
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
        {/* Save Progress Button */}
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
            placeholder="text Input"
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

    </div>
  );
}
