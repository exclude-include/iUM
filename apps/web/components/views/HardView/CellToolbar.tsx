"use client";

import { Bookmark, BookmarkCheck, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { CellType } from "@/lib/store";

interface CellToolbarProps {
  cellType: CellType;
  isBookmarked: boolean;
  onDelete: () => void;
  onBookmark: () => void;
  onMoveToNewTab: () => void;
}

export function CellToolbar({
  cellType,
  isBookmarked,
  onDelete,
  onBookmark,
  onMoveToNewTab,
}: CellToolbarProps) {
  return (
    <div className="absolute -top-3 right-2 z-10 opacity-90 group-hover:opacity-100 transition-opacity duration-200">
      <div className="flex items-center gap-1 bg-background border rounded-md shadow-sm px-1.5 py-0.5">
        {/* Type Badge */}
        <span className="text-[10px] text-muted-foreground px-2 uppercase font-medium">
          {cellType}
        </span>

        <Separator orientation="vertical" className="h-4" />

        {/* Bookmark Toggle */}
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

        {/* Move to New Tab */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveToNewTab}
          title="Move to new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>

        {/* Delete Cell */}
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
