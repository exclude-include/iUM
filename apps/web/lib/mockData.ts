/**
 * Mock data for testing UI without backend
 * This mirrors the structure of the API responses
 */

import {
  LearningUnit,
  FeedResponse,
  Workspace,
  Folder,
  Tab,
  Document,
  HistoryItem,
  UserProgress,
  Mission,
  ChatMessage,
} from "@/types";

// Mock Learning Units for Soft View
export const mockLearningUnits: LearningUnit[] = [
  {
    id: "1",
    title: "Epsilon-Delta Identity",
    description: "Understanding the fundamental identity: εᵢⱼₖεₘₙₖ = δᵢₘδⱼₙ - δᵢₙδⱼₘ",
    type: "reel",
    author: "Math Tutor",
    tags: ["Linear Algebra", "Tensor Calculus"],
    content_url: "https://example.com/video1.mp4",
    thumbnail_url: "https://example.com/thumb1.jpg",
    duration_seconds: 120,
    quiz_content: {
      title: "Epsilon-Delta Identity",
      explanation:
        "In the simplest terms, εᵢⱼₖεₘₙₖ is called the Epsilon-Delta Identity. Here is the 'short and sweet' version:\n\n1. What is it?\nName: The Epsilon-Delta Identity\nPurpose: It is a shortcut used to turn Cross Products(ε) into Dot Products(δ).",
    },
    created_at: "2024-01-20T10:00:00Z",
  },
  {
    id: "2",
    title: "Vector Product Properties",
    description: "Exploring further properties of the vector product",
    type: "reel",
    author: "Physics Prof",
    tags: ["Vector Calculus", "Physics"],
    content_url: "https://example.com/video2.mp4",
    thumbnail_url: "https://example.com/thumb2.jpg",
    duration_seconds: 90,
    quiz_content: {
      title: "Vector Product Properties",
      explanation:
        "The vector product has several important properties including anticommutativity and distributivity over addition.",
    },
    created_at: "2024-01-19T15:30:00Z",
  },
  {
    id: "3",
    title: "Levi-Civita Tensor",
    description: "Deep dive into the Levi-Civita tensor and its applications",
    type: "reel",
    author: "Math Expert",
    tags: ["Tensor Analysis", "Advanced Math"],
    content_url: "https://example.com/video3.mp4",
    thumbnail_url: "https://example.com/thumb3.jpg",
    duration_seconds: 150,
    quiz_content: {
      title: "Levi-Civita Tensor",
      explanation:
        "The Levi-Civita symbol is a mathematical object used in tensor calculus to represent the sign of permutations.",
    },
    created_at: "2024-01-18T09:15:00Z",
  },
];

export const mockFeedResponse: FeedResponse = {
  items: mockLearningUnits,
  total: mockLearningUnits.length,
  limit: 10,
  offset: 0,
  has_more: false,
};

// Mock Workspace Data for Hard View
const mockDocument: Document = {
  id: "doc-1",
  title: "S.L4.2.4 Levi-Civita tensor",
  content_type: "text",
  content:
    "The Levi-Civita symbol is a mathematical object used in tensor calculus. It is true that the Levi-Civita tensor has important properties in vector algebra.",
  sections: [
    {
      title: "S.L4.2.4 Levi-Civita tensor",
      content:
        "The Levi-Civita symbol is a mathematical object used in tensor calculus.",
    },
    {
      title: "S.L4.3 Further properties of the vector product",
      content:
        "Additional properties and applications of the vector product will be explored in this section.",
    },
  ],
  equations: [
    "εᵢⱼₖεₘₙₖ = δᵢₘδⱼₙ - δᵢₙδⱼₘ",
    "εᵢⱼₖεᵢⱼₗ = 2δₖₗ",
    "εᵢⱼₖεᵢⱼₖ = 6",
    "εᵢⱼₖεₘⱼₖ = 2δᵢₘ",
  ],
  created_at: "2024-01-20T10:00:00Z",
};

const mockTabs: Tab[] = [
  {
    id: "tab-1",
    name: "tab 1",
    document: mockDocument,
  },
  {
    id: "tab-2",
    name: "tab 2",
    document: undefined,
  },
];

const mockFolders: Folder[] = [
  {
    id: "folder-1",
    name: "Folder 1",
    icon: "crown",
    tabs: mockTabs,
  },
];

const mockHistory: HistoryItem[] = [
  {
    id: "hist-1",
    title: "Timeline for Tab1",
    timestamp: "2024-01-20T10:00:00Z",
    type: "timeline",
  },
  {
    id: "hist-2",
    title: "RAG study",
    timestamp: "2024-01-19T15:30:00Z",
    type: "study",
  },
  {
    id: "hist-3",
    title: "LangChain study",
    timestamp: "2024-01-18T09:15:00Z",
    type: "study",
  },
];

export const mockWorkspace: Workspace = {
  id: "default",
  name: "My Workspace",
  folders: mockFolders,
  history: mockHistory,
  created_at: "2024-01-01T00:00:00Z",
};

// Mock User Progress
const mockMissions: Mission[] = [
  {
    id: "mission-1",
    title: "7-Day Streak",
    description: "Maintain a learning streak for 7 consecutive days",
    type: "streak",
    target: 7,
    current: 16,
    completed: true,
    reward: "Badge: Dedicated Learner",
  },
  {
    id: "mission-2",
    title: "Complete 10 Quizzes",
    description: "Answer 10 quiz questions correctly",
    type: "quiz",
    target: 10,
    current: 7,
    completed: false,
    reward: "100 points",
  },
];

export const mockUserProgress: UserProgress = {
  user_id: "user-1",
  current_streak: 16,
  longest_streak: 16,
  total_learning_days: 45,
  last_activity: "2024-01-20T10:00:00Z",
  missions: mockMissions,
  total_points: 1250,
  level: 5,
};

// Mock Chat Messages
export const mockChatMessages: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    content: "Hi there! I'm your trustworthy agent, iUM!",
    timestamp: "2024-01-20T10:00:00Z",
  },
];

// Helper functions to simulate API calls
export const getMockFeed = async (
  limit: number = 10,
  offset: number = 0
): Promise<FeedResponse> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const paginatedItems = mockLearningUnits.slice(offset, offset + limit);
  return {
    items: paginatedItems,
    total: mockLearningUnits.length,
    limit,
    offset,
    has_more: offset + limit < mockLearningUnits.length,
  };
};

export const getMockWorkspace = async (
  workspaceId: string = "default"
): Promise<Workspace> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  if (workspaceId !== "default") {
    throw new Error("Workspace not found");
  }

  return mockWorkspace;
};

export const getMockUserProgress = async (): Promise<UserProgress> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  return mockUserProgress;
};

