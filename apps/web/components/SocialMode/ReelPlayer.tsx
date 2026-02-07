"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSocialStore } from "./useSocialStore";
import { cn } from "@/lib/utils";

const WHEEL_THRESHOLD = 40;

export function ReelPlayer() {
  const { toast } = useToast();
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
    deleteReel,
    setActiveTab,
  } = store;
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const wheelAccumRef = useRef(0);
  
  const currentReel = store.getCurrentReel();
  const filteredReels = store.getFilteredReels();

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

  // Wheel/touchpad scroll for reels
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const canGoNext = currentReelIndex < filteredReels.length - 1;
      const canGoPrev = currentReelIndex > 0;
      if (!canGoNext && !canGoPrev) return;

      wheelAccumRef.current += e.deltaY;
      if (Math.abs(wheelAccumRef.current) >= WHEEL_THRESHOLD) {
        if (wheelAccumRef.current > 0 && canGoNext) {
          e.preventDefault();
          nextReel();
        } else if (wheelAccumRef.current < 0 && canGoPrev) {
          e.preventDefault();
          prevReel();
        }
        wheelAccumRef.current = 0;
      }
    },
    [nextReel, prevReel, currentReelIndex, filteredReels.length]
  );

  // Reset wheel accumulation when reel changes
  useEffect(() => {
    wheelAccumRef.current = 0;
  }, [currentReelIndex]);

  if (!currentReel) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-muted-foreground">No reels available</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create folders in Hard Mode to see content
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

  const handleDelete = () => {
    if (!currentReel) return;
    deleteReel(currentReel.id);
    setShowMoreMenu(false);
    toast({
      title: "Reel deleted",
      description: `"${currentReel.title}" has been removed.`,
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

      {/* Main Container (Mobile Frame) - wheel for touchpad scroll */}
      <div
        className="relative h-[90vh] max-h-[800px] w-full max-w-[400px] rounded-2xl bg-background shadow-2xl overflow-hidden"
        onWheel={handleWheel}
      >
        {/* Video/Content Background */}
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

          <div className="relative flex flex-col items-center gap-1">
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className="flex flex-col items-center gap-1"
            >
              <MoreVertical className="h-7 w-7 text-white" />
            </button>
            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  aria-hidden
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="absolute bottom-full right-0 z-40 mb-2 min-w-[140px] rounded-lg border bg-background py-1 shadow-lg">
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete reel
                  </button>
                </div>
              </>
            )}
          </div>
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

