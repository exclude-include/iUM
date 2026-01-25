"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, FileText, UploadCloud, X, Folder, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { HistoryTimeline } from "@/components/HistoryTimeline";

// Color presets for folders
const FOLDER_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Red", value: "#EF4444" },
  { name: "Green", value: "#10B981" },
  { name: "Orange", value: "#F59E0B" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Pink", value: "#EC4899" },
];

export function FolderSidebar() {
  const {
    knowledgeFolders,
    activeFolderId,
    setActiveFolder,
    createFolder,
    deleteFolder,
    addFileToFolder,
    userStreak,
  } = useAppStore();

  const { toast } = useToast();
  const activeFolder = knowledgeFolders.find((f) => f.id === activeFolderId);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    createFolder(newFolderName.trim(), selectedColor);
    setShowNewFolderModal(false);
    setNewFolderName("");
    setSelectedColor(FOLDER_COLORS[0].value);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Safety check: Require active folder for file upload
    if (!activeFolderId) {
      toast({
        title: "No folder selected",
        description: "Please select or create a folder first before uploading files.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Show uploading toast
    toast({
      title: "Uploading...",
      description: `Processing ${file.name}`,
    });

    try {
      // Upload file to backend with folder_id
      const response = await api.ingest.uploadFile(file, "user_knowledge", activeFolderId);

      // Create UploadedFile object for UI state
      const uploadedFile = {
        name: file.name,
        uploadedAt: Date.now(),
      };

      // Add to folder UI state
      addFileToFolder(activeFolderId, uploadedFile);

      // Show success toast
      toast({
        title: "File processed successfully",
        description: `${file.name} has been added to "${activeFolder?.name}". ${response.chunks_created} chunks created.`,
      });
    } catch (error) {
      console.error("Failed to upload file:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex h-full flex-col bg-background border-r">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">FOLDERS</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => setShowNewFolderModal(true)}
          title="New Folder"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Section 1: FOLDERS (Natural Height, Scrollable if needed) */}
      <div className="w-full shrink-0 max-h-[40vh] overflow-y-auto">
        <div className="p-2 space-y-2">
          {/* Folder List */}
          <div className="space-y-1">
            {knowledgeFolders.map((folder) => (
              <div
                key={folder.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-accent transition-colors",
                  activeFolderId === folder.id && "bg-accent font-medium"
                )}
                onClick={() => setActiveFolder(folder.id)}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: folder.color }}
                />
                <span className="flex-1 truncate">{folder.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(folder.id);
                  }}
                  title="Delete folder"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
            {knowledgeFolders.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
                No folders yet. Click + to create one.
              </p>
            )}
          </div>

          {/* Active Folder Files */}
          {activeFolder && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <Folder className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {activeFolder.name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload file"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {/* File List */}
                {activeFolder.files.length > 0 && (
                  <div className="space-y-1 ml-5">
                    {activeFolder.files.map((file, index) => (
                      <div
                        key={`${file.name}-${file.uploadedAt}`}
                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {activeFolder.files.length === 0 && (
                  <p className="text-[10px] text-muted-foreground ml-5 italic">
                    No files uploaded yet
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <Separator />

      {/* Section 2: HISTORY */}
      <div className="shrink-0 border-t bg-muted/30">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            HISTORY
          </h3>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-xs">
            <span className="text-[10px]">manage</span>
          </Button>
        </div>
        <div className="p-2">
          <HistoryTimeline />
        </div>
      </div>

      {/* Section 3: LEARNING STATUS (Bottom Pinned) */}
      <div className="shrink-0 border-t bg-card">
        <div className="p-2.5">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Learning Status
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(userStreak.currentStreak, 5) }).map((_, i) => (
                <Flame key={i} className="h-4 w-4 text-orange-500 fill-orange-500" />
              ))}
            </div>
            <div>
              <p className="text-xs font-bold">
                {userStreak.currentStreak === 0
                  ? "Start your streak!"
                  : userStreak.currentStreak === 1
                  ? "Day 1!"
                  : `${userStreak.currentStreak} days streak!`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {userStreak.currentStreak === 0
                  ? "Study today to begin!"
                  : `${userStreak.currentStreak} day${userStreak.currentStreak !== 1 ? "s" : ""} of continuous learning!`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-4 w-[320px] shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Create New Folder</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName("");
                  setSelectedColor(FOLDER_COLORS[0].value);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Folder Name Input */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Folder Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Physics, Math, CS..."
                  value={newFolderName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewFolderName(e.target.value)
                  }
                  className="text-sm"
                  autoFocus
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      handleCreateFolder();
                    }
                  }}
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Color
                </label>
                <div className="flex gap-2">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all",
                        selectedColor === color.value
                          ? "border-foreground scale-110"
                          : "border-border hover:border-foreground/50"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setNewFolderName("");
                    setSelectedColor(FOLDER_COLORS[0].value);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

