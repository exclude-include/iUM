"use client";

import { useMemo } from "react";
import { BookOpen, Code, Calculator, FileText, HelpCircle } from "lucide-react";
import { useAppStore, type CellType, type BookmarkRef } from "@/lib/store";
import { cn } from "@/lib/utils";

// Icon mapping for cell types
function CellTypeIcon({ type, className }: { type: CellType; className?: string }) {
  const iconClass = cn("h-3 w-3", className);

  switch (type) {
    case "concept":
      return <BookOpen className={iconClass} />;
    case "code":
      return <Code className={iconClass} />;
    case "math":
      return <Calculator className={iconClass} />;
    case "summary":
      return <FileText className={iconClass} />;
    case "quiz":
      return <HelpCircle className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
}

export function BookmarksSection() {
  const { notebookTabs, navigateToCell } = useAppStore();

  // Compute bookmarks from all tabs
  const bookmarks = useMemo(() => {
    const refs: BookmarkRef[] = [];
    notebookTabs.forEach((tab) => {
      tab.cells.forEach((cell) => {
        if (cell.isBookmarked) {
          refs.push({
            cellId: cell.id,
            tabId: tab.id,
            cellTitle: cell.title,
            cellType: cell.type,
          });
        }
      });
    });
    return refs;
  }, [notebookTabs]);

  if (bookmarks.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground px-2 py-1 italic">
        No bookmarks yet. Click the bookmark icon on any cell to add one.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {bookmarks.map((bookmark) => (
        <button
          key={`${bookmark.tabId}-${bookmark.cellId}`}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-accent rounded transition-colors text-left"
          onClick={() => navigateToCell(bookmark.tabId, bookmark.cellId)}
          title={`Go to: ${bookmark.cellTitle}`}
        >
          <CellTypeIcon type={bookmark.cellType} className="text-muted-foreground flex-shrink-0" />
          <span className="truncate flex-1">{bookmark.cellTitle}</span>
          <span className="text-[10px] text-muted-foreground uppercase flex-shrink-0">
            {bookmark.cellType}
          </span>
        </button>
      ))}
    </div>
  );
}
