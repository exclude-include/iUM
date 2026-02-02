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
import { useGooglePicker } from "@/hooks/useGooglePicker";
import { Upload, Loader2, FileVideo, Link2, HardDrive } from "lucide-react";
import { useSocialStore } from "./SocialMode/useSocialStore";
import { api } from "@/lib/api";
import { Upload, Loader2, FileVideo, Link2, Plus, Trash2, HelpCircle } from "lucide-react";
import { useSocialStore } from "./SocialMode/useSocialStore";
import type { ReelQuiz, ReelQuizOption } from "@/types/api";
import { cn } from "@/lib/utils";

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
  const [driveUrl, setDriveUrl] = useState("");
  const [selectedDriveFile, setSelectedDriveFile] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  // Google Picker for video selection
  const { openPicker, isLoading: isPickerLoading, isReady: isPickerReady } = useGooglePicker({
    onFilePicked: (file) => {
      setSelectedDriveFile({ id: file.id, name: file.name });
      setDriveUrl(`https://drive.google.com/file/d/${file.id}/view`);
      toast({
        title: "File selected",
        description: `Selected: ${file.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Google Drive Error",
        description: error.message,
        variant: "destructive",
      });
    },
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"],
  });

  // Quiz state
  const [includeQuiz, setIncludeQuiz] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState<ReelQuizOption[]>([
    { key: "A", text: "" },
    { key: "B", text: "" },
  ]);
  const [quizAnswer, setQuizAnswer] = useState<string>("");
  const [quizExplanation, setQuizExplanation] = useState("");
  const [quizTimestamp, setQuizTimestamp] = useState<string>(""); // seconds as string for input

  const { toast } = useToast();

  // Quiz helper functions
  const addQuizOption = () => {
    if (quizOptions.length >= 6) return;
    const nextKey = String.fromCharCode(65 + quizOptions.length); // A, B, C, D, E, F
    setQuizOptions([...quizOptions, { key: nextKey, text: "" }]);
  };

  const removeQuizOption = (index: number) => {
    if (quizOptions.length <= 2) return;
    const newOptions = quizOptions.filter((_, i) => i !== index);
    // Re-key options
    const reKeyed = newOptions.map((opt, i) => ({
      ...opt,
      key: String.fromCharCode(65 + i),
    }));
    setQuizOptions(reKeyed);
    // Clear answer if it was the removed option
    if (quizAnswer === quizOptions[index].key) {
      setQuizAnswer("");
    } else {
      // Update answer key if needed
      const oldKey = quizOptions[index].key;
      const answerIndex = quizOptions.findIndex(o => o.key === quizAnswer);
      if (answerIndex > index) {
        setQuizAnswer(String.fromCharCode(65 + answerIndex - 1));
      }
    }
  };

  const updateQuizOption = (index: number, text: string) => {
    const newOptions = [...quizOptions];
    newOptions[index] = { ...newOptions[index], text };
    setQuizOptions(newOptions);
  };

  const buildQuizData = (): ReelQuiz | null => {
    if (!includeQuiz) return null;
    if (!quizQuestion.trim()) return null;
    if (!quizAnswer) return null;
    if (quizOptions.some(opt => !opt.text.trim())) return null;

    return {
      question: quizQuestion.trim(),
      options: quizOptions.map(opt => ({ key: opt.key, text: opt.text.trim() })),
      answer: quizAnswer,
      explanation: quizExplanation.trim() || undefined,
      timestamp_seconds: quizTimestamp ? parseFloat(quizTimestamp) : undefined,
    };
  };

  const resetQuizForm = () => {
    setIncludeQuiz(false);
    setQuizQuestion("");
    setQuizOptions([
      { key: "A", text: "" },
      { key: "B", text: "" },
    ]);
    setQuizAnswer("");
    setQuizExplanation("");
    setQuizTimestamp("");
  };

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
    if (!driveUrl.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter a Google Drive share URL",
        variant: "destructive",
      });
      return;
    }

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

      // Call backend API to import from Drive
      const response = await api.reels.importFromDrive({
        driveUrl: driveUrl.trim(),
        userId: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        folderName: folderName.trim() || undefined,
        tags: hashtags.length > 0 ? hashtags : undefined,
      });

      if (response.success) {
        // Refresh reels from Supabase
        await useSocialStore.getState().loadReelsFromSupabase();

        toast({
          title: "Success!",
          description: "Your reel has been imported from Google Drive.",
        });

        // Reset form
        setTitle("");
        setDescription("");
        setDriveUrl("");
        setFolderName("");
        setHashtags([]);
        setHashtagInput("");
        onClose();
      } else {
        throw new Error(response.message || "Import failed");
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import from Google Drive. Make sure the file is publicly shared.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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

    // Validate quiz if enabled
    if (includeQuiz) {
      if (!quizQuestion.trim()) {
        toast({
          title: "Missing quiz question",
          description: "Please enter a question for the quiz",
          variant: "destructive",
        });
        return;
      }
      if (!quizAnswer) {
        toast({
          title: "Missing correct answer",
          description: "Please select the correct answer for the quiz",
          variant: "destructive",
        });
        return;
      }
      if (quizOptions.some(opt => !opt.text.trim())) {
        toast({
          title: "Incomplete quiz options",
          description: "Please fill in all quiz options",
          variant: "destructive",
        });
        return;
      }
    }

    setIsUploading(true);
    const quizData = buildQuizData();

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
        author_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email,
        folder_name: folderName.trim() || null,
        tags: hashtags,
        likes: 0,
        comments: 0,
        quiz: quizData,
        // quiz_embedding will be generated by backend if needed
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
          author: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "User",
          authorUserId: user.id,
          tags: hashtags,
          quiz: quizData || undefined,
        };

        useSocialStore.setState({ reels: [...reels, newReel] });
        useSocialStore.setState({ reels: [newReel, ...reels] });
      } else {
        // Refresh reels from Supabase after successful upload
        await useSocialStore.getState().loadReelsFromSupabase();
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
      resetQuizForm();
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
                Select a video from your Google Drive
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={openPicker}
                disabled={isUploading || isPickerLoading || !isPickerReady}
              >
                <HardDrive className="mr-2 h-4 w-4" />
                {isPickerLoading ? "Loading..." : "Browse Google Drive"}
              </Button>
              {selectedDriveFile && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium">{selectedDriveFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ready to import</p>
                </div>
              )}
            </div>
          )}

          {/* Quiz Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Include Quiz</label>
              </div>
              <Button
                type="button"
                variant={includeQuiz ? "default" : "outline"}
                size="sm"
                onClick={() => setIncludeQuiz(!includeQuiz)}
                disabled={isUploading}
              >
                {includeQuiz ? "Enabled" : "Add Quiz"}
              </Button>
            </div>

            {includeQuiz && (
              <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                {/* Quiz Question */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Question *</label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your quiz question"
                    value={quizQuestion}
                    onChange={(e) => setQuizQuestion(e.target.value)}
                    disabled={isUploading}
                    rows={2}
                  />
                </div>

                {/* Quiz Options */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Options *</label>
                  <div className="space-y-2">
                    {quizOptions.map((option, index) => (
                      <div key={option.key} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuizAnswer(option.key)}
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors",
                            quizAnswer === option.key
                              ? "bg-green-500 border-green-500 text-white"
                              : "bg-background border-muted-foreground/30 hover:border-primary"
                          )}
                          disabled={isUploading}
                          title={quizAnswer === option.key ? "Correct answer" : "Click to set as correct answer"}
                        >
                          {option.key}
                        </button>
                        <Input
                          placeholder={`Option ${option.key}`}
                          value={option.text}
                          onChange={(e) => updateQuizOption(index, e.target.value)}
                          disabled={isUploading}
                          className="flex-1"
                        />
                        {quizOptions.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQuizOption(index)}
                            disabled={isUploading}
                            className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {quizOptions.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addQuizOption}
                      disabled={isUploading}
                      className="w-full mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Click the letter button to mark the correct answer (green = correct)
                  </p>
                </div>

                {/* Quiz Explanation */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Explanation (Optional)</label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Explain why the answer is correct (shown as hint on wrong answer)"
                    value={quizExplanation}
                    onChange={(e) => setQuizExplanation(e.target.value)}
                    disabled={isUploading}
                    rows={2}
                  />
                </div>

                {/* Quiz Timestamp */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quiz Trigger Time (seconds)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 15 (leave empty for 50% of video)"
                    value={quizTimestamp}
                    onChange={(e) => setQuizTimestamp(e.target.value)}
                    disabled={isUploading}
                    min="0"
                    step="0.5"
                  />
                  <p className="text-xs text-muted-foreground">
                    When should the quiz appear? Leave empty to show at 50% of video duration.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <Button
            className="w-full mt-6"
            onClick={uploadMode === "drive" ? handleGoogleDriveImport : handleUpload}
            disabled={isUploading || !title.trim() || (uploadMode === "url" && !videoUrl) || (uploadMode === "file" && !file) || (uploadMode === "drive" && !driveUrl)}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadMode === "drive" ? "Importing..." : "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {uploadMode === "drive" ? "Import from Drive" : "Upload Reel"}
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
