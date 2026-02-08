"use client";

import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
import type { ReelQuiz } from "@/types/api";

export interface ReelItem {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  color?: string; // Gradient color for placeholder
  likes: number;
  comments: number;
  folderId: string;
  folderName: string;
  author: string;
  authorAvatar?: string;
  authorUserId?: string; // User ID of the author
  tags?: string[]; // Hashtags for categorization and recommendation
  duration?: number; // Video duration in seconds
  quiz?: ReelQuiz; // Interactive quiz data
  similarity?: number; // Debugging score
}

interface SocialState {
  // Reels data
  reels: ReelItem[];
  
  // Filter state
  activeFolderIds: string[];
  showAllFolders: boolean;
  
  // Player state
  currentReelIndex: number;
  likedReels: Set<string>;
  bookmarkedReels: Set<string>;
  
  // View state
  currentView: "feed" | "profile" | "search" | "explore";
  searchQuery: string;
  
  // Actions
  setActiveFolderIds: (ids: string[]) => void;
  toggleFolder: (folderId: string) => void;
  setShowAllFolders: (show: boolean) => void;
  setCurrentReelIndex: (index: number) => void;
  setCurrentReelById: (reelId: string) => void;
  nextReel: () => void;
  prevReel: () => void;
  toggleLike: (reelId: string) => void;
  toggleBookmark: (reelId: string) => void;
  deleteReel: (reelId: string) => Promise<boolean>;
  setCurrentView: (view: "feed" | "profile" | "search" | "explore") => void;
  setSearchQuery: (query: string) => void;
  refreshFeed: () => void;
  loadReelsFromSupabase: () => Promise<void>;
  
  // Computed getters
  getFilteredReels: () => ReelItem[];
  getCurrentReel: () => ReelItem | null;
  getMyReels: (userId?: string) => ReelItem[];
  getSearchResults: () => ReelItem[];
}

// Mock quiz data for testing
const mockQuizzes: ReelQuiz[] = [
  {
    question: "Maxwell 방정식 중 자기장의 발산이 0임을 나타내는 법칙은?",
    options: [
      { key: "A", text: "가우스 법칙 (전기)" },
      { key: "B", text: "가우스 법칙 (자기)" },
      { key: "C", text: "패러데이 법칙" },
      { key: "D", text: "앙페르-맥스웰 법칙" },
    ],
    answer: "B",
    explanation: "자기장의 발산이 항상 0인 것은 자기 단극(magnetic monopole)이 존재하지 않음을 의미합니다.",
    timestamp_seconds: 5,
  },
  {
    question: "양자 얽힘에서 한 입자의 상태를 측정하면 다른 입자는?",
    options: [
      { key: "A", text: "아무 영향이 없다" },
      { key: "B", text: "즉시 상관된 상태가 결정된다" },
      { key: "C", text: "시간이 지나면 영향을 받는다" },
      { key: "D", text: "확률적으로 영향을 받는다" },
    ],
    answer: "B",
    explanation: "양자 얽힘 상태에서는 거리와 관계없이 한 입자의 측정이 다른 입자의 상태를 즉시 결정합니다.",
    timestamp_seconds: 5,
  },
  {
    question: "텐서의 차수(rank)가 2인 것은 무엇인가요?",
    options: [
      { key: "A", text: "스칼라" },
      { key: "B", text: "벡터" },
      { key: "C", text: "행렬" },
      { key: "D", text: "3차원 배열" },
    ],
    answer: "C",
    explanation: "스칼라는 0차, 벡터는 1차, 행렬은 2차 텐서입니다.",
    timestamp_seconds: 5,
  },
];

// Mock data generator
const generateMockReels = (folders: Array<{ id: string; name: string }>): ReelItem[] => {
  const colors = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  ];

  const topics = [
    "Maxwell's Equations Explained",
    "Quantum Entanglement Basics",
    "Tensor Calculus Introduction",
    "Neural Networks from Scratch",
    "Relativity Theory Overview",
    "Calculus Fundamentals",
    "Linear Algebra Deep Dive",
    "Probability Theory",
  ];

  const descriptions = [
    "Understanding electromagnetic fields through Maxwell's equations",
    "Exploring the mysterious world of quantum mechanics",
    "Master tensor operations step by step",
    "Build your first neural network",
    "Einstein's theory of relativity simplified",
    "The foundation of all mathematics",
    "Vectors, matrices, and transformations",
    "Understanding randomness and probability",
  ];

  if (folders.length === 0) {
    return [];
  }

  const reels: ReelItem[] = [];

  const hashtagPool = [
    "physics", "math", "calculus", "quantum", "programming",
    "algorithms", "neuralnetworks", "ai", "machinelearning", "science",
    "education", "learning", "tutorial", "explained", "theory"
  ];

  folders.forEach((folder, folderIndex) => {
    for (let i = 0; i < 3; i++) {
      const topicIndex = (folderIndex * 3 + i) % topics.length;

      // Generate hashtags: folder name + 2-3 random tags
      const folderTag = folder.name.toLowerCase().replace(/\s+/g, "_");
      const numRandomTags = Math.floor(Math.random() * 2) + 2;
      const randomTags: string[] = [];
      for (let j = 0; j < numRandomTags; j++) {
        const randomTag = hashtagPool[Math.floor(Math.random() * hashtagPool.length)];
        if (!randomTags.includes(randomTag)) {
          randomTags.push(randomTag);
        }
      }

      // Assign quiz to each reel (cycling through mockQuizzes)
      const quizIndex = (folderIndex * 3 + i) % mockQuizzes.length;

      reels.push({
        id: `reel-${folder.id}-${i}`,
        title: topics[topicIndex],
        description: descriptions[topicIndex],
        color: colors[(folderIndex * 3 + i) % colors.length],
        likes: Math.floor(Math.random() * 1000) + 50,
        comments: Math.floor(Math.random() * 100) + 5,
        folderId: folder.id,
        folderName: folder.name,
        author: "MathTutor",
        authorAvatar: undefined,
        tags: [folderTag, ...randomTags],
        duration: 30, // 30 seconds for mock reels
        quiz: mockQuizzes[quizIndex],
      });
    }
  });

  return reels;
};

export const useSocialStore = create<SocialState>((set, get) => ({
  // Initialize with empty reels - will be populated when folders are available
  reels: [],
  activeFolderIds: [],
  showAllFolders: true,
  currentReelIndex: 0,
  likedReels: new Set(),
  bookmarkedReels: new Set(),
  currentView: "feed",
  searchQuery: "",
  
  setActiveFolderIds: (ids) => set({ activeFolderIds: ids }),
  
  toggleFolder: (folderId) => {
    const { activeFolderIds, showAllFolders } = get();
    if (showAllFolders) {
      // If "All" is on, turn it off and select only this folder
      set({ showAllFolders: false, activeFolderIds: [folderId] });
    } else {
      // Toggle this folder
      if (activeFolderIds.includes(folderId)) {
        set({ activeFolderIds: activeFolderIds.filter((id) => id !== folderId) });
      } else {
        set({ activeFolderIds: [...activeFolderIds, folderId] });
      }
    }
  },
  
  setShowAllFolders: (show) => {
    if (show) {
      // Get all folder IDs from reels
      const { reels } = get();
      const allFolderIds = Array.from(new Set(reels.map((r) => r.folderId)));
      set({ showAllFolders: true, activeFolderIds: allFolderIds });
    } else {
      set({ showAllFolders: false });
    }
  },
  
  setCurrentReelIndex: (index) => {
    const filteredReels = get().getFilteredReels();
    const maxIndex = filteredReels.length - 1;
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    set({ currentReelIndex: clampedIndex });
  },
  
  setCurrentReelById: (reelId) => {
    const filteredReels = get().getFilteredReels();
    const index = filteredReels.findIndex((reel) => reel.id === reelId);
    if (index !== -1) {
      set({ currentReelIndex: index });
    }
  },
  
  nextReel: () => {
    const { currentReelIndex } = get();
    const filteredReels = get().getFilteredReels();
    if (currentReelIndex < filteredReels.length - 1) {
      set({ currentReelIndex: currentReelIndex + 1 });
    }
  },
  
  prevReel: () => {
    const { currentReelIndex } = get();
    if (currentReelIndex > 0) {
      set({ currentReelIndex: currentReelIndex - 1 });
    }
  },
  
  
  toggleLike: async (reelId) => {
    const { likedReels, reels } = get();
    const newLikedReels = new Set(likedReels);
    const isCurrentlyLiked = newLikedReels.has(reelId);
    const increment = !isCurrentlyLiked;
    
    // Optimistic update
    if (isCurrentlyLiked) {
      newLikedReels.delete(reelId);
      set({
        likedReels: newLikedReels,
        reels: reels.map((r) =>
          r.id === reelId ? { ...r, likes: Math.max(0, r.likes - 1) } : r
        ),
      });
    } else {
      newLikedReels.add(reelId);
      set({
        likedReels: newLikedReels,
        reels: reels.map((r) =>
          r.id === reelId ? { ...r, likes: r.likes + 1 } : r
        ),
      });
    }

    // Persist to database
    try {
      const { supabase } = await import("@/lib/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        const { reelInteractionsApi } = await import("@/lib/api");
        const response = await reelInteractionsApi.toggleLike(reelId, session.access_token);
        
        // Update state based on server response
        const serverLikedReels = new Set(likedReels);
        if (response.is_liked) {
          serverLikedReels.add(reelId);
        } else {
          serverLikedReels.delete(reelId);
        }
        
        set({
          likedReels: serverLikedReels,
          reels: reels.map((r) =>
            r.id === reelId ? { ...r, likes: response.likes } : r
          ),
        });
      }
    } catch (error) {
      console.error("Failed to persist like:", error);
      // Revert optimistic update on error
      const currentReels = get().reels;
      const currentReel = currentReels.find(r => r.id === reelId);
      const originalLikes = currentReel?.likes || 0;
      
      if (isCurrentlyLiked) {
        newLikedReels.add(reelId);
      } else {
        newLikedReels.delete(reelId);
      }
      set({
        likedReels: newLikedReels,
        reels: reels.map((r) =>
          r.id === reelId ? { ...r, likes: isCurrentlyLiked ? originalLikes + 1 : Math.max(0, originalLikes - 1) } : r
        ),
      });
    }
  },
  
  toggleBookmark: (reelId) => {
    const { bookmarkedReels } = get();
    const newBookmarkedReels = new Set(bookmarkedReels);
    
    if (newBookmarkedReels.has(reelId)) {
      newBookmarkedReels.delete(reelId);
    } else {
      newBookmarkedReels.add(reelId);
    }
    
    set({ bookmarkedReels: newBookmarkedReels });
  },
  
  deleteReel: async (reelId) => {
    const { error } = await supabase.from("reels").delete().eq("id", reelId);

    if (error) {
      console.error("Error deleting reel from Supabase:", error);
      return false;
    }

    const state = get();
    const newReels = state.reels.filter((r) => r.id !== reelId);
    if (newReels.length === state.reels.length) return true;

    const oldFiltered =
      state.showAllFolders || state.activeFolderIds.length === 0
        ? state.reels
        : state.reels.filter((r) => state.activeFolderIds.includes(r.folderId));
    const newFiltered =
      state.showAllFolders || state.activeFolderIds.length === 0
        ? newReels
        : newReels.filter((r) => state.activeFolderIds.includes(r.folderId));

    const deletedFilteredIndex = oldFiltered.findIndex((r) => r.id === reelId);
    let newIndex = state.currentReelIndex;
    if (deletedFilteredIndex === state.currentReelIndex) {
      newIndex = Math.min(state.currentReelIndex, newFiltered.length - 1);
    } else if (deletedFilteredIndex >= 0 && deletedFilteredIndex < state.currentReelIndex) {
      newIndex = state.currentReelIndex - 1;
    }
    newIndex = Math.max(0, Math.min(newIndex, newFiltered.length - 1));

    const newLikedReels = new Set(state.likedReels);
    const newBookmarkedReels = new Set(state.bookmarkedReels);
    newLikedReels.delete(reelId);
    newBookmarkedReels.delete(reelId);

    set({
      reels: newReels,
      currentReelIndex: newIndex,
      likedReels: newLikedReels,
      bookmarkedReels: newBookmarkedReels,
    });
    return true;
  },
  
  setCurrentView: (view) => {
    // Don't reset index when navigating to feed view (user might have selected a specific reel)
    if (view === "feed") {
      set({ currentView: view });
    } else {
      set({ currentView: view, currentReelIndex: 0 });
    }
  },
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  refreshFeed: async () => {
    set({ currentReelIndex: 0 });
    await get().loadReelsFromSupabase();
  },
  
  loadReelsFromSupabase: async () => {
    try {
      const { data: reelsData, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading reels:", error);
        return;
      }

      if (!reelsData || reelsData.length === 0) {
        return;
      }

      // Transform Supabase data to ReelItem format
      const colors = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
      ];

      const transformedReels: ReelItem[] = reelsData.map((reel, index) => ({
        id: reel.id,
        title: reel.title,
        description: reel.description ?? "",
        videoUrl: reel.video_url,
        color: colors[index % colors.length],
        likes: 0,
        comments: reel.comments || 0,
        folderId: reel.folder_name || "default",
        folderName: reel.folder_name || "My Reels",
        author: reel.author_name || "User",
        authorUserId: reel.user_id,
        authorAvatar: reel.author_avatar ?? undefined,
        tags: reel.tags || [],
        duration: reel.duration || undefined,
        quiz: reel.quiz || undefined,
      }));

      set({ reels: transformedReels });

      // Fetch actual like counts from likes table and user's liked reels
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const { reelInteractionsApi } = await import("@/lib/api");
          
          // Fetch user's liked reels
          const likeResponse = await reelInteractionsApi.getUserLikes(session.access_token);
          if (likeResponse.success && likeResponse.liked_reels) {
            set({ likedReels: new Set(likeResponse.liked_reels) });
          }
          
          // Fetch actual like counts for all reels
          // For now, trigger a refresh by toggling - this will fetch real counts
          // TODO: Add batch endpoint to get all like counts at once
        }
      } catch (likeError) {
        console.error("Failed to load user likes:", likeError);
      }
    } catch (error) {
      console.error("Failed to load reels:", error);
    }
  },
  
  // Computed getters
  getFilteredReels: () => {
    const { reels, activeFolderIds, showAllFolders } = get();
    if (showAllFolders || activeFolderIds.length === 0) {
      return reels;
    }
    return reels.filter((reel) => activeFolderIds.includes(reel.folderId));
  },
  
  getCurrentReel: () => {
    const filteredReels = get().getFilteredReels();
    const { currentReelIndex } = get();
    return filteredReels[currentReelIndex] || null;
  },
  
  getMyReels: (userId?: string) => {
    const { reels } = get();
    if (!userId) return reels;
    return reels.filter((reel) => reel.authorUserId === userId);
  },
  
  getSearchResults: () => {
    const { reels, searchQuery } = get();
    if (!searchQuery.trim()) return reels;
    
    const query = searchQuery.toLowerCase();
    return reels.filter((reel) =>
      reel.title.toLowerCase().includes(query) ||
      reel.description.toLowerCase().includes(query) ||
      reel.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
      reel.folderName.toLowerCase().includes(query) ||
      reel.author.toLowerCase().includes(query)
    );
  },
}));

// Helper function to initialize reels from folders
export const initializeSocialReels = (folders: Array<{ id: string; name: string }>) => {
  const reels = generateMockReels(folders);
  useSocialStore.setState({ 
    reels,
    activeFolderIds: folders.map((f) => f.id),
    showAllFolders: true,
  });
};
