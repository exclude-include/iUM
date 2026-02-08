"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, FileText, UploadCloud, X, Folder, Flame, Network, CheckSquare, Square, Sparkles, HardDrive, Bookmark, Loader2, Pencil, FileCode, FileImage, File, Download, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAppStore, IumFile } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useGooglePicker } from "@/hooks/useGooglePicker";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
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
    loadTabFromIum,
    setSelectedDocuments,
    renameFolder, // ✨ Added
    renameFile, // ✨ Added
    toggleFileStar, // ✨ Added
    toggleFileOpen, // ✨ Added for open state tracking
    notebookTabs, // ✨ Added to check which tabs are open
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
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  // ✨ Folder Rename State
  const [folderToRename, setFolderToRename] = useState<{ id: string; name: string } | null>(null);
  const [renameFolderInput, setRenameFolderInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Resizable section heights (in pixels)
  const [foldersHeight, setFoldersHeight] = useState(150);
  const [filesHeight, setFilesHeight] = useState(250);
  const [isDragging, setIsDragging] = useState<'folders' | 'files' | null>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Handle resize drag
  const handleMouseDown = (section: 'folders' | 'files', e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(section);
    dragStartY.current = e.clientY;
    dragStartHeight.current = section === 'folders' ? foldersHeight : filesHeight;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const delta = e.clientY - dragStartY.current;
      const newHeight = Math.max(80, Math.min(400, dragStartHeight.current + delta));

      if (isDragging === 'folders') {
        setFoldersHeight(newHeight);
      } else {
        setFilesHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // ✨ Dynamic Icon Helper
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <FileText className="h-3 w-3 shrink-0 opacity-70 text-red-500" />;
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
      case 'avi': return <File className="h-3 w-3 shrink-0 opacity-70 text-purple-500" />;
      case 'mp3':
      case 'wav': return <File className="h-3 w-3 shrink-0 opacity-70 text-pink-500" />;
      case 'json': return <FileCode className="h-3 w-3 shrink-0 opacity-70 text-green-500" />;
      case 'ium': return <Pencil className="h-3 w-3 shrink-0 text-primary" />;
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
    const initializeFiles = async () => {
      await fetchFiles();
      // ✨ Restore tabs that were open (marked as is_open=true in DB)
      await useAppStore.getState().restoreOpenTabs();
    };
    initializeFiles();
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
          // Reload folders from Supabase so the new folder (with DB id) is in state and persists on refresh
          await fetchFiles();
          // Select the newly created folder (use DB id from response)
          if (folder?.id) setActiveFolder(folder.id);
          toast({
            title: "Folder created",
            description: `"${folder.name}" has been created and saved to the cloud.`,
          });
        } else {
          const errBody = await response.json().catch(() => ({}));
          const msg = errBody?.detail || response.statusText || "Failed to create folder";
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
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

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (token) {
        // Delete from server
        await api.workspace.deleteFolder("default", folderId, token);
      }

      // Delete locally
      deleteFolder(folderId);

      toast({
        title: "Folder deleted",
        description: `"${folderName}" has been deleted.`,
      });
    } catch (error) {
      console.error("Failed to delete folder:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete folder from server.",
        variant: "destructive",
      });
    }
  };

  const handleRenameFile = async () => {
    if (!fileToRename || !renameInput.trim()) return;

    try {
      await renameFile(fileToRename.id, renameInput.trim() + (renameInput.trim().endsWith('.ium') ? '' : '.ium'));
      toast({
        title: "File renamed",
        description: `File has been renamed to "${renameInput}"`,
      });
      setFileToRename(null);
      setRenameInput("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rename file",
        variant: "destructive",
      });
    }
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

      // ✨ Close the corresponding tab if open 
      const openTab = notebookTabs.find(tab => tab.syncInfo?.fileId === fileId);
      if (openTab) {
        useAppStore.getState().deleteNotebookTab(openTab.id);
      }

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
        title: "Tab focused",
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

      // Load the tab from the .ium data (pass fileId for sync tracking AND fileName for title)
      loadTabFromIum(iumData, activeFolderId || undefined, file.id, file.name);

      toast({
        title: "Tab opened",
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

  // Separate files into regular files and .ium files
  const regularFiles = activeFolder?.files.filter(f => !isIumFile(f.name)) || [];
  const iumFiles = activeFolder?.files.filter(f => isIumFile(f.name)) || [];

  // Handle file download
  const handleDownloadFile = (fileId: string, fileName: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const downloadUrl = `${apiUrl}/api/workspace/file/${fileId}/download`;

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download started",
      description: `Downloading "${fileName}"...`,
    });

  };

  // ✨ Handle Folder Rename
  const confirmRenameFolder = () => {
    if (folderToRename && renameFolderInput.trim()) {
      renameFolder(folderToRename.id, renameFolderInput.trim());
      setFolderToRename(null);
      toast({ title: "Folder renamed" });
    }
  };


  return (
    <div className="flex h-full flex-col bg-background border-r">
      {/* Header */}
      <div
        data-tutorial="tutorial-sidebar-folders"
        className="flex items-center justify-between border-b px-3 py-2"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide">FOLDERS</h3>
        <div className="flex gap-1">
          {/* View Knowledge Graph button removed */}
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
      <div
        className="w-full shrink-0 overflow-y-auto"
        style={{ height: foldersHeight }}
      >
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
                    setFolderToRename({ id: folder.id, name: folder.name });
                    setRenameFolderInput(folder.name);
                  }}
                  title="Rename folder"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id, folder.name);
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
        </div>
      </div>

      {/* Drag Handle between Folders and Files */}
      <div
        className={cn(
          "h-2 w-full cursor-ns-resize flex items-center justify-center hover:bg-muted/50 transition-colors group",
          isDragging === 'folders' && "bg-primary/20"
        )}
        onMouseDown={(e) => handleMouseDown('folders', e)}
      >
        <div className="w-8 h-0.5 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors" />
      </div>

      {/* Section 2: FILES (when folder is active) */}
      {activeFolder && (
        <div
          className="w-full shrink-0 overflow-y-auto border-t"
          style={{ height: filesHeight }}
        >
          <div className="p-2 space-y-2">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                {/* Select All Checkbox */}
                <div
                  className="cursor-pointer flex items-center justify-center h-4 w-4"
                  onClick={handleSelectAll}
                  title="Select All"
                >
                  {regularFiles.length > 0 && selectedDocumentIds.length === regularFiles.length ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
                  )}
                </div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedDocumentIds.length > 0 ? `${selectedDocumentIds.length} Selected` : "FILES"}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                {selectedDocumentIds.length > 0 ? (
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
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Regular Files List */}
            {regularFiles.length > 0 && (
              <div className="space-y-1 ml-2">
                {regularFiles.map((file, index) => {
                  const isSelected = selectedDocumentIds.includes(file.id);
                  return (
                    <div
                      key={`${file.id}-${index}`}
                      className="group flex items-center gap-2 text-[10px] text-muted-foreground hover:bg-muted/50 p-1 rounded relative pr-16"
                    >
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
                        {/* ✨ Show star icon if starred, otherwise file type icon */}
                        {file.isStarred ? (
                          <Star className="h-3 w-3 shrink-0 text-yellow-500 fill-yellow-500" />
                        ) : (
                          getFileIcon(file.name)
                        )}
                        <span
                          className={cn(
                            "truncate cursor-pointer",
                            isSelected && "text-foreground font-medium"
                          )}
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-green-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(file.id, file.name);
                          }}
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-blue-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToRename({ id: file.id, name: file.name });
                            setRenameInput(file.name);
                          }}
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToDelete({ id: file.id, name: file.name });
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Saved Tabs Section */}
            {iumFiles.length > 0 && (
              <>
                <Separator className="my-2" />
                <div className="px-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1">
                    <FileText className="h-3 w-3" />
                    SAVED TABS
                  </p>
                </div>
                <div className="space-y-1 ml-2">
                  {iumFiles.map((file, index) => (
                    <div
                      key={`ium-${file.id}-${index}`}
                      className="group flex items-center gap-2 text-[10px] text-muted-foreground hover:bg-primary/10 p-1 rounded relative pr-12 cursor-pointer"
                      onClick={() => handleOpenIumFile(file)}
                    >
                      <div className="shrink-0 flex items-center justify-center h-4 w-4">
                        {/* ✨ Show star icon if starred, otherwise FileText */}
                        {file.isStarred ? (
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className="truncate text-primary hover:underline font-medium"
                          title={file.name}
                        >
                          {file.name.replace('.ium', '')}
                        </span>
                        {/* ✨ Open Badge - shows if tab is currently open */}
                        {notebookTabs.some(tab => tab.syncInfo?.fileId === file.id) && (
                          <span className="ml-1 px-1 py-0.5 rounded-sm bg-green-500/10 text-green-500 text-[9px] font-bold uppercase tracking-tighter border border-green-500/20">
                            OPEN
                          </span>
                        )}
                        {/* ✨ Temp Badge */}
                        {file.is_temp && (
                          <span className="ml-1.5 px-1 py-0.5 rounded-sm bg-orange-500/10 text-orange-500 text-[9px] font-bold uppercase tracking-tighter border border-orange-500/20">
                            TEMP
                          </span>
                        )}
                      </div>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-5 w-5 hover:text-yellow-500", file.isStarred && "text-yellow-500 opacity-100")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFileStar(file.id, !file.isStarred);
                          }}
                          title={file.isStarred ? "Unstar" : "Star"}
                        >
                          <Star className={cn("h-3 w-3", file.isStarred && "fill-current")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-blue-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameInput(file.name.replace('.ium', ''));
                            setFileToRename({ id: file.id, name: file.name });
                          }}
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-green-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(file.id, file.name);
                          }}
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToDelete({ id: file.id, name: file.name });
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {regularFiles.length === 0 && iumFiles.length === 0 && (
              <p className="text-[10px] text-muted-foreground ml-5 italic">
                No files uploaded yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Drag Handle before Bookmarks */}
      <div
        className={cn(
          "h-2 w-full cursor-ns-resize flex items-center justify-center hover:bg-muted/50 transition-colors group",
          isDragging === 'files' && "bg-primary/20"
        )}
        onMouseDown={(e) => handleMouseDown('files', e)}
      >
        <div className="w-8 h-0.5 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors" />
      </div>

      {/* Upload Status */}
      {uploadStatus.isUploading && (
        <div className="p-3 border-t bg-muted/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-[10px] font-medium truncate max-w-[140px]">
              Uploading {uploadStatus.fileName}...
            </span>
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-progress origin-left" />
          </div>
        </div>
      )}

      {/* Section 3: BOOKMARKS */}
      <div className="flex-1 min-h-[80px] border-t bg-muted/20 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Bookmark className="h-3 w-3" />
            BOOKMARKS
          </h3>
        </div>
        <div className="p-2">
          <BookmarksSection />
        </div>
      </div>

      {/* ✨ New Folder Modal */}
      <Dialog open={showNewFolderModal} onOpenChange={setShowNewFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name and choose a color for your new knowledge folder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="space-y-2">
              <Input
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-center">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all border-2",
                    selectedColor === color.value ? "border-foreground scale-110" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderModal(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ Rename Folder Dialog */}
      <Dialog open={!!folderToRename} onOpenChange={(open) => !open && setFolderToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameFolderInput}
              onChange={(e) => setRenameFolderInput(e.target.value)}
              placeholder="Folder Name"
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRenameFolder();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderToRename(null)}>Cancel</Button>
            <Button onClick={confirmRenameFolder} disabled={!renameFolderInput.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                if (e.key === "Enter") handleRenameFile();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFileToRename(null)}>Cancel</Button>
            <Button onClick={handleRenameFile}>Rename</Button>
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
