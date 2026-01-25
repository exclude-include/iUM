"use client";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function HistoryTimeline() {
  const { timelineEvents } = useAppStore();

  // Blue/Indigo color theme
  const getBlueTheme = (index: number) => {
    // Cycle through blue/indigo variations
    const blueThemes = [
      "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
      "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
      "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100",
      "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
    ];
    return blueThemes[index % blueThemes.length];
  };

  // Group events by date for time labels (optional)
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (timelineEvents.length === 0) {
    return (
      <div className="px-2 py-3 text-center">
        <p className="text-xs text-muted-foreground">No study history yet</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-2">
      {/* Timeline Label */}
      <div className="mb-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Timeline
        </p>
      </div>

      {/* Horizontal Scrollable Container */}
      <div className="overflow-x-auto overflow-y-hidden px-1">
        <div className="flex items-center gap-2 min-w-fit pb-2 py-1">
          {/* Timeline Bars */}
          {timelineEvents.map((event, index) => {
            const colorClasses = getBlueTheme(index);
            return (
              <div
                key={event.id}
                className={cn(
                  "flex items-center justify-center rounded-md px-3 py-1.5 text-[10px] font-medium shrink-0",
                  "border shadow-sm whitespace-nowrap min-h-[32px] w-auto min-w-fit",
                  colorClasses
                )}
                title={`${event.title} - ${event.duration} min`}
              >
                <span className="text-center leading-tight">
                  {event.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional: Time Labels */}
      {timelineEvents.length > 0 && (
        <div className="mt-1 overflow-x-auto px-1">
          <div className="flex items-center gap-2 min-w-fit">
            {timelineEvents.map((event, index) => {
              // Only show time label for first event or when time changes significantly
              if (index === 0 || index % 3 === 0) {
                return (
                  <div
                    key={`time-${event.id}`}
                    className="text-[9px] text-muted-foreground shrink-0 w-auto min-w-fit"
                  >
                    {formatTime(event.startTime)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

