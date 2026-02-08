"use client";

import { useState, useEffect } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { KEYBOARD_SHORTCUTS } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsDialogProps {
  triggerClassName?: string;
  iconOnly?: boolean;
}

export function KeyboardShortcutsDialog({ triggerClassName, iconOnly = true }: KeyboardShortcutsDialogProps) {
  const [open, setOpen] = useState(false);

  // Listen for custom event to open dialog (from ? key press)
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("openKeyboardShortcuts", handleOpen);
    return () => window.removeEventListener("openKeyboardShortcuts", handleOpen);
  }, []);

  // Group shortcuts by category
  const groupedShortcuts = KEYBOARD_SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof KEYBOARD_SHORTCUTS[number][]>);

  const categoryLabels: Record<string, string> = {
    panels: "Panels",
    tabs: "Tabs",
    flashcard: "Flashcard",
    general: "General",
  };

  const categoryOrder = ["panels", "tabs", "flashcard", "general"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            iconOnly && "h-8 w-8",
            triggerClassName
          )}
          title="Keyboard Shortcuts"
        >
          <Keyboard className={cn("h-4 w-4", !iconOnly && "mr-2")} />
          {!iconOnly && "Shortcuts"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {categoryOrder.map((category) => {
            const shortcuts = groupedShortcuts[category];
            if (!shortcuts?.length) return null;

            return (
              <div key={category}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {categoryLabels[category] || category}
                </h4>
                <div className="space-y-1.5">
                  {shortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <kbd
                            key={keyIdx}
                            className={cn(
                              "inline-flex items-center justify-center",
                              "min-w-[24px] h-6 px-1.5",
                              "text-[11px] font-medium",
                              "bg-muted border border-border rounded",
                              "text-muted-foreground"
                            )}
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">?</kbd> anywhere to open this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
