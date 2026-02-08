"use client";

import { ReelPlayer } from "@/components/SocialMode/ReelPlayer";
import { RightStatus } from "@/components/SocialMode/RightStatus";
import { useParams } from "next/navigation";

export default function ReelPage() {
  const params = useParams();
  const reelId = params.id as string;

  return (
    <div className="relative flex h-full w-full">
      <ReelPlayer initialReelId={reelId} />
      <RightStatus />
    </div>
  );
}
