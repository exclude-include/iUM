"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smile, Frown, Meh, Laugh, Angry } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const moods = [
  { icon: Laugh, label: "Great", value: "great" },
  { icon: Smile, label: "Good", value: "good" },
  { icon: Meh, label: "Okay", value: "okay" },
  { icon: Frown, label: "Bad", value: "bad" },
  { icon: Angry, label: "Terrible", value: "terrible" },
];

export function RightStatus() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  const handleMoodClick = (value: string) => {
    setSelectedMood(value);
  };

  const handleMessageClick = () => {
    router.push("/");
  };

  return (
    <div className="flex h-full w-64 flex-col border-l bg-background p-6">
      {/* Status Indicators */}
      <div className="mb-6">
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Today's Mood
        </h3>
        <div className="flex gap-2">
          {moods.map((mood) => {
            const Icon = mood.icon;
            const isSelected = selectedMood === mood.value;
            return (
              <button
                key={mood.value}
                onClick={() => handleMoodClick(mood.value)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 scale-110"
                    : "border-border hover:border-primary/50 hover:scale-105"
                )}
                title={mood.label}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Text */}
      <div className="mb-6 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          The record hasn't been broken yet. 😫
        </p>
      </div>

      {/* Floating Button */}
      <div className="mt-auto">
        <Button
          onClick={handleMessageClick}
          className="w-full"
          size="lg"
        >
          Ask Tutor
        </Button>
      </div>
    </div>
  );
}

