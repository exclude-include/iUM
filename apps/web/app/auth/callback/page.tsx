"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // Supabase client will automatically detect the session from URL hash
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("Auth error:", error);
                    setError(error.message);
                    return;
                }

                if (data.session) {
                    // Session exists, redirect to home
                    router.replace("/");
                    router.refresh();
                } else {
                    // No session, try to exchange the hash for a session
                    // This handles the case where tokens are in the URL hash
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const accessToken = hashParams.get("access_token");
                    const refreshToken = hashParams.get("refresh_token");

                    if (accessToken && refreshToken) {
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (sessionError) {
                            console.error("Session error:", sessionError);
                            setError(sessionError.message);
                            return;
                        }

                        router.replace("/");
                        router.refresh();
                    } else {
                        setError("No authentication tokens found");
                    }
                }
            } catch (err: any) {
                console.error("Callback error:", err);
                setError(err.message || "Authentication failed");
            }
        };

        handleAuthCallback();
    }, [router]);

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Authentication Error</h1>
                    <p className="text-muted-foreground">{error}</p>
                    <button
                        onClick={() => router.push("/login")}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Completing sign in...</p>
            </div>
        </div>
    );
}
