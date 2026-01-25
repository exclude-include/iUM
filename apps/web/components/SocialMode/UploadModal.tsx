"use client";

import { useState, useRef } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useSocialStore, initializeSocialReels, fetchReelsFromSupabase } from "./useSocialStore";
import { useAppStore } from "@/lib/store";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const { knowledgeFolders, activeFolderId } = useAppStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFolder = knowledgeFolders.find((f) => f.id === activeFolderId);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file (MP4, WebM, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 50MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your reel",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "Video required",
        description: "Please select a video file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to upload videos");
      }

      // Generate unique filename
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("reels")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("reels").getPublicUrl(fileName);

      // Insert record into reels table
      const { error: insertError } = await supabase.from("reels").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        video_url: publicUrl,
        folder_id: activeFolderId || null,
        folder_name: activeFolder?.name || null,
        likes_count: 0,
        comments_count: 0,
      });

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Success!",
        description: "Your reel has been uploaded successfully",
      });

      // Refresh the feed by fetching from Supabase
      const supabaseReels = await fetchReelsFromSupabase(supabase);
      if (supabaseReels.length > 0) {
        useSocialStore.setState({ 
          reels: supabaseReels,
          currentReelIndex: 0, // Reset to show the new upload
        });
      } else {
        // Fallback to mock data if no Supabase reels
        if (knowledgeFolders.length > 0) {
          initializeSocialReels(knowledgeFolders);
        }
      }

      // Reset form and close modal
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 hover:bg-muted transition-colors"
          disabled={isUploading}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-2xl font-bold">Upload New Reel</h2>

        <div className="space-y-4">
          {/* Title input */}
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium">
              Title *
            </label>
            <Input
              id="title"
              type="text"
              placeholder="Enter reel title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              maxLength={100}
            />
          </div>

          {/* Description input */}
          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium">
              Description (optional)
            </label>
            <textarea
              id="description"
              placeholder="Describe your reel..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              maxLength={500}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* File input */}
          <div>
            <label htmlFor="video" className="mb-2 block text-sm font-medium">
              Video File * (Max 50MB)
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                id="video"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                {selectedFile ? selectedFile.name : "Select Video"}
              </Button>
            </div>
            {selectedFile && (
              <p className="mt-2 text-xs text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>

          {/* Active folder info */}
          {activeFolder && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Uploading to folder:</p>
              <p className="text-sm font-medium">{activeFolder.name}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !title.trim() || !selectedFile}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

