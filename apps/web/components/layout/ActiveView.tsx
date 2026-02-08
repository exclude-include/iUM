"use client";

import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

interface ActiveViewProps {
  children: ReactNode;
}

// Enhanced animation variants for Hard View (slides left)
const hardViewVariants = {
  initial: {
    opacity: 0,
    x: -150,
    scale: 0.96,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom cubic-bezier for smooth, natural feel
      opacity: { duration: 0.4 },
      filter: { duration: 0.3 },
    },
  },
  exit: {
    opacity: 0,
    x: -150,
    scale: 0.96,
    filter: "blur(4px)",
    transition: {
      duration: 0.4,
      ease: [0.55, 0.06, 0.68, 0.19], // Faster exit
      opacity: { duration: 0.3 },
      filter: { duration: 0.2 },
    },
  },
};

// Enhanced animation variants for Soft View (slides right)
const softViewVariants = {
  initial: {
    opacity: 0,
    x: 150,
    scale: 0.96,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94], // Same smooth easing
      opacity: { duration: 0.4 },
      filter: { duration: 0.3 },
    },
  },
  exit: {
    opacity: 0,
    x: 150,
    scale: 0.96,
    filter: "blur(4px)",
    transition: {
      duration: 0.4,
      ease: [0.55, 0.06, 0.68, 0.19], // Faster exit
      opacity: { duration: 0.3 },
      filter: { duration: 0.2 },
    },
  },
};

export function ActiveView({ children }: ActiveViewProps) {
  const pathname = usePathname();
  const isSoftMode = pathname?.startsWith("/soft");
  const viewMode = isSoftMode ? "soft" : "hard";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewMode}
          variants={isSoftMode ? softViewVariants : hardViewVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 h-full w-full"
          style={{ willChange: "transform, opacity, filter" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
