"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { QuizOverlay } from "./QuizOverlay";
import { useFeedStore } from "./useFeedStore";

/** Dark color palette for reel backgrounds (darker, muted tones) */
const DARK_REEL_PALETTE = [
  "#2D2D3A", // Dark slate blue-gray
  "#2A2A35", // Dark navy-gray
  "#2F2F3D", // Dark purple-gray
  "#2B2B38", // Dark blue-gray
  "#2E2E3B", // Dark indigo-gray
  "#2C2C39", // Dark gray-blue
  "#2A2A37", // Dark charcoal-blue
  "#2D2D3A", // Dark slate
];

/**
 * Get a consistent dark color for a reel based on its ID.
 * If reel.color exists and is already dark, use it; otherwise pick from dark palette.
 */
function getReelBackgroundColor(reelId: string, existingColor?: string): string {
  if (existingColor) {
    // Check if color is already dark (low lightness)
    let hex = existingColor.replace("#", "");
    // Handle 3-digit hex (#FFF -> #FFFFFF)
    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      // Calculate lightness (0-1) using relative luminance formula
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const lightness = (max + min) / 2;
      // If lightness < 0.4 (dark), use existing color; otherwise use dark palette
      if (lightness < 0.4) {
        return existingColor;
      }
    }
  }
  // Use reel ID to deterministically pick a dark color (same reel = same color)
  const hash = reelId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DARK_REEL_PALETTE[hash % DARK_REEL_PALETTE.length];
}
// import type { Reel } from "@/types"; // Removed invalid import, using local ReelType

// Temporary interface until we verify exact path of Reel type. 
// Based on ReelPlayer usage:
interface ReelType {
  id: string;
  videoUrl?: string; // or null/undefined
  title: string;
  description?: string;
  authorUserId?: string;
  authorAvatar?: string;
  author: string;
  folderName?: string;
  likes: number;
  comments: number;
  tags?: string[];
  color?: string; // For placeholder
  duration?: number;
  quiz?: any;
  similarity?: number;
}

interface ReelSlideProps {
  reel: ReelType;
  isActive: boolean;
  isMuted: boolean;
  isLiked: boolean;
  isBookmarked: boolean;
  showQuiz: boolean;
  quizCompleted: boolean;
  elapsedTime: number; // For placeholder timer display
  showMoreMenu: boolean;
  canPlay?: boolean; // Global Lock Prop
  
  // Callbacks
  onVideoRef: (el: HTMLVideoElement | null, reelId: string) => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onVideoClick: () => void;
  
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onDelete: () => void;
  toggleMoreMenu: () => void;
  setShowMoreMenu: (show: boolean) => void;
  
  onQuizCorrect: () => void;
  onQuizClose: () => void;
}

const slideTransition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const };
const slideVariants = {
  initial: (direction: number) => ({
    y: direction > 0 ? "100%" : "-100%",
  }),
  animate: (direction: number) => ({
    y: 0,
    transition: slideTransition,
  }),
  exit: (direction: number) => ({
    y: direction > 0 ? "-100%" : "100%",
    transition: slideTransition,
  }),
};

export function ReelSlide({
  reel,
  isActive,
  isMuted,
  isLiked,
  isBookmarked,
  showQuiz,
  quizCompleted,
  elapsedTime,
  showMoreMenu,
  onVideoRef,
  onTimeUpdate,
  onLoadedMetadata,
  onVideoClick,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onDelete,
  toggleMoreMenu,
  setShowMoreMenu,
  onQuizCorrect,
  onQuizClose,
  canPlay = true, // Default to true for backward compatibility
}: ReelSlideProps) {
  // Fix for AnimatePresence keeping exiting slides active:
  // Check global store to see if this reel is TRULY the active one.
  const currentReel = useFeedStore(state => state.feedBuffer[state.currentBufferIndex]);
  const isActuallyActive = currentReel?.id === reel.id;

  const [authorAvatarFallback, setAuthorAvatarFallback] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);

  // Handle video ref assignment
  const setRef = useCallback((el: HTMLVideoElement | null) => {
    internalVideoRef.current = el;
    onVideoRef(el, reel.id);
  }, [onVideoRef, reel.id]);

  // Sync muted state
  useEffect(() => {
    if (internalVideoRef.current) {
      internalVideoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Handle video auto-play when active
  useEffect(() => {
    const video = internalVideoRef.current;
    if (!video) return;

    // Use isActuallyActive (from store) combined with isActive (prop) and canPlay (Global Lock)
    // This ensures exiting slides stop playing AND duplicate players don't play.
    if (isActive && isActuallyActive && canPlay && !showQuiz) {
       // Try to play if active
       video.play().catch(() => { /* ignore */ });
    } else {
       video.pause();
    }
  }, [isActive, isActuallyActive, canPlay, showQuiz]);

  // Author info fetch (copied from ReelPlayer)
  useEffect(() => {
    if (!reel.authorUserId) {
      setAuthorAvatarFallback(null);
      setAuthorName(null);
      return;
    }
    let cancelled = false;
    setAuthorAvatarFallback(reel.authorAvatar || null);
    setAuthorName(null);

    import("@/lib/api").then(({ api }) => {
      api.users.getUserMetadata(reel.authorUserId!).then((meta) => {
        if (!cancelled) {
          if (meta?.avatar_url && !reel.authorAvatar) {
            setAuthorAvatarFallback(meta.avatar_url);
          }
          if (meta?.name) {
            setAuthorName(meta.name);
          }
        }
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [reel.id, reel.authorUserId, reel.authorAvatar]);

  return (
    <>
      {/* Video/Content Background */}
      <div className="absolute inset-0 bg-black" onClick={onVideoClick}>
        {reel.videoUrl ? (
          <video
            ref={setRef}
            src={reel.videoUrl}
            className="h-full w-full object-cover"
            loop={!reel.quiz || quizCompleted}
            playsInline
            muted={isMuted} // React prop for initial render
            preload="auto"
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{
              backgroundColor: getReelBackgroundColor(reel.id, reel.color),
            }}
          >
            {/* Centered title for video-less reels */}
            <div className="text-center px-8 max-w-2xl">
              <h2 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
                {reel.title}
              </h2>
              {reel.description && (
                <p className="text-lg text-white/90 opacity-90">
                  {reel.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Left: Author Info */}
      <div className="absolute bottom-20 left-4 z-20 text-white max-w-[60%]">
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="h-8 w-8 border-2 border-white/30">
            <AvatarImage
              src={reel.authorAvatar || authorAvatarFallback || undefined}
              alt={authorName || reel.author}
            />
            <AvatarFallback className="bg-white/20 text-xs font-bold">
              {(authorName || reel.author).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col text-white drop-shadow-md">
            <p className="text-sm font-semibold">@{authorName || reel.author}</p>
            <p className="text-xs text-white/80">{reel.folderName}</p>
          </div>
        </div>
        <p className="text-sm font-medium mb-1">{reel.title}</p>
        <p className="text-xs text-white/70 line-clamp-2 mb-2">
          {reel.description || ""}
        </p>

        {/* Hashtags */}
        {reel.tags && reel.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reel.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium text-white/90 hover:text-white cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Right: Action Bar */}
      <div className="absolute bottom-20 right-4 z-20 flex flex-col gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onLike}
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
          <span className="text-xs text-white font-medium">
            {reel.likes}
          </span>
        </motion.button>

        <button
          onClick={onComment}
          className="flex flex-col items-center gap-1"
        >
          <MessageCircle className="h-7 w-7 text-white" />
          <span className="text-xs text-white font-medium">
            {reel.comments}
          </span>
        </button>

        <button
          onClick={onShare}
          className="flex flex-col items-center gap-1"
        >
          <Share2 className="h-7 w-7 text-white" />
        </button>

        <button
          onClick={onBookmark}
          className="flex flex-col items-center gap-1"
        >
          <Bookmark
            className={cn(
              "h-7 w-7",
              isBookmarked ? "fill-white text-white" : "text-white"
            )}
          />
        </button>

        <div className="relative flex flex-col items-center gap-1">
          <button
            onClick={toggleMoreMenu}
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
                  onClick={onDelete}
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

      {/* Quiz Overlay */}
      <AnimatePresence>
        {showQuiz && reel.quiz && (
          <QuizOverlay
            quiz={reel.quiz}
            onCorrectAnswer={onQuizCorrect}
            onClose={onQuizClose}
          />
        )}
      </AnimatePresence>

      {/* Quiz Badge (shows if reel has quiz) */}
      {reel.quiz && !quizCompleted && !showQuiz && (
        <div className="absolute top-32 left-4 z-20">
          <div className="rounded-full bg-primary/80 backdrop-blur-sm px-3 py-1 text-xs text-white font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Quiz ahead
          </div>
        </div>
      )}

      {/* Quiz Completed Badge */}
      {reel.quiz && quizCompleted && (
        <div className="absolute top-32 left-4 z-20">
          <div className="rounded-full bg-green-500/80 backdrop-blur-sm px-3 py-1 text-xs text-white font-medium">
            ✓ Quiz completed
          </div>
        </div>
      )}
    </>
  );
}
