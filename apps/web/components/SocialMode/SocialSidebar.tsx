"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { User, Search, Compass, Video, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useSocialStore, initializeSocialReels } from "./useSocialStore";

export function SocialSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { knowledgeFolders } = useAppStore();
  const {
    activeFolderIds,
    showAllFolders,
    toggleFolder,
    setShowAllFolders,
    refreshFeed,
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
      icon: User, 
      label: "Profile", 
      href: "/soft/profile"
    },
    { 
      icon: Search, 
      label: "Search", 
      href: "/soft/search"
    },
    { 
      icon: Compass, 
      label: "Explore", 
      href: "/soft/explore"
    },
    { 
      icon: Video, 
      label: "Reels", 
      href: "/soft"
    },
  ];

  const handleAllToggle = (checked: boolean) => {
    setShowAllFolders(checked);
  };

  const handleFolderToggle = (folderId: string) => {
    toggleFolder(folderId);
  };

  return (
    <div className="group flex h-full w-16 hover:w-64 flex-col border-r bg-background transition-all duration-300 ease-in-out overflow-hidden">
      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative w-full flex items-center gap-3 rounded-lg p-3 transition-all duration-200",
                "hover:bg-accent",
                isActive && "bg-accent"
              )}
            >
              {/* Icon - stays in fixed position */}
              <Icon 
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} 
              />
              {/* Label - slides in from right */}
              <span 
                className={cn(
                  "whitespace-nowrap text-sm font-medium transition-all duration-300",
                  "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
                  isActive ? "text-primary" : "text-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Folder Filters - Hidden when collapsed */}
      <div className="flex-1 overflow-hidden group-hover:overflow-y-auto border-t">
        <div className="p-0 group-hover:p-4 opacity-0 group-hover:opacity-100 transition-all duration-300 space-y-4">
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

