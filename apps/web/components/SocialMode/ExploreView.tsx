"use client";

import { useSocialStore } from "./useSocialStore";
import { Play, Heart, Sparkles } from "lucide-react";

export function ExploreView() {
  const { reels, setCurrentView, setCurrentReelById } = useSocialStore();

  const handleReelClick = (reelId: string) => {
    setCurrentReelById(reelId);
    setCurrentView("feed");
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
        {/* Explore Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Explore</h1>
          </div>
          <p className="text-muted-foreground">
            Discover new learning content from all folders
          </p>
        </div>

        {/* Reel Grid */}
        {reels.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-center">
            <div>
              <p className="text-muted-foreground">No reels available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create folders in Hard Mode to see content
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-1">
            {reels.map((reel) => (
              <button
                key={reel.id}
                onClick={() => handleReelClick(reel.id)}
                className="relative aspect-square overflow-hidden rounded-sm bg-muted group hover:opacity-90 transition-opacity"
              >
                {reel.videoUrl ? (
                  <div className="absolute inset-0 bg-black">
                    <video
                      src={reel.videoUrl}
                      className="h-full w-full object-cover"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ background: reel.color }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center p-3">
                      <p className="text-white text-sm font-semibold line-clamp-4 text-center">
                        {reel.title}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Category badge */}
                <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                  <span className="text-xs text-white font-medium">
                    {reel.folderName}
                  </span>
                </div>
                
                {/* Stats overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-xs font-medium line-clamp-1 mb-2">
                    {reel.title}
                  </p>
                  <div className="flex items-center gap-3 text-white text-xs">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {reel.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {reel.comments}
                    </span>
                  </div>
                  
                  {/* Tags */}
                  {reel.tags && reel.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {reel.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-white/80 bg-white/10 px-2 py-0.5 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
