"use client";

import { Bookmark, BookmarkCheck, ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { CellType } from "@/lib/store";
import { cn } from "@/lib/utils";

interface CellToolbarProps {
  cellType: CellType;
  isBookmarked: boolean;
  onDelete: () => void;
  onBookmark: () => void;
  onMoveToNewTab: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  floating?: boolean; // ✨ Toggle absolute vs static
  className?: string;
}

export function CellToolbar({
  cellType,
  isBookmarked,
  onDelete,
  onBookmark,
  onMoveToNewTab,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  floating = true,
  className,
}: CellToolbarProps) {
  return (
    <div className={cn(
      floating
        ? "absolute -top-3 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        : "flex items-center",
      className
    )}>
      <div className={cn(
        "flex items-center gap-1",
        floating
          ? "bg-background border rounded-md shadow-sm px-1.5 py-0.5"
          : ""
      )}>
        {/* Type Badge */}
        <span className="text-[10px] text-muted-foreground px-2 uppercase font-medium">
          {cellType}
        </span>

        <Separator orientation="vertical" className="h-4" />

        {/* ... Buttons ... */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onBookmark}
          title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
        >
          {isBookmarked ? (
            <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
        </Button>

        {onMoveUp && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Move cell up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
        )}

        {onMoveDown && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Move cell down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveToNewTab}
          title="Move to new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title="Delete cell"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
