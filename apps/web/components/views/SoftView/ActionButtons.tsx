"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, MoreVertical, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ActionButtonsProps {
  video: {
    id: string;
    title: string;
  };
  onQuizClick: () => void;
}

export function ActionButtons({ video, onQuizClick }: ActionButtonsProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 1000) + 100);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const actions = [
    {
      icon: Heart,
      label: "Like",
      count: likeCount,
      onClick: handleLike,
      isActive: isLiked,
      color: "text-red-500",
    },
    {
      icon: MessageCircle,
      label: "Comment",
      count: Math.floor(Math.random() * 500) + 50,
      onClick: () => {},
    },
    {
      icon: Share2,
      label: "Share",
      onClick: () => {},
    },
    {
      icon: BookOpen,
      label: "Quiz",
      onClick: onQuizClick,
      color: "text-yellow-500",
    },
    {
      icon: MoreVertical,
      label: "More",
      onClick: () => {},
    },
  ];

  return (
    <TooltipProvider>
      <div className="absolute right-2 bottom-24 flex flex-col gap-4 z-10">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-12 w-12 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 ${
                      action.isActive ? action.color : "text-white"
                    }`}
                    onClick={action.onClick}
                  >
                    <Icon
                      className={`h-6 w-6 ${action.isActive ? "fill-current" : ""} ${
                        action.color || "text-white"
                      }`}
                    />
                  </Button>
                  {action.count !== undefined && (
                    <p className="mt-1 text-center text-xs font-semibold text-white drop-shadow-lg">
                      {action.count > 999 ? `${(action.count / 1000).toFixed(1)}k` : action.count}
                    </p>
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{action.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

