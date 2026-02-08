"use client";

import React from "react";
import { Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface TextSelectionMenuProps {
    position: { top: number; left: number } | null;
    onCopy: () => void;
    onDeepDive: () => void;
    visible: boolean;
}

export function TextSelectionMenu({ position, onCopy, onDeepDive, visible }: TextSelectionMenuProps) {
    if (!visible || !position) return null;

    return (
        <div
            className="fixed z-50 flex items-center p-1 gap-1 bg-background border border-border shadow-md rounded-md animate-in fade-in zoom-in duration-200"
            style={{
                top: position.top,
                left: position.left,
                transform: "translate(-50%, -100%) translateY(-8px)", // Center above selection
            }}
            onMouseDown={(e) => e.stopPropagation()} // Prevent deselection when clicking menu
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-muted"
                            onClick={onCopy}
                        >
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Copy</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy Text</TooltipContent>
                </Tooltip>

                <div className="w-px h-4 bg-border mx-0.5" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 gap-1.5 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400"
                            onClick={onDeepDive}
                        >
                            <Sparkles className="h-4 w-4" />
                            <span className="text-xs font-medium">Deep Dive</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate detailed explanation</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
