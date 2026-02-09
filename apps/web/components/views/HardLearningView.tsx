"use client";

import { useRef, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { FolderSidebar } from "./HardView/FolderSidebar";
import { MainContentArea } from "./HardView/MainContentArea";
import { ChatSidebar } from "./HardView/ChatSidebar";
import { useAppStore } from "@/lib/store";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function HardLearningView() {
  const leftRef = useRef<ImperativePanelHandle>(null);
  const rightRef = useRef<ImperativePanelHandle>(null);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  const {
    leftPanelMinimized,
    rightPanelMinimized,
    setLeftPanelMinimized,
    setRightPanelMinimized,
  } = useAppStore();

  // Store 상태에 따라 패널 collapse/expand 동기화
  useEffect(() => {
    if (leftPanelMinimized) {
      leftRef.current?.collapse();
    } else {
      leftRef.current?.expand();
    }
  }, [leftPanelMinimized]);

  useEffect(() => {
    if (rightPanelMinimized) {
      rightRef.current?.collapse();
    } else {
      rightRef.current?.expand();
    }
  }, [rightPanelMinimized]);

  return (
    <div className="flex h-full w-full bg-background">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Zone A: Folder Sidebar (좌측 메뉴) */}
        <Panel
          ref={leftRef}
          defaultSize={20}
          minSize={15}
          maxSize={30}
          collapsible
          collapsedSize={0}
          onCollapse={() => setLeftPanelMinimized(true)}
          onExpand={() => setLeftPanelMinimized(false)}
          className="border-r"
        >
          <FolderSidebar />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

        {/* Zone B: Main Content */}
        <Panel defaultSize={55} minSize={40} className="overflow-hidden">
          <MainContentArea />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

        {/* Zone C: Chat Sidebar (채팅창) */}
        <Panel
          ref={rightRef}
          defaultSize={25}
          minSize={20}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onCollapse={() => setRightPanelMinimized(true)}
          onExpand={() => setRightPanelMinimized(false)}
          className="border-l"
        >
          <ChatSidebar />
        </Panel>
      </PanelGroup>
    </div>
  );
}
