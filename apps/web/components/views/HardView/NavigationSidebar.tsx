"use client";

import { useState, useEffect } from "react";
import { Folder, Plus, Clock, Crown, ChevronRight, Smile, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getMockWorkspace, getMockUserProgress } from "@/lib/mockData";
import { useAppStore } from "@/lib/store";
import type { Workspace, UserProgress, Document } from "@/types";
import { HistoryTimeline } from "@/components/HistoryTimeline";

export function NavigationSidebar() {
  const [selectedTab, setSelectedTab] = useState<string>("tab-1");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["folder-1"])
  );
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const { setActiveDocument, chatSessions, activeChatSessionId, setActiveChatSession, deleteSession } = useAppStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ws, progress] = await Promise.all([
          getMockWorkspace(),
          getMockUserProgress(),
        ]);
        setWorkspace(ws);
        setUserProgress(progress);

        // Auto-select first document if available
        if (ws && ws.folders.length > 0) {
          const firstFolder = ws.folders[0];
          if (firstFolder.tabs.length > 0) {
            const firstTab = firstFolder.tabs[0];
            if (firstTab.document) {
              setSelectedTab(firstTab.id);
              setActiveDocument({
                id: firstTab.document.id,
                title: firstTab.document.title,
                content: firstTab.document.content,
                content_type: firstTab.document.content_type,
                sections: firstTab.document.sections,
                equations: firstTab.document.equations,
              });
            }
          }
        }
      } catch (error) {
        console.error("Failed to load workspace data:", error);
      }
    };

    loadData();
  }, [setActiveDocument]);

  const folders = workspace?.folders || [];
  const historyItems = workspace?.history || [];

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col bg-background border-r">
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {/* Folders Section */}
          <div>
            <div className="mb-2 flex items-center justify-between px-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Folders
              </h3>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {folders.map((folder) => {
                const isExpanded = expandedFolders.has(folder.id);
                const Icon = folder.icon === "crown" ? Crown : Folder;
                return (
                  <div key={folder.id} className="space-y-1">
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                      <Icon className="h-3 w-3 text-yellow-500" />
                      <span className="flex-1 text-left">{folder.name}</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 space-y-0.5">
                        {folder.tabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setSelectedTab(tab.id);
                              // Set active document when tab is clicked
                              if (tab.document) {
                                setActiveDocument({
                                  id: tab.document.id,
                                  title: tab.document.title,
                                  content: tab.document.content,
                                  content_type: tab.document.content_type,
                                  sections: tab.document.sections,
                                  equations: tab.document.equations,
                                });
                              } else {
                                setActiveDocument(null);
                              }
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent",
                              selectedTab === tab.id && "bg-accent font-medium"
                            )}
                          >
                            <span>{tab.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Chat Sessions Section */}
          <div>
            <div className="mb-2 flex items-center justify-between px-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Chats
              </h3>
            </div>
            <div className="space-y-1">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                >
                  <button
                    onClick={() => setActiveChatSession(session.id)}
                    className={cn(
                      "flex flex-1 items-center gap-2 text-left",
                      activeChatSessionId === session.id && "font-medium"
                    )}
                  >
                    <MessageCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{session.title}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    title="Delete chat"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
              {chatSessions.length === 0 && (
                <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
                  No chats yet
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* History Section */}
          <div>
            <div className="mb-2 flex items-center justify-between px-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                History
              </h3>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-xs">
                <span className="text-[10px]">manage</span>
              </Button>
            </div>
            
            {/* Timeline Visualization */}
            <div className="mb-2">
              <HistoryTimeline />
            </div>
            
            {/* History Items List */}
            <div className="space-y-1">
              {historyItems.map((item) => (
                <button
                  key={item.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent text-left"
                >
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Learning Status */}
          <div className="rounded-md border bg-card p-2.5">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Learning Status
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Smile className="h-4 w-4 text-yellow-500" />
                <Smile className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs font-bold">Full Streak!!</p>
                <p className="text-[10px] text-muted-foreground">
                  16 days of continuous learning!
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

