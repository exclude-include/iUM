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
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSocialStore } from "./useSocialStore";
import { QuizOverlay } from "./QuizOverlay";
import { cn } from "@/lib/utils";

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
    setActiveTab,
  } = store;

  const currentReel = store.getCurrentReel();
  const filteredReels = store.getFilteredReels();

  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const quizTriggeredRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update like/bookmark state when reel changes
  useEffect(() => {
    if (currentReel) {
      setIsLiked(likedReels.has(currentReel.id));
      setIsBookmarked(bookmarkedReels.has(currentReel.id));
      // Reset quiz state when reel changes
      setShowQuiz(false);
      setQuizCompleted(false);
      setElapsedTime(0);
      quizTriggeredRef.current = false;
    }
  }, [currentReel, likedReels, bookmarkedReels]);

  // Calculate quiz trigger time
  const getQuizTriggerTime = useCallback(() => {
    if (!currentReel?.quiz) return null;

    // Use specified timestamp, or default to 50% of video duration
    if (currentReel.quiz.timestamp_seconds !== undefined) {
      return currentReel.quiz.timestamp_seconds;
    }

    // Use duration from reel data or from video element
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

  // Handle video metadata loaded (to get duration)
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  }, []);

  // Timer for placeholder (non-video) reels
  useEffect(() => {
    // Only run timer for placeholder reels (no videoUrl)
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

    console.log("🧪 [TEST] Starting timer for placeholder reel. Quiz at", triggerTime, "seconds");

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 0.1;
        if (newTime >= triggerTime && !quizTriggeredRef.current) {
          quizTriggeredRef.current = true;
          setIsPlaying(false);
          setShowQuiz(true);
          console.log("🧪 [TEST] Quiz triggered at", newTime.toFixed(1), "seconds (placeholder reel)");
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

  // Handle quiz correct answer
  const handleQuizCorrect = useCallback(() => {
    setQuizCompleted(true);
    setShowQuiz(false);

    // Resume video playback
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    } else {
      // For placeholder reels, just mark as playing
      setIsPlaying(true);
    }

    toast({
      title: "Great job!",
      description: "You answered correctly. Keep learning!",
    });
  }, [toast]);

  // Handle quiz close (for when user wants to retry later)
  const handleQuizClose = useCallback(() => {
    setShowQuiz(false);
  }, []);

  // Auto-play video when reel changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch((err) => {
        console.error("Auto-play failed:", err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [currentReel]);

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

  // Mouse wheel scroll navigation
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    let isScrolling = false;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (isScrolling) return;

      const delta = e.deltaY;

      if (Math.abs(delta) > 50) {
        isScrolling = true;

        if (delta > 0) {
          // Scroll down - next reel
          nextReel();
        } else {
          // Scroll up - previous reel
          prevReel();
        }

        // Reset scrolling flag after animation
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 500);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [nextReel, prevReel]);

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

  const handleMore = () => {
    toast({
      title: "More Options",
      description: "Additional options coming soon!",
    });
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else {
      // For placeholder reels
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
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
        <div className="absolute inset-0 bg-black" onClick={handleVideoClick}>
          {currentReel.videoUrl ? (
            <video
              ref={videoRef}
              src={currentReel.videoUrl}
              className="h-full w-full object-cover"
              loop={!currentReel.quiz || quizCompleted}
              playsInline
              muted={isMuted}
              preload="auto"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  currentReel.color ||
                  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            >
              {/* Placeholder content */}
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-white/80">
                  <p className="text-2xl font-bold mb-2">{currentReel.title}</p>
                  <p className="text-sm">{currentReel.description}</p>
                  {/* Timer display for testing */}
                  {currentReel.quiz && !quizCompleted && (
                    <p className="mt-4 text-xs text-white/50">
                      ⏱ {elapsedTime.toFixed(1)}s / {getQuizTriggerTime()?.toFixed(1) || "?"}s
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mute/Unmute Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-20 left-4 z-20 h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80"
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
        <div className="absolute bottom-20 left-4 z-20 text-white max-w-[60%]">
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
          <p className="text-xs text-white/70 line-clamp-2 mb-2">
            {currentReel.description}
          </p>

          {/* Hashtags */}
          {currentReel.tags && currentReel.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {currentReel.tags.map((tag) => (
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
            <span className="text-xs text-white font-medium">
              {currentReel.likes}
            </span>
          </motion.button>

          <button
            onClick={handleComment}
            className="flex flex-col items-center gap-1"
          >
            <MessageCircle className="h-7 w-7 text-white" />
            <span className="text-xs text-white font-medium">
              {currentReel.comments}
            </span>
          </button>

          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1"
          >
            <Share2 className="h-7 w-7 text-white" />
          </button>

          <button
            onClick={handleBookmark}
            className="flex flex-col items-center gap-1"
          >
            <Bookmark
              className={cn(
                "h-7 w-7",
                isBookmarked ? "fill-white text-white" : "text-white"
              )}
            />
          </button>

          <button
            onClick={handleMore}
            className="flex flex-col items-center gap-1"
          >
            <MoreVertical className="h-7 w-7 text-white" />
          </button>
        </div>

        {/* Reel Counter */}
        <div className="absolute top-20 right-4 z-20">
          <div className="rounded-full bg-background/50 backdrop-blur-sm px-3 py-1 text-xs text-white">
            {currentReelIndex + 1} / {filteredReels.length}
          </div>
        </div>

        {/* Quiz Overlay */}
        <AnimatePresence>
          {showQuiz && currentReel.quiz && (
            <QuizOverlay
              quiz={currentReel.quiz}
              onCorrectAnswer={handleQuizCorrect}
              onClose={handleQuizClose}
            />
          )}
        </AnimatePresence>

        {/* Quiz Badge (shows if reel has quiz) */}
        {currentReel.quiz && !quizCompleted && !showQuiz && (
          <div className="absolute top-32 left-4 z-20">
            <div className="rounded-full bg-primary/80 backdrop-blur-sm px-3 py-1 text-xs text-white font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Quiz ahead
            </div>
          </div>
        )}

        {/* Quiz Completed Badge */}
        {currentReel.quiz && quizCompleted && (
          <div className="absolute top-32 left-4 z-20">
            <div className="rounded-full bg-green-500/80 backdrop-blur-sm px-3 py-1 text-xs text-white font-medium">
              ✓ Quiz completed
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
