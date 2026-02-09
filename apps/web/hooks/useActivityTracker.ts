/**
 * useActivityTracker - Hook for tracking user learning activities
 * Sends events to the backend API for analytics and streak tracking
 */

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type ActivityEventType =
    | "cell_created"
    | "quiz_submitted"
    | "chat_message"
    | "document_uploaded"
    | "session_start"
    | "session_end";

interface ActivityMetadata {
    cell_type?: string;
    quiz_score?: number;
    duration_seconds?: number;
    topic?: string;
    folder_id?: string;
    [key: string]: any;
}

export function useActivityTracker() {
    const sessionStartTime = useRef<number | null>(null);

    /**
     * Track an activity event
     */
    const trackEvent = useCallback(async (
        eventType: ActivityEventType,
        metadata?: ActivityMetadata
    ) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                // Not logged in, skip tracking
                return;
            }

            await fetch(`${API_BASE_URL}/api/activities/log`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    event_type: eventType,
                    metadata: metadata || {},
                }),
            });
        } catch (error) {
            // Silently fail - activity tracking should not block user actions
            console.warn("[ActivityTracker] Failed to log event:", error);
        }
    }, []);

    /**
     * Track session start
     */
    const trackSessionStart = useCallback(() => {
        sessionStartTime.current = Date.now();
        trackEvent("session_start");
    }, [trackEvent]);

    /**
     * Track session end with duration
     */
    const trackSessionEnd = useCallback(() => {
        const duration = sessionStartTime.current
            ? Math.floor((Date.now() - sessionStartTime.current) / 1000)
            : 0;

        trackEvent("session_end", { duration_seconds: duration });
        sessionStartTime.current = null;
    }, [trackEvent]);

    /**
     * Track cell creation
     */
    const trackCellCreated = useCallback((cellType: string, topic?: string) => {
        trackEvent("cell_created", { cell_type: cellType, topic });
    }, [trackEvent]);

    /**
     * Track quiz submission
     */
    const trackQuizSubmitted = useCallback((score: number, totalQuestions: number) => {
        const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
        trackEvent("quiz_submitted", {
            quiz_score: percentage,
            correct_answers: score,
            total_questions: totalQuestions,
        });
    }, [trackEvent]);

    /**
     * Track chat message sent
     */
    const trackChatMessage = useCallback((folderId?: string) => {
        trackEvent("chat_message", { folder_id: folderId });
    }, [trackEvent]);

    /**
     * Track document upload
     */
    const trackDocumentUploaded = useCallback((folderId?: string, fileType?: string) => {
        trackEvent("document_uploaded", { folder_id: folderId, file_type: fileType });
    }, [trackEvent]);

    // Auto-track session start on mount (optional - can be called manually)
    useEffect(() => {
        // Track session end on page unload
        const handleBeforeUnload = () => {
            trackSessionEnd();
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [trackSessionEnd]);

    return {
        trackEvent,
        trackSessionStart,
        trackSessionEnd,
        trackCellCreated,
        trackQuizSubmitted,
        trackChatMessage,
        trackDocumentUploaded,
    };
}

/**
 * Activity Stats API - fetch stats and streak data
 */
export const activitiesApi = {
    async getStats(token: string) {
        const response = await fetch(`${API_BASE_URL}/api/activities/stats`, {
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn("[ActivityTracker] getStats: Session expired or unauthorized");
                return null;
            }
            throw new Error("Failed to fetch stats");
        }
        return response.json();
    },

    async getStreak(token: string) {
        const response = await fetch(`${API_BASE_URL}/api/activities/streak`, {
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn("[ActivityTracker] getStreak: Session expired or unauthorized");
                return null;
            }
            throw new Error("Failed to fetch streak");
        }
        return response.json();
    },
};
