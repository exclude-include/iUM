"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSocialStore, fetchReelsFromSupabase } from "./useSocialStore";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ReelPlayer() {
  const { toast } = useToast();
  const supabase = createClient();
  const store = useSocialStore();
  const {
    currentReelIndex,
    likedReels,
    bookmarkedReels,
    activeTab,
    nextReel,
    prevReel,
    toggleLike,
    toggleBookmark,
    setActiveTab,
  } = store;
  
  const currentReel = store.getCurrentReel();
  const filteredReels = store.getFilteredReels();
  const [isLoadingReels, setIsLoadingReels] = useState(false);

  // Fetch reels from Supabase on mount and when needed
  useEffect(() => {
    const loadReels = async () => {
      setIsLoadingReels(true);
      try {
        const supabaseReels = await fetchReelsFromSupabase(supabase);
        
        // Merge with existing reels (or replace if you want only Supabase data)
        if (supabaseReels.length > 0) {
          useSocialStore.setState({ reels: supabaseReels });
        }
      } catch (error) {
        console.error("Failed to load reels:", error);
      } finally {
        setIsLoadingReels(false);
      }
    };

    loadReels();
  }, [supabase]);

  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Update like/bookmark state when reel changes
  useEffect(() => {
    if (currentReel) {
      setIsLiked(likedReels.has(currentReel.id));
      setIsBookmarked(bookmarkedReels.has(currentReel.id));
    }
  }, [currentReel, likedReels, bookmarkedReels]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        prevReel();
      } else if (e.key === "ArrowDown") {
        nextReel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextReel, prevReel]);

  if (isLoadingReels) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading reels...</p>
        </div>
      </div>
    );
  }

  if (!currentReel) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-muted-foreground">No reels available</p>
          <p className="text-sm text-muted-foreground mt-2">
            Click "New Post" to upload your first reel
          </p>
        </div>
      </div>
    );
  }

  const handleLike = () => {
    toggleLike(currentReel.id);
    setIsLiked(!isLiked);
  };

  const handleComment = () => {
    toast({
      title: "Comments",
      description: "Comments section coming soon!",
    });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Share link copied to clipboard!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleBookmark = () => {
    toggleBookmark(currentReel.id);
    setIsBookmarked(!isBookmarked);
  };

  const handleMore = () => {
    toast({
      title: "More Options",
      description: "Additional options coming soon!",
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-muted/30">
      {/* Tabs */}
      <div className="absolute top-4 z-20 flex gap-1 rounded-full bg-background/80 backdrop-blur-sm border p-1">
        {(["reels", "quiz", "discuss"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Container (Mobile Frame) */}
      <div className="relative h-[90vh] max-h-[800px] w-full max-w-[400px] rounded-2xl bg-background shadow-2xl overflow-hidden">
        {/* Video/Content Background */}
        {currentReel.videoUrl ? (
          <video
            src={currentReel.videoUrl}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: currentReel.color || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
          >
            {/* Placeholder content */}
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-white/80">
                <p className="text-2xl font-bold mb-2">{currentReel.title}</p>
                <p className="text-sm">{currentReel.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Arrows */}
        {currentReelIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80"
            onClick={prevReel}
          >
            <ChevronUp className="h-6 w-6" />
          </Button>
        )}

        {currentReelIndex < filteredReels.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80"
            onClick={nextReel}
          >
            <ChevronDown className="h-6 w-6" />
          </Button>
        )}

        {/* Bottom Left: Author Info */}
        <div className="absolute bottom-20 left-4 z-20 text-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-xs font-bold">
                {currentReel.author.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold">@{currentReel.author}</p>
              <p className="text-xs text-white/80">{currentReel.folderName}</p>
            </div>
          </div>
          <p className="text-sm font-medium mb-1">{currentReel.title}</p>
          <p className="text-xs text-white/70 line-clamp-2">{currentReel.description}</p>
        </div>

        {/* Bottom Right: Action Bar */}
        <div className="absolute bottom-20 right-4 z-20 flex flex-col gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleLike}
            className="flex flex-col items-center gap-1"
          >
            <motion.div
              animate={{ scale: isLiked ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <Heart
                className={cn(
                  "h-7 w-7",
                  isLiked ? "fill-red-500 text-red-500" : "text-white"
                )}
              />
            </motion.div>
            <span className="text-xs text-white font-medium">{currentReel.likes}</span>
          </motion.button>

          <button onClick={handleComment} className="flex flex-col items-center gap-1">
            <MessageCircle className="h-7 w-7 text-white" />
            <span className="text-xs text-white font-medium">{currentReel.comments}</span>
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-1">
            <Share2 className="h-7 w-7 text-white" />
          </button>

          <button onClick={handleBookmark} className="flex flex-col items-center gap-1">
            <Bookmark
              className={cn(
                "h-7 w-7",
                isBookmarked ? "fill-white text-white" : "text-white"
              )}
            />
          </button>

          <button onClick={handleMore} className="flex flex-col items-center gap-1">
            <MoreVertical className="h-7 w-7 text-white" />
          </button>
        </div>

        {/* Reel Counter */}
        <div className="absolute top-20 right-4 z-20">
          <div className="rounded-full bg-background/50 backdrop-blur-sm px-3 py-1 text-xs text-white">
            {currentReelIndex + 1} / {filteredReels.length}
          </div>
        </div>
      </div>
    </div>
  );
}

