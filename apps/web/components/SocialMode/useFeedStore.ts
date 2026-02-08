"use client";

import { create } from "zustand";
import { fetchFeed, fetchReelContext } from "@/lib/api";
import type { ReelItem } from "./useSocialStore";

interface FeedState {
  // Feed buffer (sliding window)
  feedBuffer: ReelItem[];
  currentBufferIndex: number;
  
  // Pagination state
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  
  // Recommendation context
  lastReelId: string | null;
  viewHistory: string[];
  
  // Filter state (for compatibility)
  activeFolderIds: string[];
  showAllFolders: boolean;
  
  // Actions
  loadInitialFeed: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  navigateToReel: (reelId: string) => Promise<void>;
  nextReel: () => void;
  prevReel: () => void;
  getCurrentReel: () => ReelItem | null;
  setActiveFolderIds: (ids: string[]) => void;
  setShowAllFolders: (show: boolean) => void;
  
  // Global Playback Lock
  activePlayerId: string | null;
  setActivePlayerId: (id: string | null) => void;
}

const BUFFER_SIZE_AHEAD = 10;  // Keep 10 reels ahead
const BUFFER_SIZE_BEHIND = 5;  // Keep 5 reels behind
const FETCH_THRESHOLD = 5;     // Fetch more when < 5 reels ahead

/**
 * Transform backend API response to frontend ReelItem format
 * Backend uses snake_case (user_id, video_url, folder_name)
 * Frontend uses camelCase (author, videoUrl, folderName)
 */
function transformApiReelToReelItem(apiReel: any): ReelItem {
  return {
    id: apiReel.id,
    title: apiReel.title || "",
    description: apiReel.description || "",
    videoUrl: apiReel.video_url,
    color: undefined,
    likes: apiReel.likes || 0,
    comments: apiReel.comments || 0,
    folderId: apiReel.folder_id || "",
    folderName: apiReel.folder_name || "",
    author: apiReel.user_id || "Unknown",  // Map user_id to author
    authorAvatar: apiReel.thumbnail_url,
    authorUserId: apiReel.user_id,
    tags: apiReel.tags || [],
    duration: apiReel.duration,
    quiz: apiReel.quiz,
    similarity: apiReel.similarity,
  };
}

export const useFeedStore = create<FeedState>((set, get) => ({
  // Initial state
  feedBuffer: [],
  currentBufferIndex: 0,
  currentPage: 0,
  pageSize: 10,
  hasMore: true,
  isLoading: false,
  lastReelId: null,
  viewHistory: [],
  activeFolderIds: [],
  showAllFolders: true,

  loadInitialFeed: async () => {
    const { isLoading, pageSize, activeFolderIds, showAllFolders } = get();
    if (isLoading) return;

    set({ isLoading: true });

    try {
      // Get active folder IDs from global store
      const { activeFolderId } = await import("@/lib/store").then(m => ({ activeFolderId: m.useAppStore.getState().activeFolderId }));
      
      // Build folder IDs array: use activeFolderId from AppStore if available
      const folderIds = activeFolderId ? [activeFolderId] : [];
      
      const data = await fetchFeed({
        page: 0,
        pageSize: pageSize + 5, // Load 15 initially
        activeFolderIds: folderIds,
      });

      // Transform API response to ReelItem format
      const transformedReels = data.reels.map(transformApiReelToReelItem);

      set({
        feedBuffer: transformedReels,
        currentBufferIndex: 0,
        currentPage: 0,
        hasMore: data.hasMore,
        isLoading: false,
        lastReelId: transformedReels[0]?.id || null,
      });
    } catch (error) {
      console.error("Failed to load initial feed:", error);
      set({ isLoading: false });
    }
  },

  loadNextPage: async () => {
    const { isLoading, hasMore, currentPage, pageSize, lastReelId, feedBuffer } = get();
    
    if (isLoading || !hasMore) return;

    set({ isLoading: true });

    try {
      // Get active folder IDs from global store
      const { activeFolderId } = await import("@/lib/store").then(m => ({ activeFolderId: m.useAppStore.getState().activeFolderId }));
      
      // Build folder IDs array
      const folderIds = activeFolderId ? [activeFolderId] : [];
      
      const data = await fetchFeed({
        page: currentPage + 1,
        pageSize,
        lastReelId: lastReelId || undefined,
        activeFolderIds: folderIds,
      });

      // Transform API response to ReelItem format
      const transformedReels = data.reels.map(transformApiReelToReelItem);

      // Append new reels to buffer, avoiding duplicates
      const existingIds = new Set(feedBuffer.map(r => r.id));
      const newReels = transformedReels.filter(r => !existingIds.has(r.id));
      
      if (newReels.length === 0 && data.reels.length > 0) {
        console.log("Only duplicate reels received, fetching next page might be needed.");
      }

      set({
        feedBuffer: [...feedBuffer, ...newReels],
        currentPage: currentPage + 1,
        hasMore: data.hasMore,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load next page:", error);
      set({ isLoading: false });
    }
  },

  navigateToReel: async (reelId: string) => {
    const { feedBuffer } = get();
    
    // Check if reel is already in buffer
    const existingIndex = feedBuffer.findIndex((r) => r.id === reelId);
    
    if (existingIndex !== -1) {
      // Reel is in buffer, just navigate to it
      set({ 
        currentBufferIndex: existingIndex,
        lastReelId: reelId,
      });
    } else {
      // Reel not in buffer, fetch context
      set({ isLoading: true });
      
      try {
        const data = await fetchReelContext(reelId);
        
        // Transform API response to ReelItem format
        const transformedReel = transformApiReelToReelItem(data.reel);
        const transformedNextReels = data.nextReels.map(transformApiReelToReelItem);
        
        // Replace buffer with this reel + next reels
        set({
          feedBuffer: [transformedReel, ...transformedNextReels],
          currentBufferIndex: 0,
          lastReelId: reelId,
          isLoading: false,
        });
      } catch (error) {
        console.error("Failed to navigate to reel:", error);
        set({ isLoading: false });
      }
    }
  },

  nextReel: () => {
    const { currentBufferIndex, feedBuffer, hasMore, isLoading, viewHistory } = get();
    
    if (currentBufferIndex >= feedBuffer.length - 1) return;

    const newIndex = currentBufferIndex + 1;
    const currentReel = feedBuffer[newIndex];
    
    // Update view history
    const newHistory = [currentReel.id, ...viewHistory].slice(0, 20);
    
    set({
      currentBufferIndex: newIndex,
      lastReelId: currentReel.id,
      viewHistory: newHistory,
    });

    // Check if we need to fetch more
    const remainingAhead = feedBuffer.length - newIndex;
    if (remainingAhead < FETCH_THRESHOLD && hasMore && !isLoading) {
      get().loadNextPage();
    }

    // Trim old reels (keep only last 5)
    if (newIndex > BUFFER_SIZE_BEHIND + 5) {
      const trimAmount = newIndex - BUFFER_SIZE_BEHIND;
      set({
        feedBuffer: feedBuffer.slice(trimAmount),
        currentBufferIndex: BUFFER_SIZE_BEHIND,
      });
    }
  },

  prevReel: () => {
    const { currentBufferIndex } = get();
    
    if (currentBufferIndex > 0) {
      const newIndex = currentBufferIndex - 1;
      const feedBuffer = get().feedBuffer;
      const currentReel = feedBuffer[newIndex];
      
      set({
        currentBufferIndex: newIndex,
        lastReelId: currentReel.id,
      });
    }
  },

  getCurrentReel: () => {
    const { feedBuffer, currentBufferIndex } = get();
    return feedBuffer[currentBufferIndex] || null;
  },

  setActiveFolderIds: (ids) => set({ activeFolderIds: ids }),
  
  setShowAllFolders: (show) => set({ showAllFolders: show }),

  // Global Playback Lock
  activePlayerId: null,
  setActivePlayerId: (id) => set({ activePlayerId: id }),
}));
