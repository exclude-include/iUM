"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { ActionButtons } from "./ActionButtons";
import { VideoInfo } from "./VideoInfo";
import type { LearningUnit } from "@/types";

interface VideoCardProps {
  video: LearningUnit;
  index: number;
  gradient: string;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
}

export function VideoCard({
  video,
  index,
  isSelected,
  onSelect,
}: VideoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative h-full min-h-[calc(90vh-60px)] snap-start snap-always flex flex-col"
    >
      {/* Video Container with Gradient Background */}
      <div
        className={`relative flex-1 bg-gradient-to-br ${video.gradient} flex items-center justify-center overflow-hidden`}
      >
        {/* Placeholder Content */}
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center p-6"
        >
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-white/20 p-4 backdrop-blur-sm">
              <Play className="h-12 w-12 text-white" fill="white" />
            </div>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-white drop-shadow-lg"
          >
            Trying to watch anything on Reels:
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-2 text-lg text-white/90 drop-shadow-md"
          >
            {video.title}
          </motion.p>
        </motion.div>

        {/* Right Side Action Buttons */}
        <ActionButtons video={video} onQuizClick={onSelect} />

        {/* Bottom Info Overlay */}
        <VideoInfo video={video} />
      </div>
    </motion.div>
  );
}

