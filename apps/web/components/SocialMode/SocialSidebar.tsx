"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home, Search, Compass, Video, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useSocialStore, initializeSocialReels } from "./useSocialStore";

export function SocialSidebar() {
  const router = useRouter();
  const { knowledgeFolders } = useAppStore();
  const {
    activeFolderIds,
    showAllFolders,
    toggleFolder,
    setShowAllFolders,
    refreshFeed,
    currentView,
    setCurrentView,
  } = useSocialStore();

  // Load reels from Supabase on mount
  useEffect(() => {
    const loadReels = async () => {
      await useSocialStore.getState().loadReelsFromSupabase();
      
      // If no reels from Supabase and folders are available, initialize with mock data
      if (useSocialStore.getState().reels.length === 0 && knowledgeFolders.length > 0) {
        initializeSocialReels(knowledgeFolders);
      }
    };
    
    loadReels();
  }, [knowledgeFolders]);

  const navItems = [
    { 
      icon: Home, 
      label: "Home", 
      action: () => setCurrentView("profile"),
      view: "profile" as const
    },
    { 
      icon: Search, 
      label: "Search", 
      action: () => setCurrentView("search"),
      view: "search" as const
    },
    { 
      icon: Compass, 
      label: "Explore", 
      action: () => setCurrentView("explore"),
      view: "explore" as const
    },
    { 
      icon: Video, 
      label: "Reels", 
      action: () => setCurrentView("feed"),
      view: "feed" as const
    },
  ];

  const handleAllToggle = (checked: boolean) => {
    setShowAllFolders(checked);
  };

  const handleFolderToggle = (folderId: string) => {
    toggleFolder(folderId);
  };

  return (
    <div className="group flex h-full w-14 hover:w-64 flex-col border-r bg-background transition-all duration-300 ease-in-out">
      {/* Navigation */}
      <div className="border-b p-2 group-hover:p-4 transition-all duration-300">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.view ? currentView === item.view : false;
            return (
              <button
                key={item.label}
                onClick={item.action}
                className={cn(
                  "flex w-full items-center justify-center group-hover:justify-start gap-3 rounded-lg p-2.5 text-sm font-medium transition-all duration-300",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="opacity-0 w-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Folder Filters - Hidden when collapsed */}
      <div className="flex-1 overflow-hidden group-hover:overflow-y-auto p-0 group-hover:p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold whitespace-nowrap">
              Filters
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={refreshFeed}
              title="Refresh Feed"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* All Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 overflow-hidden">
            <span className="text-sm font-medium whitespace-nowrap">
              All
            </span>
            <div className="transition-all duration-300">
              <Switch
                checked={showAllFolders}
                onCheckedChange={handleAllToggle}
                className="flex-shrink-0"
              />
            </div>
          </div>

          {/* Folder List */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Folders
            </p>
            {knowledgeFolders.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No folders available. Create folders in Hard Mode.
              </p>
            ) : (
              knowledgeFolders.map((folder) => {
                const isActive = showAllFolders || activeFolderIds.includes(folder.id);
                return (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between rounded-lg border p-3 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: folder.color }}
                      />
                      <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                        {folder.name}
                      </span>
                    </div>
                    <div className="transition-all duration-300">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleFolderToggle(folder.id)}
                        disabled={showAllFolders}
                        className="flex-shrink-0"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

