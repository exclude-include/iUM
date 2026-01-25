"use client";

import { motion } from "framer-motion";
import { Smile } from "lucide-react";
import type { LearningUnit } from "@/types";

interface VideoInfoProps {
  video: LearningUnit;
}

export function VideoInfo({ video }: VideoInfoProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pb-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        {/* Author */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500">
            <Smile className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-white">@{video.author}</span>
        </div>

        {/* Title/Description */}
        <p className="text-sm font-medium text-white line-clamp-2">
          {video.title}
        </p>
        <p className="text-xs text-white/80 line-clamp-1">
          {video.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {video.tags.map((tag, index) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="rounded-full bg-white/20 px-2 py-1 text-xs text-white backdrop-blur-sm"
            >
              #{tag}
            </motion.span>
          ))}
        </div>

        {/* Upload Date (placeholder) */}
        <p className="text-xs text-white/60">2 hours ago</p>
      </motion.div>
    </div>
  );
}

