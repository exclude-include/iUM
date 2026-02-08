"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, BookOpen, MessageSquare, FileText, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { activitiesApi } from "@/hooks/useActivityTracker";

interface ActivityStats {
    total_activities: number;
    cells_created: number;
    quizzes_submitted: number;
    chat_messages: number;
    documents_uploaded: number;
    quiz_average_score: number | null;
    study_time_today_minutes: number;
    study_time_week_minutes: number;
    cell_type_distribution: Record<string, number>;
    daily_activity: { date: string; count: number }[];
}

interface StreakData {
    current_streak: number;
    longest_streak: number;
    last_study_date: string | null;
    streak_history: string[];
}

export function ActivityStatsPanel() {
    const [stats, setStats] = useState<ActivityStats | null>(null);
    const [streak, setStreak] = useState<StreakData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    setError("Please log in to view your stats");
                    setLoading(false);
                    return;
                }

                const [statsData, streakData] = await Promise.all([
                    activitiesApi.getStats(session.access_token),
                    activitiesApi.getStreak(session.access_token),
                ]);

                setStats(statsData);
                setStreak(streakData);
            } catch (err) {
                console.error("Failed to fetch activity data:", err);
                setError("Failed to load activity data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Streak Card */}
            <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-orange-500/20">
                            <Flame className="h-8 w-8 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold">{streak?.current_streak || 0}</p>
                            <p className="text-sm text-muted-foreground">Day Streak 🔥</p>
                        </div>
                        {streak && streak.longest_streak > 0 && (
                            <div className="ml-auto text-right">
                                <p className="text-lg font-semibold text-muted-foreground">
                                    Best: {streak.longest_streak}
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Study Time Today */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {stats?.study_time_today_minutes || 0}
                            <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                        </p>
                    </CardContent>
                </Card>

                {/* This Week */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            This Week
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {stats?.study_time_week_minutes || 0}
                            <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                        </p>
                    </CardContent>
                </Card>

                {/* Cells Created */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            Cells Created
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{stats?.cells_created || 0}</p>
                    </CardContent>
                </Card>

                {/* Chat Messages */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Chats
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{stats?.chat_messages || 0}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Activity Chart (Simple Bar Visualization) */}
            {stats?.daily_activity && stats.daily_activity.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Weekly Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between gap-1 h-16">
                            {stats.daily_activity.map((day) => {
                                const maxCount = Math.max(...stats.daily_activity.map(d => d.count), 1);
                                const height = (day.count / maxCount) * 100;
                                const dayLabel = new Date(day.date).toLocaleDateString("en-US", { weekday: "short" });

                                return (
                                    <div key={day.date} className="flex flex-col items-center flex-1">
                                        <div
                                            className="w-full bg-primary/80 rounded-t-sm transition-all"
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                            title={`${day.count} activities`}
                                        />
                                        <span className="text-[10px] text-muted-foreground mt-1">
                                            {dayLabel.charAt(0)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quiz Average */}
            {stats && stats.quiz_average_score !== null && stats.quiz_average_score !== undefined && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Quiz Average
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {stats.quiz_average_score.toFixed(0)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {stats.quizzes_submitted} quizzes completed
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
