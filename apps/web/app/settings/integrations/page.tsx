"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { 
  HardDrive, 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  FileText,
  File,
  FileCode,
  FileImage,
} from "lucide-react";

interface DriveFile {
  id: string;
  google_file_id: string;
  name: string;
  mime_type: string;
  size?: number;
  web_view_link?: string;
  synced_at: string;
  is_processed: boolean;
}

interface GoogleIntegration {
  id: string;
  user_id: string;
  access_token: string;
  created_at: string;
  updated_at: string;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    setIsCheckingConnection(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "Please sign in to access integrations.",
          variant: "destructive",
        });
        return;
      }

      setUserId(user.id);

      // Check if Google integration exists
      const { data, error } = await supabase
        .from("google_integrations")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setIsConnected(!!data);

      // If connected, fetch files
      if (data) {
        await fetchDriveFiles(user.id);
      }
    } catch (error: any) {
      console.error("Error checking connection:", error);
      toast({
        title: "Error",
        description: "Failed to check connection status.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const fetchDriveFiles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("drive_files")
        .select("*")
        .eq("user_id", userId)
        .order("synced_at", { ascending: false });

      if (error) throw error;

      setDriveFiles(data || []);
    } catch (error: any) {
      console.error("Error fetching drive files:", error);
      toast({
        title: "Error",
        description: "Failed to fetch Drive files.",
        variant: "destructive",
      });
    }
  };

  const handleConnect = () => {
    if (!userId) {
      toast({
        title: "Not authenticated",
        description: "Please sign in first.",
        variant: "destructive",
      });
      return;
    }

    // Redirect to backend OAuth endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const authUrl = `${apiUrl}/api/integrations/google/login?user_id=${userId}`;
    
    window.location.href = authUrl;
  };

  const handleSync = async () => {
    if (!userId) {
      toast({
        title: "Not authenticated",
        description: "Please sign in first.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiUrl}/api/integrations/drive/sync?user_id=${userId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ folder_id: null }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Sync failed");
      }

      const data = await response.json();

      toast({
        title: "Sync complete!",
        description: `Successfully synced ${data.files_synced} files from Google Drive.`,
      });

      // Refresh file list
      await fetchDriveFiles(userId);
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync Drive files.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4" />;
    if (mimeType.includes("document")) return <FileText className="h-4 w-4" />;
    if (mimeType.includes("presentation")) return <FileCode className="h-4 w-4" />;
    if (mimeType.includes("image")) return <FileImage className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect external services to enhance your learning experience
          </p>
        </div>

        {/* Google Drive Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <HardDrive className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Google Drive</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Sync your documents for AI-powered learning
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {isCheckingConnection ? (
                    <Badge variant="outline">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Checking...
                    </Badge>
                  ) : isConnected ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <XCircle className="h-3 w-3 mr-1" />
                      Disconnected
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {isConnected ? (
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  variant="outline"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={isCheckingConnection}>
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* File List */}
          {isConnected && (
            <div className="mt-6 border-t pt-6">
              <h3 className="font-semibold mb-4">Synced Files ({driveFiles.length})</h3>
              
              {driveFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No files synced yet. Click "Sync Now" to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="text-muted-foreground">
                          {getFileIcon(file.mime_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} • Synced{" "}
                            {new Date(file.synced_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={file.is_processed ? "success" : "outline"}
                          className="text-xs"
                        >
                          {file.is_processed ? "Ready for AI" : "Processing"}
                        </Badge>
                        {file.web_view_link && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(file.web_view_link, "_blank")}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
