"use client";

import { useState, useRef } from "react";
import { FileText, Globe, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
}

export function SourcesPanel() {
  const [activeTab, setActiveTab] = useState<"sources" | "generated" | "quick-tools">("sources");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["application/pdf", "text/plain", "text/markdown"];
    const validExtensions = ["pdf", "txt", "md", "markdown"];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExtension || "")
    ) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or text file (.pdf, .txt, .md)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    // Show uploading toast
    toast({
      title: "Uploading...",
      description: `Processing ${file.name}`,
    });

    try {
      const response = await api.ingest.uploadFile(file);

      // Add file to local state
      const newFile: UploadedFile = {
        id: response.document_ids[0] || `file-${Date.now()}`,
        name: file.name,
        uploadedAt: new Date().toISOString(),
      };

      setUploadedFiles((prev) => [newFile, ...prev]);

      // Show success toast
      toast({
        title: "File processed successfully",
        description: `${file.name} has been processed and added to your knowledge base. ${response.chunks_created} chunks created.`,
      });
    } catch (error) {
      // Show error toast
      toast({
        title: "Upload failed",
        description: error instanceof Error 
          ? error.message 
          : "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="border-t bg-muted/30">
      {/* Tabs */}
      <div className="flex border-b bg-background">
        <button
          onClick={() => setActiveTab("sources")}
          className={cn(
            "px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2",
            activeTab === "sources"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Sources
        </button>
        <button
          onClick={() => setActiveTab("generated")}
          className={cn(
            "px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2",
            activeTab === "generated"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Generated
        </button>
        <button
          onClick={() => setActiveTab("quick-tools")}
          className={cn(
            "px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2",
            activeTab === "quick-tools"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Quick tools
        </button>
      </div>

      {/* Content */}
      {activeTab === "sources" && (
        <div className="p-3 space-y-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-1 mb-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs"
                >
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate" title={file.name}>
                    {file.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upload buttons */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto py-2 text-xs border"
            onClick={handleAddClick}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span>Local files</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto py-2 text-xs border"
            onClick={() => {
              // TODO: Implement web sources
              toast({
                title: "Coming soon",
                description: "Web sources feature will be available soon.",
              });
            }}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Web Sources</span>
          </Button>
        </div>
      )}

      {activeTab === "generated" && (
        <div className="p-3">
          <p className="text-xs text-muted-foreground">
            Generated content will appear here
          </p>
        </div>
      )}

      {activeTab === "quick-tools" && (
        <div className="p-3">
          <p className="text-xs text-muted-foreground">
            Quick tools will appear here
          </p>
        </div>
      )}

      {/* Add Button */}
      <div className="border-t p-2 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleAddClick}
          disabled={isUploading}
          title="Upload file"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
