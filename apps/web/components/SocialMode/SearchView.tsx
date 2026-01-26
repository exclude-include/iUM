"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Play, Heart, TrendingUp } from "lucide-react";
import { useSocialStore } from "./useSocialStore";
import { cn } from "@/lib/utils";

export function SearchView() {
  const { searchQuery, setSearchQuery, getSearchResults, setCurrentView, setCurrentReelIndex } = useSocialStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const searchResults = getSearchResults();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery, setSearchQuery]);

  const handleReelClick = (reelIndex: number) => {
    setCurrentReelIndex(reelIndex);
    setCurrentView("feed");
  };

  const trendingTags = [
    "physics", "math", "calculus", "quantum", "programming",
    "algorithms", "ai", "machinelearning", "education", "science"
  ];

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        {/* Search Header */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Search</h1>
          
          {/* Search Input */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search reels, tags, or users..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="pl-10 pr-4 h-12"
            />
          </div>
        </div>

        {/* Trending Tags */}
        {!localQuery && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Trending</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setLocalQuery(`#${tag}`)}
                  className="px-4 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {localQuery && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Results for "{localQuery}" ({searchResults.length})
            </h2>
            
            {searchResults.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-center">
                <div>
                  <p className="text-muted-foreground">No results found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try different keywords or browse trending tags
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {searchResults.map((reel, index) => (
                  <button
                    key={reel.id}
                    onClick={() => handleReelClick(index)}
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
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ background: reel.color }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center p-2">
                          <p className="text-white text-xs font-semibold line-clamp-3 text-center">
                            {reel.title}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Stats overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
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
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
