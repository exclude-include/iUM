"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UploadModal } from "@/components/reels/UploadModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { Upload, Play, Heart, Eye, Loader2 } from "lucide-react";

interface Reel {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  views: number;
  likes: number;
  created_at: string;
}

export default function ReelsPage() {
  const { toast } = useToast();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reels, setReels] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    fetchReels();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);
  };

  const fetchReels = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/reels/list?limit=20&offset=0`);

      if (!response.ok) {
        throw new Error("Failed to fetch reels");
      }

      const data = await response.json();
      setReels(data.reels || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load reels. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = () => {
    // Refresh the reels list after successful upload
    fetchReels();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Reels</h1>
              <p className="text-muted-foreground mt-1">
                Learn through short educational videos
              </p>
            </div>
            <Button
              onClick={() => {
                if (!currentUser) {
                  toast({
                    title: "Sign in required",
                    description: "Please sign in to upload reels.",
                    variant: "destructive",
                  });
                  return;
                }
                setIsUploadModalOpen(true);
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Reel
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reels.length === 0 ? (
          <div className="text-center py-12">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reels yet</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to upload a learning video!
            </p>
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Your First Reel
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reels.map((reel) => (
              <Card key={reel.id} className="overflow-hidden group">
                {/* Video Thumbnail/Player */}
                <div className="relative aspect-[9/16] bg-muted">
                  <video
                    src={reel.video_url}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                  {reel.thumbnail_url && (
                    <img
                      src={reel.thumbnail_url}
                      alt={reel.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:opacity-0 transition-opacity"
                    />
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="backdrop-blur-sm">
                      <Play className="h-3 w-3 mr-1" />
                      {reel.duration ? `${Math.floor(reel.duration)}s` : "Video"}
                    </Badge>
                  </div>
                </div>

                {/* Reel Info */}
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-2 mb-2">
                    {reel.title}
                  </h3>
                  {reel.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {reel.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(reel.created_at)}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {reel.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {reel.likes}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
