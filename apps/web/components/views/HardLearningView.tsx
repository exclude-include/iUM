"use client";

import { useRef, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { FolderSidebar } from "./HardView/FolderSidebar";
import { MainContentArea } from "./HardView/MainContentArea";
import { ChatSidebar } from "./HardView/ChatSidebar";
import { SourcesPanel } from "./HardView/SourcesPanel";
import { useAppStore } from "@/lib/store";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function HardLearningView() {
  const leftRef = useRef<ImperativePanelHandle>(null);
  const rightRef = useRef<ImperativePanelHandle>(null);
  const bottomRef = useRef<ImperativePanelHandle>(null);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  const {
    leftPanelMinimized,
    rightPanelMinimized,
    bottomPanelMinimized,
    setLeftPanelMinimized,
    setRightPanelMinimized,
    setBottomPanelMinimized,
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

  useEffect(() => {
    if (bottomPanelMinimized) {
      bottomRef.current?.collapse();
    } else {
      bottomRef.current?.expand();
    }
  }, [bottomPanelMinimized]);

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

        {/* Zone B: Main Content + 하단 토글 탭 (세로 리사이즈 가능) */}
        <Panel defaultSize={55} minSize={40} className="overflow-hidden">
          <PanelGroup direction="vertical" className="h-full">
            {/* 메인 콘텐츠 영역 */}
            <Panel defaultSize={70} minSize={20} className="min-h-0 overflow-hidden">
              <MainContentArea />
            </Panel>

            <PanelResizeHandle className="h-1.5 bg-border hover:bg-primary/20 transition-colors data-[resize-handle-active]:bg-primary/30 flex items-center justify-center group">
              <div className="w-12 h-0.5 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors" />
            </PanelResizeHandle>

            {/* 하단 토글 탭 (Sources / Generated / Quick tools) - 위아래 크기 조절 가능 */}
            <Panel
              ref={bottomRef}
              defaultSize={30}
              minSize={10}
              maxSize={70}
              collapsible
              collapsedSize={0}
              onCollapse={() => setBottomPanelMinimized(true)}
              onExpand={() => setBottomPanelMinimized(false)}
              className="min-h-0"
            >
              <SourcesPanel />
            </Panel>
          </PanelGroup>
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
