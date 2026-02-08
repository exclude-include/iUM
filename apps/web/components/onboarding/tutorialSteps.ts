export type TutorialStepId =
  | "tutorial-nav-workspace"
  | "tutorial-nav-reels"
  | "tutorial-sidebar-folders"
  | "tutorial-main-new-tab"
  | "tutorial-chat"
  | "tutorial-deep"
  | "tutorial-nav-profile"
  | "tutorial-nav-settings";

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  body: string;
  placement?: "bottom" | "top" | "left" | "right";
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "tutorial-nav-workspace",
    title: "Learning Workspace",
    body: "Create notes and study with AI here. This is your main workspace.",
    placement: "right",
  },
  {
    id: "tutorial-nav-reels",
    title: "Reels",
    body: "Learn with short videos and reinforce with quizzes.",
    placement: "right",
  },
  {
    id: "tutorial-sidebar-folders",
    title: "Folders & Notes",
    body: "Create folders and organize your notes. Open saved content from here.",
    placement: "right",
  },
  {
    id: "tutorial-main-new-tab",
    title: "New Note Tab",
    body: "Create a new tab and start writing. AI will organize answers in your notes.",
    placement: "bottom",
  },
  {
    id: "tutorial-chat",
    title: "AI Chat",
    body: "Ask anything in the chat panel. You can also attach files.",
    placement: "left",
  },
  {
    id: "tutorial-deep",
    title: "Deep Dive",
    body: "Select text in your note and use Deep Dive to get a focused explanation. The selected part will be highlighted; click it to jump to the explanation.",
    placement: "left",
  },
  {
    id: "tutorial-nav-profile",
    title: "Profile",
    body: "Access your profile and upload options here.",
    placement: "right",
  },
  {
    id: "tutorial-nav-settings",
    title: "Settings",
    body: "Change app settings and integrations in the settings page.",
    placement: "right",
  },
];

export const TUTORIAL_STORAGE_KEY = "ium_tutorial_completed";

export function getTutorialStorageKey(userId: string | undefined): string {
  return userId ? `${TUTORIAL_STORAGE_KEY}_${userId}` : TUTORIAL_STORAGE_KEY;
}

export function isTutorialCompleted(userId: string | undefined): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(getTutorialStorageKey(userId)) === "true";
}

export function setTutorialCompleted(userId: string | undefined): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getTutorialStorageKey(userId), "true");
}
