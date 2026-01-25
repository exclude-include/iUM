"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { FolderSidebar } from "./HardView/FolderSidebar";
import { MainContentArea } from "./HardView/MainContentArea";
import { ChatSidebar } from "./HardView/ChatSidebar";

export function HardLearningView() {
  return (
    <div className="flex h-full w-full bg-background">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Zone A: Folder Sidebar */}
        <Panel defaultSize={20} minSize={15} maxSize={30} className="border-r">
          <FolderSidebar />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

        {/* Zone B: Main Content Area */}
        <Panel defaultSize={55} minSize={40}>
          <MainContentArea />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

        {/* Zone C: Chat Sidebar */}
        <Panel defaultSize={25} minSize={20} maxSize={35} className="border-l">
          <ChatSidebar />
        </Panel>
      </PanelGroup>
    </div>
  );
}

