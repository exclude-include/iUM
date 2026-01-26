"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Moon, Sun, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { UploadReelDialog } from "@/components/UploadReelDialog";

export function RightStatus() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const handleMessageClick = () => {
    router.push("/");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <div className="flex h-full w-64 flex-col border-l bg-background p-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Quick Actions
          </h3>
          
          {/* Upload Reel Button */}
          <Button
            onClick={() => setIsUploadDialogOpen(true)}
            className="w-full justify-start gap-3"
            size="lg"
            variant="default"
          >
            <Upload className="h-5 w-5" />
            <span>Upload Reel</span>
          </Button>

          {/* Dark Mode Toggle */}
          <Button
            onClick={toggleTheme}
            className="w-full justify-start gap-3"
            size="lg"
            variant="outline"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-5 w-5" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-5 w-5" />
                <span>Dark Mode</span>
              </>
            )}
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Ask Tutor Button */}
        <div className="space-y-3">
          <Button
            onClick={handleMessageClick}
            className="w-full justify-start gap-3"
            size="lg"
            variant="secondary"
          >
            <MessageSquare className="h-5 w-5" />
            <span>Ask Tutor</span>
          </Button>
        </div>
      </div>

      {/* Upload Dialog */}
      <UploadReelDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
      />
    </>
  );
}

