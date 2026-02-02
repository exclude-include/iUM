"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, FileText, UploadCloud, X, Folder, Flame, Network, CheckSquare, Square, Sparkles, HardDrive, Bookmark, Loader2, Pencil, FileCode, FileImage, FileMusic, FileVideo, FileJson, File, FileType2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // ✨ Import Dialog
import { cn } from "@/lib/utils";
import { useAppStore, IumFile } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useGooglePicker } from "@/hooks/useGooglePicker";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase/client"; // ✨ Import added
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { BookmarksSection } from "./BookmarksSection";

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
    removeFileFromFolder,
    userStreak,
    selectedDocumentIds,
    toggleDocumentSelection,
    isMindMapOpen,
    setMindMapOpen,
    fetchFiles,
  } = useAppStore();

  const { toast } = useToast();
  const activeFolder = knowledgeFolders.find((f) => f.id === activeFolderId);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].value);
  const [isImporting, setIsImporting] = useState(false);
  // ✨ Upload Status State
  const [uploadStatus, setUploadStatus] = useState<{ isUploading: boolean; fileName: string; }>({
    isUploading: false,
    fileName: ""
  });

  // ✨ Modal States for File Management
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);
  const [fileToRename, setFileToRename] = useState<{ id: string; name: string } | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false); // ✨ Bulk delete dialog state
  const [renameInput, setRenameInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✨ Dynamic Icon Helper
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <FileType2 className="h-3 w-3 shrink-0 opacity-70 text-red-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
      case 'svg': return <FileImage className="h-3 w-3 shrink-0 opacity-70 text-blue-500" />;
      case 'txt':
      case 'md': return <FileText className="h-3 w-3 shrink-0 opacity-70 text-gray-500" />;
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
      case 'html':
      case 'css': return <FileCode className="h-3 w-3 shrink-0 opacity-70 text-yellow-500" />;
      case 'mp4':
      case 'mov':
      case 'avi': return <FileVideo className="h-3 w-3 shrink-0 opacity-70 text-purple-500" />;
      case 'mp3':
      case 'wav': return <FileMusic className="h-3 w-3 shrink-0 opacity-70 text-pink-500" />;
      case 'json': return <FileJson className="h-3 w-3 shrink-0 opacity-70 text-green-500" />;
      default: return <File className="h-3 w-3 shrink-0 opacity-70" />;
    }
  };

  // Google Picker for Drive file selection
  const { openPicker, isLoading: isPickerLoading, isReady: isPickerReady } = useGooglePicker({
    onFilePicked: async (file) => {
      if (!activeFolderId) {
        toast({
          title: "No folder selected",
          description: "Please select or create a folder first.",
          variant: "destructive",
        });
        return;
      }

      setIsImporting(true);
      toast({
        title: "Importing...",
        description: `Downloading ${file.name} from Google Drive`,
      });

      try {
        toast({
          title: "Coming Soon",
          description: `Document import for "${file.name}" will be available soon. Currently only video reels are supported via the Social mode.`,
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: error instanceof Error ? error.message : "Failed to import from Google Drive",
          variant: "destructive",
        });
      } finally {
        setIsImporting(false);
      }
    },
    onError: (error) => {
      toast({
        title: "Google Drive Error",
        description: error.message,
        variant: "destructive",
      });
    },
    mimeTypes: undefined,
  });

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        // If not logged in, create locally only
        createFolder(newFolderName.trim(), selectedColor);
        toast({
          title: "Folder created locally",
          description: "Log in to sync across devices.",
        });
      } else {
        // Create folder via API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/workspace/default/folders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            name: newFolderName.trim(),
            color: selectedColor
          })
        });

        if (response.ok) {
          const folder = await response.json();
          // Add folder to local state with DB id
          createFolder(folder.name, folder.color);
          // Refresh to get the actual DB folder
          fetchFiles();
          toast({
            title: "Folder created",
            description: `"${folder.name}" has been created.`,
          });
        } else {
          throw new Error("Failed to create folder");
        }
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder. Please try again.",
        variant: "destructive",
      });
    }

    setShowNewFolderModal(false);
    setNewFolderName("");
    setSelectedColor(FOLDER_COLORS[0].value);
  };

  /* ✨ Modified handleDeleteFile */
  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;

    const { id: fileId, name: fileName } = fileToDelete;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("Authentication required");

      await api.workspace.deleteFile("default", fileId, token);

      // Update local state (refetch)
      fetchFiles();

      toast({
        title: "File deleted",
        description: `"${fileName}" has been deleted.`,
      });
    } catch (error) {
      console.error("Delete failed:", error);
      toast({
        title: "Delete failed",
        description: "Could not delete the file.",
        variant: "destructive",
      });
    } finally {
      setFileToDelete(null);
    }
  };

  const confirmRenameFile = async () => {
    if (!fileToRename || !renameInput.trim() || renameInput === fileToRename.name) {
      setFileToRename(null);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("Authentication required");

      await api.workspace.updateFile("default", fileToRename.id, renameInput, token);
      fetchFiles();

      toast({
        title: "File renamed",
        description: `Renamed to "${renameInput}".`,
      });
    } catch (error) {
      console.error("Rename failed:", error);
      toast({
        title: "Rename failed",
        description: "Could not rename the file.",
        variant: "destructive",
      });
    } finally {
      setFileToRename(null);
      setRenameInput("");
    }
  };

  // ✨ Handle Select All / Deselect All
  const handleSelectAll = () => {
    if (!activeFolder) return;

    if (selectedDocumentIds.length === activeFolder.files.length) {
      // If all selected, deselect all
      setSelectedDocuments([]);
    } else {
      // Select all
      setSelectedDocuments(activeFolder.files.map(f => f.id));
    }
  };

  // ✨ Handle Bulk Delete
  const confirmBulkDelete = async () => {
    if (selectedDocumentIds.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("Authentication required");

      // Execute deletes in parallel
      await Promise.all(
        selectedDocumentIds.map(id => api.workspace.deleteFile("default", id, token))
      );

      fetchFiles();
      setSelectedDocuments([]); // Clear selection

      toast({
        title: "Files deleted",
        description: `${selectedDocumentIds.length} files have been deleted.`,
      });
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast({
        title: "Delete failed",
        description: "Could not delete some files.",
        variant: "destructive",
      });
    } finally {
      setShowBulkDeleteDialog(false);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    toast({
      title: "Uploading...",
      description: `Processing ${file.name}`,
    });

    // ✨ Set upload status
    setUploadStatus({ isUploading: true, fileName: file.name });

    try {
      // ✨ Get session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await api.ingest.uploadFile(
        file,
        "user_knowledge",
        activeFolderId,
        token // ✨ Pass token
      );

      const uploadedFile = {
        id: response.document_ids[0] || `doc-${Date.now()}`,
        name: file.name,
        uploadedAt: Date.now(),
      };

      addFileToFolder(activeFolderId, uploadedFile);

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
    } finally {
      // ✨ Reset upload status
      setUploadStatus({ isUploading: false, fileName: "" });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle opening .ium files
  const handleOpenIumFile = async (file: { id: string; name: string; url?: string }) => {
    if (!file.name.endsWith(".ium")) return;

    // Check if this file is already open (quick check before fetching)
    const existingTab = useAppStore.getState().notebookTabs.find(
      (tab) => tab.syncInfo?.fileId === file.id
    );
    if (existingTab) {
      // Already open - just focus on it
      useAppStore.getState().setNotebookActiveTab(existingTab.id);
      toast({
        title: "Notebook focused",
        description: `"${existingTab.title}" is already open.`,
      });
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      // Fetch the .ium file content from storage
      const response = await fetch(`${apiUrl}/api/workspace/file/${file.id}/content`);

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      const iumData: IumFile = await response.json();

      // Load the tab from the .ium data (pass fileId for sync tracking)
      loadTabFromIum(iumData, activeFolderId || undefined, file.id);

      toast({
        title: "Notebook opened",
        description: `Opened "${iumData.metadata.title}" with ${iumData.cells.length} cells.`,
      });
    } catch (error) {
      console.error("Failed to open .ium file:", error);
      toast({
        title: "Failed to open notebook",
        description: error instanceof Error ? error.message : "Unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  // Check if file is a .ium notebook file
  const isIumFile = (fileName: string) => fileName.endsWith(".ium");

  // Handle file deletion
  const handleDeleteFile = async (file: { id: string; name: string }) => {
    if (!activeFolderId) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${file.name}"?`);
    if (!confirmed) return;

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        // Delete from Supabase (Storage + DB + Vector Store)
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/workspace/file/${file.id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to delete from server");
        }
      }

      // Remove from local store
      removeFileFromFolder(activeFolderId, file.name);

      // If it's an .ium file, also close the tab if it's open
      if (file.name.endsWith(".ium")) {
        const openTab = useAppStore.getState().notebookTabs.find(
          (tab) => tab.syncInfo?.fileId === file.id
        );
        if (openTab) {
          useAppStore.getState().closeTab(openTab.id);
        }
      }

      toast({
        title: "File deleted",
        description: `"${file.name}" has been permanently deleted.`,
      });
    } catch (error) {
      console.error("Failed to delete file:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete the file.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full flex-col bg-background border-r">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">FOLDERS</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setMindMapOpen(true)}
            title="View Knowledge Graph"
          >
            <Network className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          </Button>
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
      </div>

      {/* Section 1: FOLDERS */}
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
                    {/* ✨ Select All Checkbox */}
                    <div
                      className="cursor-pointer flex items-center justify-center h-4 w-4"
                      onClick={handleSelectAll}
                      title="Select All"
                    >
                      {activeFolder.files.length > 0 && selectedDocumentIds.length === activeFolder.files.length ? (
                        <CheckSquare className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {selectedDocumentIds.length > 0 ? `${selectedDocumentIds.length} Selected` : activeFolder.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {selectedDocumentIds.length > 0 ? (
                      /* ✨ Bulk Delete Button */
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        title="Delete Selected"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => fileInputRef.current?.click()}
                          title="Upload local file"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={openPicker}
                          disabled={!isPickerReady || isPickerLoading || isImporting}
                          title="Import from Google Drive"
                        >
                          <HardDrive className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {/* File List with Checkboxes */}
                {activeFolder.files.length > 0 && (
                  <div className="space-y-1 ml-2">
                    {activeFolder.files.map((file, index) => {
                      const isSelected = selectedDocumentIds.includes(file.id);
                      const isNotebook = isIumFile(file.name);
                      return (
                        <div
                          key={`${file.id}-${index}`}
                          className="flex items-center gap-2 text-[10px] text-muted-foreground hover:bg-muted/50 p-1 rounded"
                        >
                          {/* 체크박스 영역 */}
                          <div
                            className="shrink-0 cursor-pointer flex items-center justify-center h-4 w-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDocumentSelection(file.id);
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <FileText className="h-3 w-3 shrink-0 opacity-70" />
                            <span
                              className={cn(
                                "truncate cursor-pointer",
                                isSelected && "text-foreground font-medium",
                                isNotebook && "text-primary hover:underline"
                              )}
                              title={isNotebook ? `Click to open "${file.name}"` : file.name}
                            >
                              {file.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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

      <Separator />

      {/* Section 2: BOOKMARKS */}
      <div className="shrink-0 border-t bg-muted/20">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Bookmark className="h-3 w-3" />
            BOOKMARKS
          </h3>
        </div>
        <div className="p-2 max-h-[120px] overflow-y-auto">
          <BookmarksSection />
        </div>
      </div>

      {/* Section 3: HISTORY */}
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

      {/* Section 4: LEARNING STATUS */}
      <div className="shrink-0 border-t bg-card">
        {uploadStatus.isUploading ? (
          <div className="p-3 bg-muted/50 border-b animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate mb-1">
                  Uploading {uploadStatus.fileName}...
                </p>
                <div className="h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      handleCreateFolder();
                    }
                  }}
                />
              </div>

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

      {/* Mind Map Modal */}
      {isMindMapOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-background border rounded-xl w-[80vw] h-[80vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Network className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Knowledge Graph</h2>
                  <p className="text-xs text-muted-foreground">
                    Visualizing connections in {activeFolder ? activeFolder.name : "All Folders"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMindMapOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Content (Placeholder for Graph) */}
            <div className="flex-1 bg-dot-pattern relative flex items-center justify-center bg-slate-50 dark:bg-slate-950/50">
              <div className="text-center space-y-4">
                <div className="w-64 h-64 border-2 border-dashed rounded-full flex items-center justify-center mx-auto opacity-20">
                  <Network className="h-32 w-32" />
                </div>
                <p className="text-muted-foreground">
                  Knowledge Graph visualization will appear here.
                </p>
                <Button variant="outline" onClick={() => toast({ description: "Generating graph..." })}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Graph
                </Button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
              <span>Selected context: {selectedDocumentIds.length} files</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">Export</Button>
                <Button size="sm">Focus Mode</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ✨ Delete Confirmation Dialog */}
      <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{fileToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFileToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteFile}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ Rename Dialog */}
      <Dialog open={!!fileToRename} onOpenChange={(open) => !open && setFileToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for the file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Enter file name"
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRenameFile();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFileToRename(null)}>Cancel</Button>
            <Button onClick={confirmRenameFile}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ Bulk Delete Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Files</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedDocumentIds.length} files? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>Delete All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
