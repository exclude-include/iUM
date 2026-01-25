"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Search, Compass, Video, MessageCircle, Bell, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useSocialStore, initializeSocialReels } from "./useSocialStore";
import { UploadModal } from "./UploadModal";

export function SocialSidebar() {
  const router = useRouter();
  const { knowledgeFolders } = useAppStore();
  const {
    activeFolderIds,
    showAllFolders,
    toggleFolder,
    setShowAllFolders,
    refreshFeed,
  } = useSocialStore();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Initialize reels when folders are available
  useEffect(() => {
    if (knowledgeFolders.length > 0) {
      initializeSocialReels(knowledgeFolders);
    }
  }, [knowledgeFolders]);

  const navItems = [
    { icon: Home, label: "Home", action: () => router.push("/") },
    { icon: Search, label: "Search", action: () => {} },
    { icon: Compass, label: "Explore", action: () => {} },
    { icon: Video, label: "Reels", action: () => {} },
    { icon: MessageCircle, label: "Message", action: () => router.push("/") },
    { icon: Bell, label: "Notification", action: () => {} },
  ];

  const handleAllToggle = (checked: boolean) => {
    setShowAllFolders(checked);
  };

  const handleFolderToggle = (folderId: string) => {
    toggleFolder(folderId);
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      {/* Navigation */}
      <div className="border-b p-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.action}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Folder Filters */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Filters</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={refreshFeed}
                title="Refresh Feed"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* New Post Button */}
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Button>

          {/* All Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">All</span>
            <Switch
              checked={showAllFolders}
              onCheckedChange={handleAllToggle}
            />
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
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: folder.color }}
                      />
                      <span className="text-sm">{folder.name}</span>
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => handleFolderToggle(folder.id)}
                      disabled={showAllFolders}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}

