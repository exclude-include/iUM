"use client";

import { SocialSidebar } from "./SocialSidebar";
import { ReelPlayer } from "./ReelPlayer";
import { RightStatus } from "./RightStatus";

export function SocialLayout() {
  return (
    <div className="flex h-full w-full bg-background">
      {/* Left Sidebar */}
      <SocialSidebar />

      {/* Center: Reel Player */}
      <div className="flex-1 overflow-hidden">
        <ReelPlayer />
      </div>

      {/* Right Status */}
      <RightStatus />
    </div>
  );
}

