export type TutorialStepId =
  | "tutorial-nav-workspace"
  | "tutorial-nav-reels"
  | "tutorial-sidebar-folders"
  | "tutorial-main-new-tab"
  | "tutorial-chat"
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
    title: "학습 워크스페이스",
    body: "여기서 노트를 만들고 AI와 대화하며 공부할 수 있어요. 메인 화면이에요.",
    placement: "right",
  },
  {
    id: "tutorial-nav-reels",
    title: "릴스",
    body: "짧은 영상으로 학습하고 퀴즈로 복습해보세요.",
    placement: "right",
  },
  {
    id: "tutorial-sidebar-folders",
    title: "폴더 & 노트",
    body: "폴더를 만들고 노트를 정리하세요. 여기서 저장된 내용을 불러올 수 있어요.",
    placement: "right",
  },
  {
    id: "tutorial-main-new-tab",
    title: "새 노트 탭",
    body: "새 탭을 만들고 내용을 작성해보세요. AI가 답변을 노트에 정리해줘요.",
    placement: "bottom",
  },
  {
    id: "tutorial-chat",
    title: "AI 채팅",
    body: "오른쪽 채팅창에서 무엇이든 질문해보세요. 첨부 파일도 보낼 수 있어요.",
    placement: "left",
  },
  {
    id: "tutorial-nav-profile",
    title: "프로필",
    body: "프로필과 업로드 메뉴는 여기서 이용할 수 있어요.",
    placement: "right",
  },
  {
    id: "tutorial-nav-settings",
    title: "설정",
    body: "앱 설정과 연동은 설정 페이지에서 변경할 수 있어요.",
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
