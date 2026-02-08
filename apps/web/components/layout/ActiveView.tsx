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
    scale: 0.98,
    // filter: "blur(4px)", // heavy on some devices
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    // filter: "blur(0px)",
    transition: {
      duration: 0.3, // Faster
      ease: [0.25, 0.46, 0.45, 0.94],
      opacity: { duration: 0.25 },
    },
  },
  exit: {
    opacity: 0,
    x: -150,
    scale: 0.98,
    // filter: "blur(4px)",
    transition: {
      duration: 0.2, // Faster exit
      ease: [0.55, 0.06, 0.68, 0.19],
      opacity: { duration: 0.15 },
    },
  },
};

// Enhanced animation variants for Soft View (slides right)
const softViewVariants = {
  initial: {
    opacity: 0,
    x: 100, // Reduced distance
    // scale: 0.98, // Removed scale to reduce composite layer recalculations
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut", // Simpler easing
    },
  },
  exit: {
    opacity: 0,
    // x: 100, // Don't move on exit, just fade out to avoid heavy composition during HardView mount
    scale: 1, // Keep scale 1
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

export function ActiveView({ children }: ActiveViewProps) {
  const pathname = usePathname();
  const isSoftMode = pathname?.startsWith("/soft");
  const viewMode = isSoftMode ? "soft" : "hard";

  return (
    <div className="relative h-full w-full overflow-hidden bg-background"> {/* Add bg-background to prevent transparent holes */}
      <AnimatePresence mode="popLayout" initial={false}> {/* popLayout helps with positioning */}
        <motion.div
          key={viewMode}
          variants={isSoftMode ? softViewVariants : hardViewVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 h-full w-full"
          // Removed will-change to let browser decide, sometimes it consumes too much memory for full page layers
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
