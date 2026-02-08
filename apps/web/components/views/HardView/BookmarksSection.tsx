"use client";

import { useMemo, useState, useCallback } from "react";
import { BookOpen, Code, Calculator, FileText, HelpCircle, BookmarkPlus } from "lucide-react";
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

const DEEP_CARD_MIME = "application/ium-deep-card";

export function BookmarksSection() {
  const { notebookTabs, navigateToCell, deepHistory, appendCellToActiveTab, toggleBookmark, notebookActiveTabId } = useAppStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const cardId = e.dataTransfer.getData(DEEP_CARD_MIME);
      if (!cardId) return;
      const card = deepHistory.find((c) => c.id === cardId);
      if (!card) return;
      const unit = {
        title: card.title,
        type: card.type,
        content: card.content,
        equations: card.equations,
        diagram_description: card.diagram_description,
        mermaid_code: card.mermaid_code,
        graph_data: card.graph_data,
        quiz_data: card.quiz_data,
        fromDeep: true,
      };
      const newCellId = appendCellToActiveTab(unit);
      const tabId = notebookActiveTabId;
      if (tabId && newCellId) {
        toggleBookmark(tabId, newCellId);
        setJustAddedId(`${tabId}-${newCellId}`);
        setTimeout(() => setJustAddedId(null), 1200);
      }
    },
    [deepHistory, appendCellToActiveTab, toggleBookmark, notebookActiveTabId]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes(DEEP_CARD_MIME)) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);

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
            tags: cell.fromDeep ? ["deep"] : undefined,
          });
        }
      });
    });
    return refs;
  }, [notebookTabs]);

  const dropZoneClass = cn(
    "min-h-[60px] rounded-md border-2 border-dashed transition-colors duration-200",
    isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/20 hover:border-muted-foreground/40"
  );

  if (bookmarks.length === 0) {
    return (
      <div
        className={cn("px-2 py-3 text-center", dropZoneClass)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <BookmarkPlus className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
        <p className="text-[10px] text-muted-foreground italic">
          No bookmarks yet. Drag a Deep response here or click the bookmark icon on any cell.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-0.5 rounded-md p-1 transition-colors", isDragOver && "bg-primary/5 ring-1 ring-primary/20")}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {bookmarks.map((bookmark) => {
        const key = `${bookmark.tabId}-${bookmark.cellId}`;
        const isJustAdded = justAddedId === key;
        return (
          <button
            key={key}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-accent rounded transition-all duration-300 text-left",
              isJustAdded && "animate-in fade-in-0 slide-in-from-top-2 bg-primary/10"
            )}
            onClick={() => navigateToCell(bookmark.tabId, bookmark.cellId)}
            title={`Go to: ${bookmark.cellTitle}`}
          >
            <CellTypeIcon type={bookmark.cellType} className="text-muted-foreground flex-shrink-0" />
            <span className="truncate flex-1">{bookmark.cellTitle}</span>
            <span className="text-[10px] text-muted-foreground uppercase flex-shrink-0">
              {bookmark.cellType}
            </span>
            {bookmark.tags?.includes("deep") && (
              <span className="text-[10px] text-primary font-medium flex-shrink-0" title="Added from Deep">
                deep
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
