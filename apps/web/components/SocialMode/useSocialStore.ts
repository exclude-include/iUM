"use client";

import { create } from "zustand";

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
  activeTab: "reels" | "quiz" | "discuss";
  
  // Actions
  setActiveFolderIds: (ids: string[]) => void;
  toggleFolder: (folderId: string) => void;
  setShowAllFolders: (show: boolean) => void;
  setCurrentReelIndex: (index: number) => void;
  nextReel: () => void;
  prevReel: () => void;
  toggleLike: (reelId: string) => void;
  toggleBookmark: (reelId: string) => void;
  setActiveTab: (tab: "reels" | "quiz" | "discuss") => void;
  refreshFeed: () => void;
  
  // Computed getters
  getFilteredReels: () => ReelItem[];
  getCurrentReel: () => ReelItem | null;
}

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
  
  folders.forEach((folder, folderIndex) => {
    for (let i = 0; i < 3; i++) {
      const topicIndex = (folderIndex * 3 + i) % topics.length;
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
  activeTab: "reels",
  
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
  
  toggleLike: (reelId) => {
    const { likedReels, reels } = get();
    const newLikedReels = new Set(likedReels);
    
    if (newLikedReels.has(reelId)) {
      newLikedReels.delete(reelId);
      // Decrement likes
      set({
        likedReels: newLikedReels,
        reels: reels.map((r) =>
          r.id === reelId ? { ...r, likes: Math.max(0, r.likes - 1) } : r
        ),
      });
    } else {
      newLikedReels.add(reelId);
      // Increment likes
      set({
        likedReels: newLikedReels,
        reels: reels.map((r) =>
          r.id === reelId ? { ...r, likes: r.likes + 1 } : r
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
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  refreshFeed: () => {
    set({ currentReelIndex: 0 });
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

// Helper function to fetch reels from Supabase
export const fetchReelsFromSupabase = async (supabase: any) => {
  try {
    const { data, error } = await supabase
      .from("reels")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reels:", error);
      return [];
    }

    // Transform Supabase data to ReelItem format
    return (data || []).map((reel: any) => ({
      id: reel.id,
      title: reel.title,
      description: reel.description || "",
      videoUrl: reel.video_url,
      color: undefined, // Real videos don't need gradient colors
      likes: reel.likes_count || 0,
      comments: reel.comments_count || 0,
      folderId: reel.folder_id || "",
      folderName: reel.folder_name || "General",
      author: "User", // You can fetch user data if needed
      authorAvatar: undefined,
    }));
  } catch (error) {
    console.error("Error fetching reels:", error);
    return [];
  }
};
