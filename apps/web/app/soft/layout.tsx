"use client";

import { SocialSidebar } from "@/components/SocialMode/SocialSidebar";

export default function SoftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full bg-background">
      {/* Left Sidebar */}
      <SocialSidebar />

      {/* Center: Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
