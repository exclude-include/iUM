"use client";

import { useState } from "react";
import { Flame, Sparkles, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ProfileMenu } from "@/components/ProfileMenu";
import { UploadReelDialog } from "@/components/UploadReelDialog";

export function GlobalNavDock() {
  const pathname = usePathname();
  const isHardMode = pathname?.startsWith("/hard");
  const isSoftMode = pathname?.startsWith("/soft");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-full w-16 flex-col items-center border-r bg-background py-4">
        {/* Top Section */}
        <div className="flex flex-col items-center gap-3">
          {/* iUM Logo */}
          <div className="mb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-lg font-semibold text-lg"
                >
                  iUM
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>iUM</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Fire (Streak) - Hard View */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/hard">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-lg hover:bg-accent transition-colors",
                    isHardMode && "bg-accent"
                  )}
                >
                  <Flame className="h-5 w-5 text-orange-500" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Hard-Basic View (Workspace)</p>
            </TooltipContent>
          </Tooltip>

          {/* Sparkles - Soft View (Reels) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/soft">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-lg hover:bg-accent transition-colors",
                    isSoftMode && "bg-accent"
                  )}
                >
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Soft View (Reels)</p>
            </TooltipContent>
          </Tooltip>

          {/* Notification */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg hover:bg-accent relative"
              >
                <Bell className="h-5 w-5" />
                {/* Notification badge could go here */}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Notifications</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Section */}
        <div className="flex flex-col items-center gap-3">
          <Separator className="w-8" />

          {/* Profile Menu */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ProfileMenu onUploadClick={() => setIsUploadDialogOpen(true)} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Profile</p>
            </TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg hover:bg-accent"
                onClick={() => window.location.href = "/settings"}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Upload Reel Dialog */}
      <UploadReelDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
      />
    </TooltipProvider>
  );
}

