"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeepModeCursorProps {
    visible: boolean;
    progress: number; // 0 to 100
    position: { x: number; y: number } | null;
}

export function DeepModeCursor({ visible, progress, position }: DeepModeCursorProps) {
    if (!visible || !position) return null;

    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div
            className="fixed pointer-events-none z-50 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300"
            style={{
                left: position.x,
                top: position.y,
                opacity: visible ? 1 : 0,
            }}
        >
            <div className="relative flex items-center justify-center w-12 h-12 bg-background/80 backdrop-blur-sm rounded-full shadow-lg border border-primary/20">
                {/* Progress Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                    <circle
                        cx="24"
                        cy="24"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-muted/30"
                    />
                    <circle
                        cx="24"
                        cy="24"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-primary transition-all duration-100 ease-linear"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Icon */}
                <Sparkles className={cn(
                    "w-5 h-5 text-primary transition-all duration-300",
                    progress >= 100 ? "scale-125 animate-pulse" : "scale-100"
                )} />
            </div>
        </div>
    );
}
