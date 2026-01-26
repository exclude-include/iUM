"use client";

import { SocialSidebar } from "./SocialSidebar";
import { ReelPlayer } from "./ReelPlayer";
import { RightStatus } from "./RightStatus";
import { MyProfileView } from "./MyProfileView";
import { SearchView } from "./SearchView";
import { ExploreView } from "./ExploreView";
import { useSocialStore } from "./useSocialStore";

export function SocialLayout() {
  const { currentView } = useSocialStore();

  const renderMainContent = () => {
    switch (currentView) {
      case "profile":
        return <MyProfileView />;
      case "search":
        return <SearchView />;
      case "explore":
        return <ExploreView />;
      case "feed":
      default:
        return <ReelPlayer />;
    }
  };

  return (
    <div className="flex h-full w-full bg-background">
      {/* Left Sidebar */}
      <SocialSidebar />

      {/* Center: Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderMainContent()}
      </div>

      {/* Right Status - Only show on feed view */}
      {currentView === "feed" && <RightStatus />}
    </div>
  );
}

