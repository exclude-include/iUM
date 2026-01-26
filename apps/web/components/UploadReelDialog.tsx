"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileVideo, Link2 } from "lucide-react";
import { useSocialStore } from "./SocialMode/useSocialStore";

interface UploadReelDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadReelDialog({ isOpen, onClose }: UploadReelDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url" | "drive">("url");
  const [folderName, setFolderName] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith("video/")) {
        toast({
          title: "Invalid file",
          description: "Please select a video file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 100MB)
      if (selectedFile.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a video under 100MB",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleGoogleDriveImport = async () => {
    toast({
      title: "Google Drive Import",
      description: "Coming soon! This will allow you to import videos from your Google Drive.",
    });
    
    // TODO: Implement Google Drive Picker API
    // This will require:
    // 1. Google OAuth authentication (already set up in login)
    // 2. Google Picker API integration
    // 3. File download and upload to Supabase storage
  };

  const addHashtag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase().replace(/^#/, "");
    if (cleanTag && !hashtags.includes(cleanTag)) {
      setHashtags([...hashtags, cleanTag]);
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handleHashtagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      if (hashtagInput.trim()) {
        addHashtag(hashtagInput);
        setHashtagInput("");
      }
    }
  };

  // Auto-add folder name as hashtag when it changes
  const handleFolderNameChange = (value: string) => {
    setFolderName(value);
    if (value.trim()) {
      const folderTag = value.trim().toLowerCase().replace(/\s+/g, "_");
      if (!hashtags.includes(folderTag)) {
        addHashtag(folderTag);
      }
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      toast({
        title: "Missing title",
        description: "Please enter a title for your reel",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to upload reels");
      }

      let finalVideoUrl = videoUrl;

      // Handle file upload if a file was selected
      if (uploadMode === "file" && file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("reels")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("reels").getPublicUrl(fileName);

        finalVideoUrl = publicUrl;
      }

      // Create reel record in database
      // TODO: Create a 'reels' table in Supabase with columns:
      // - id, title, description, video_url, user_id, folder_id, created_at, likes, comments, tags, folder_name
      
      const { error: insertError } = await supabase.from("reels").insert({
        title: title.trim(),
        description: description.trim(),
        video_url: finalVideoUrl,
        user_id: user.id,
        author_name: user.user_metadata?.full_name || user.email,
        folder_name: folderName.trim() || null,
        tags: hashtags,
        likes: 0,
        comments: 0,
      });

      if (insertError) {
        // If the table doesn't exist yet, add to local store only
        console.warn("Database insert failed, adding to local store:", insertError);
        
        // Add to local store
        const { reels } = useSocialStore.getState();
        const newReel = {
          id: `reel-${Date.now()}`,
          title: title.trim(),
          description: description.trim(),
          videoUrl: finalVideoUrl,
          color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          likes: 0,
          comments: 0,
          folderId: folderName.trim() || "default",
          folderName: folderName.trim() || "My Reels",
          author: user.user_metadata?.full_name || user.email || "User",
          tags: hashtags,
        };
        
        useSocialStore.setState({ reels: [...reels, newReel] });
      }

      toast({
        title: "Success!",
        description: "Your reel has been uploaded.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setVideoUrl("");
      setFile(null);
      setFolderName("");
      setHashtags([]);
      setHashtagInput("");
      onClose();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload reel",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload Reel</SheetTitle>
          <SheetDescription>
            Share your knowledge with the community
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Upload Mode Selection */}
          <div className="flex gap-2">
            <Button
              variant={uploadMode === "url" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMode("url")}
              className="flex-1"
            >
              <Link2 className="mr-2 h-4 w-4" />
              URL
            </Button>
            <Button
              variant={uploadMode === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMode("file")}
              className="flex-1"
            >
              <FileVideo className="mr-2 h-4 w-4" />
              File
            </Button>
            <Button
              variant={uploadMode === "drive" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMode("drive")}
              className="flex-1"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.5 4l5.5 9.5H2.5L8.5 4zm7.5 0l5.5 9.5h-11L16 4zM12 14.5L6.5 24h11L12 14.5z" />
              </svg>
              Drive
            </Button>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              placeholder="Enter reel title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describe your reel"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              rows={3}
            />
          </div>

          {/* Folder Name Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Folder/Category</label>
            <Input
              placeholder="e.g., Math, Physics, Programming"
              value={folderName}
              onChange={(e) => handleFolderNameChange(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              Auto-generates hashtag for recommendations
            </p>
          </div>

          {/* Hashtags Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Hashtags</label>
            <div className="space-y-2">
              {/* Tag Pills */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeHashtag(tag)}
                        className="hover:text-primary/70"
                        disabled={isUploading}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                placeholder="Add hashtags (press Enter or comma)"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={handleHashtagInputKeyDown}
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                Press Enter, comma, or space to add hashtags
              </p>
            </div>
          </div>

          {/* Conditional Upload Input */}
          {uploadMode === "url" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Video URL</label>
              <Input
                type="url"
                placeholder="https://example.com/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isUploading}
              />
            </div>
          )}

          {uploadMode === "file" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Video File</label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="flex-1"
                />
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}

          {uploadMode === "drive" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Import videos directly from your Google Drive
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleDriveImport}
                disabled={isUploading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.5 4l5.5 9.5H2.5L8.5 4zm7.5 0l5.5 9.5h-11L16 4zM12 14.5L6.5 24h11L12 14.5z" />
                </svg>
                Select from Google Drive
              </Button>
            </div>
          )}

          {/* Upload Button */}
          <Button
            className="w-full mt-6"
            onClick={handleUpload}
            disabled={isUploading || !title.trim() || (uploadMode === "url" && !videoUrl) || (uploadMode === "file" && !file)}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Reel
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By uploading, you agree to our terms of service
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
