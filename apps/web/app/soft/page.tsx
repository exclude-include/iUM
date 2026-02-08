"use client";

import { ReelPlayer } from "@/components/SocialMode/ReelPlayer";
import { RightStatus } from "@/components/SocialMode/RightStatus";

export default function SoftPage() {
  return (
    <div className="relative flex h-full w-full">
      <ReelPlayer />
      <RightStatus />
    </div>
  );
}
