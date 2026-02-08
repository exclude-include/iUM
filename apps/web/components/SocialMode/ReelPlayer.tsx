import { ReelSlide } from "./ReelSlide";

// ... (other imports remain, but remove unused ones like Heart, MessageCircle as they are now in ReelSlide)
// To be safe, I will keep imports for now or clean them up in a second pass if TypeScript complains, 
// but for replace_file_content I need to be precise. 
// However, since I am replacing the whole file content, I can just provide the clean file. 
// Wait, replacing 700 lines with `replace_file_content` is risky if I miss something.
// I should probably use `replace_file_content` to replace the `return (...)` block and the imports.

// Let's replace the imports first to include ReelSlide and remove unused icons.
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFeedStore } from "./useFeedStore";
import { useSocialStore } from "./useSocialStore";
import { CommentDrawer } from "./CommentDrawer";
import { cn } from "@/lib/utils";
// Removed duplicate ReelSlide import

const WHEEL_THRESHOLD = 40;
const WHEEL_COOLDOWN_MS = 450; 

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

interface ReelPlayerProps {
  initialReelId?: string;
}

export function ReelPlayer({ initialReelId }: ReelPlayerProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const feedStore = useFeedStore();
  const {
    getCurrentReel,
    nextReel,
    prevReel,
    loadInitialFeed,
    navigateToReel,
    feedBuffer,
    currentBufferIndex,
    activePlayerId,
    setActivePlayerId,
  } = feedStore;

  // Generate a unique ID for this player instance
  const [playerId] = useState(() => Math.random().toString(36).substring(7));

  // Register as the active player on mount/focus
  useEffect(() => {
    if (setActivePlayerId) {
        setActivePlayerId(playerId);
        console.log(`ReelPlayer mounted/active: ${playerId}`);
    }
    return () => {
      // Optional cleanup
    };
  }, [playerId, setActivePlayerId]);
  
  const socialStore = useSocialStore();
  const {
    likedReels,
    bookmarkedReels,
    toggleLike,
    toggleBookmark,
    deleteReel,
  } = socialStore;
  
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCommentDrawer, setShowCommentDrawer] = useState(false);
  const wheelAccumRef = useRef(0);
  const lastWheelNavigateAt = useRef(0);
  const slideDirectionRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNextReel = useCallback(() => {
    slideDirectionRef.current = 1;
    nextReel();
  }, [nextReel]);

  const handlePrevReel = useCallback(() => {
    slideDirectionRef.current = -1;
    prevReel();
  }, [prevReel]);

  const currentReel = getCurrentReel();

  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const quizTriggeredRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Callback to set video ref safely
  // This prevents the race condition where the exiting slide clears the ref of the entering slide
  const handleVideoRef = useCallback((el: HTMLVideoElement | null, reelId: string) => {
    // Only update ref if the element belongs to the current reel
    // If el is null, we only clear if the current reel is the one unmounting (which shouldn't happen while active)
    // Actually, simpler: just set it if IDs match.
    // If a new slide mounts, it calls with (el, newId).
    // If matching currentReel.id, we set it.
    if (currentReel && reelId === currentReel.id) {
        if (el) {
            videoRef.current = el;
            // Also sync mute state immediately
            el.muted = isMuted;
        } else {
            // el is null (unmounting).
            // Only clear if we are still on this reel?
            // If we navigated away, currentReel might have changed already.
            // If currentReel changed, we DON'T want to clear, because the NEW slide might have already set it.
            // So: Only clear if reelId is STILL the current reel.
            // But wait, if we are transitioning, currentReel IS the new one.
            // The OLD slide unmounts with (null, oldId).
            // oldId != currentReel.id (newId).
            // So we WON'T clear it. Correct!
            // The NEW slide mounts with (el, newId).
            // newId == currentReel.id.
            // So we SET it. Correct!
            // Video ref is preserved!
            // Note: need to handle case where we unmount the whole player?
            // If player unmounts, currentReel might be null or whatever, ref doesn't matter.
        }
    }
  }, [currentReel, isMuted]);

  // Update like/bookmark state when reel changes
  useEffect(() => {
    if (currentReel) {
      setIsLiked(likedReels.has(currentReel.id));
      setIsBookmarked(bookmarkedReels.has(currentReel.id));
      setShowQuiz(false);
      setQuizCompleted(false);
      setElapsedTime(0);
      quizTriggeredRef.current = false;
      setShowMoreMenu(false); // Close menu on change
    }
  }, [currentReel, likedReels, bookmarkedReels]);

  // Load initial feed on mount
  useEffect(() => {
    if (initialReelId) {
      navigateToReel(initialReelId);
    } else if (feedBuffer.length === 0) {
      loadInitialFeed();
    }
  }, [initialReelId, feedBuffer.length, loadInitialFeed, navigateToReel]);

  // Sync URL with current reel (debounced)
  useEffect(() => {
    if (!currentReel || !pathname) return;
    
    const isReelPage = pathname.startsWith("/soft/reels/");
    const isFeedPage = pathname === "/soft";
    
    if (!isReelPage && !isFeedPage) return;

    const timeoutId = setTimeout(() => {
      const targetUrl = `/soft/reels/${currentReel.id}`;
      window.history.replaceState(null, "", targetUrl);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentReel, pathname]);

  // Sync muted state with video element when reel changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [currentReel, isMuted]);

  // Calculate quiz trigger time
  const getQuizTriggerTime = useCallback(() => {
    if (!currentReel?.quiz) return null;
    if (currentReel.quiz.timestamp_seconds !== undefined) {
      return currentReel.quiz.timestamp_seconds;
    }
    const duration = currentReel.duration || videoDuration;
    if (duration > 0) {
      return duration * 0.5;
    }
    return null;
  }, [currentReel, videoDuration]);

  // Handle video time update for quiz trigger
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !currentReel?.quiz || quizCompleted || quizTriggeredRef.current) {
      return;
    }

    const triggerTime = getQuizTriggerTime();
    if (triggerTime === null) return;

    const currentTime = videoRef.current.currentTime;

    if (currentTime >= triggerTime) {
      quizTriggeredRef.current = true;
      videoRef.current.pause();
      setIsPlaying(false);
      setShowQuiz(true);
      console.log("🧪 [TEST] Quiz triggered at", currentTime, "seconds");
    }
  }, [currentReel, quizCompleted, getQuizTriggerTime]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  }, []);

  // Timer for placeholder (non-video) reels
  useEffect(() => {
    if (!currentReel || currentReel.videoUrl || !currentReel.quiz || quizCompleted || quizTriggeredRef.current) {
      return;
    }

    if (!isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const triggerTime = getQuizTriggerTime();
    if (triggerTime === null) return;

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 0.1;
        if (newTime >= triggerTime && !quizTriggeredRef.current) {
          quizTriggeredRef.current = true;
          setIsPlaying(false);
          setShowQuiz(true);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
        return newTime;
      });
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentReel, isPlaying, quizCompleted, getQuizTriggerTime]);

  const handleQuizCorrect = useCallback(() => {
    setQuizCompleted(true);
    setShowQuiz(false);

    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    } else {
      setIsPlaying(true);
    }

    toast({
      title: "Great job!",
      description: "You answered correctly. Keep learning!",
    });
  }, [toast]);

  const handleQuizClose = useCallback(() => {
    setShowQuiz(false);
  }, []);

  // Auto-play video when reel changes - DELEGATED TO REELSLIDE, 
  // BUT we keep the event listeners logic? 
  // No, ReelSlide handles basic play. 
  // However, we need to track isPlaying state for the PAUSE/PLAY toggle.
  // ReelSlide calls onVideoClick.
  // We need to keep isPlaying state in sync?
  // Actually, ReelSlide has an effect to play when active.
  // But controls are here.
  
  // We should listen to 'play' and 'pause' events from the video to update isPlaying.
  // ReelSlide doesn't expose those events?
  // We can add event listeners in handleVideoRef?
  // Or verify if we can add them to the video element directly.
  // Yes, if we have videoRef.current, we can add listeners.
  // BUT videoRef changes.
  
  // Let's rely on standard state updates.
  // When ReelSlide mounts, it plays.
  // We should set isPlaying(true) when moving to next reel.
  useEffect(() => {
     setIsPlaying(true);
  }, [currentReel]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        handlePrevReel();
      } else if (e.key === "ArrowDown") {
        handleNextReel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNextReel, handlePrevReel]);

  // Wheel/touchpad scroll
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const canGoNext = currentBufferIndex < feedBuffer.length - 1;
      const canGoPrev = currentBufferIndex > 0;
      if (!canGoNext && !canGoPrev) return;

      const now = Date.now();
      if (now - lastWheelNavigateAt.current < WHEEL_COOLDOWN_MS) {
        e.preventDefault();
        return;
      }

      wheelAccumRef.current += e.deltaY;
      if (Math.abs(wheelAccumRef.current) >= WHEEL_THRESHOLD) {
        if (wheelAccumRef.current > 0 && canGoNext) {
          e.preventDefault();
          lastWheelNavigateAt.current = now;
          handleNextReel();
        } else if (wheelAccumRef.current < 0 && canGoPrev) {
          e.preventDefault();
          lastWheelNavigateAt.current = now;
          handlePrevReel();
        }
        wheelAccumRef.current = 0;
      }
    },
    [handleNextReel, handlePrevReel, currentBufferIndex, feedBuffer.length]
  );

  useEffect(() => {
    wheelAccumRef.current = 0;
  }, [currentBufferIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

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
    // Optimistic update
    toggleLike(currentReel.id);
    setIsLiked(!isLiked);
  };

  const handleComment = () => {
    setShowCommentDrawer(true);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Share link copied to clipboard!",
      });
    } catch {
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

  const handleDelete = async () => {
    if (!currentReel) return;
    const title = currentReel.title;
    setShowMoreMenu(false);
    const ok = await deleteReel(currentReel.id);
    if (ok) {
      toast({
        title: "Reel deleted",
        description: `"${title}" has been permanently removed.`,
      });
    } 
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch((err) => {
          if (err.name !== 'AbortError') {
            console.error("Play failed:", err);
            setIsPlaying(false);
          }
        });
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoRef.current) {
        videoRef.current.muted = newMutedState;
    }
  };

  return (
    <div className={cn(
      "relative flex h-full w-full flex-col items-center justify-center bg-muted/30 transition-transform duration-300 ease-out",
      showCommentDrawer ? "-translate-x-[200px]" : "translate-x-0"
    )}>
      {/* Main Container */}
      <div
        ref={containerRef}
        className="relative h-[90vh] max-h-[800px] w-full max-w-[400px] rounded-2xl bg-background shadow-2xl overflow-hidden"
      >
        <AnimatePresence initial={false} custom={slideDirectionRef.current}>
          <motion.div
            key={currentReel.id}
            custom={slideDirectionRef.current}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
          >
           <ReelSlide
             reel={currentReel}
             isActive={true} 
             // Global Lock: Only play if this specific Player instance is the active one
             canPlay={activePlayerId === playerId}
             isMuted={isMuted}
             isLiked={isLiked}
             isBookmarked={isBookmarked}
             showQuiz={showQuiz}
             quizCompleted={quizCompleted}
             elapsedTime={elapsedTime}
             showMoreMenu={showMoreMenu}
             
             onVideoRef={handleVideoRef}
             onTimeUpdate={handleTimeUpdate}
             onLoadedMetadata={handleLoadedMetadata}
             onVideoClick={handleVideoClick}
             
             onLike={handleLike}
             onComment={handleComment}
             onShare={handleShare}
             onBookmark={handleBookmark}
             onDelete={handleDelete}
             toggleMoreMenu={() => setShowMoreMenu(v => !v)}
             setShowMoreMenu={setShowMoreMenu}
             
             onQuizCorrect={handleQuizCorrect}
             onQuizClose={handleQuizClose}
           />
          </motion.div>
        </AnimatePresence>

        {/* Mute/Unmute Button (Global Overlay) */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-20 left-4 z-20 h-10 w-10 unmount-safe rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-white" />
          ) : (
            <Volume2 className="h-5 w-5 text-white" />
          )}
        </Button>
      </div>

      {/* Navigation Arrows */}
      {currentBufferIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-[45%] -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 border-0"
          onClick={handlePrevReel}
        >
          <ChevronUp className="h-5 w-5 text-white" />
        </Button>
      )}

      {currentBufferIndex < feedBuffer.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-[55%] -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 border-0"
          onClick={handleNextReel}
        >
          <ChevronDown className="h-5 w-5 text-white" />
        </Button>
      )}

      {/* Comment Drawer */}
      <CommentDrawer
        reelId={currentReel.id}
        isOpen={showCommentDrawer}
        onClose={() => setShowCommentDrawer(false)}
      />
    </div>
  );
}
