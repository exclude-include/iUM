"use client";

import { useState, useEffect } from "react";
import { Flame, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { activitiesApi } from "@/hooks/useActivityTracker";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
    className?: string;
}

export function StreakBadge({ className }: StreakBadgeProps) {
    const [streak, setStreak] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStreak = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    setLoading(false);
                    return;
                }

                const data = await activitiesApi.getStreak(session.access_token);
                setStreak(data.current_streak);
            } catch (err) {
                console.warn("[StreakBadge] Failed to fetch streak:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStreak();
    }, []);

    if (loading) {
        return (
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-xs", className)}>
                <Loader2 className="h-3 w-3 animate-spin" />
            </div>
        );
    }

    if (streak === null) {
        return null;
    }

    return (
        <div
            className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all",
                streak > 0
                    ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                    : "bg-muted/50 text-muted-foreground",
                className
            )}
            title={`${streak} day streak`}
        >
            <Flame className={cn("h-3.5 w-3.5", streak > 0 && "text-orange-500")} />
            <span>{streak}</span>
        </div>
    );
}
