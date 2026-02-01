"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

interface PickerFile {
    id: string;
    name: string;
    mimeType: string;
    url: string;
}

interface UseGooglePickerOptions {
    onFilePicked: (file: PickerFile) => void;
    onError?: (error: Error) => void;
    mimeTypes?: string[];
}

export function useGooglePicker({ onFilePicked, onError, mimeTypes }: UseGooglePickerOptions) {
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Load Google API scripts
    useEffect(() => {
        const loadScript = (src: string, id: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (document.getElementById(id)) {
                    resolve();
                    return;
                }
                const script = document.createElement("script");
                script.id = id;
                script.src = src;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(script);
            });
        };

        const initGoogleApi = async () => {
            try {
                // Load Google API client for Picker
                await loadScript("https://apis.google.com/js/api.js", "google-api");

                // Wait for gapi to be available (polling)
                let attempts = 0;
                while (!window.gapi && attempts < 50) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                if (!window.gapi) {
                    throw new Error("Google API failed to load");
                }

                // Load picker
                await new Promise<void>((resolve) => {
                    window.gapi.load("picker", () => resolve());
                });

                setIsReady(true);
            } catch (error) {
                console.error("Failed to load Google APIs:", error);
                onError?.(error instanceof Error ? error : new Error("Failed to load Google APIs"));
            }
        };

        initGoogleApi();
    }, [onError]);

    // Open Google Picker using Supabase session token
    const openPicker = useCallback(async () => {
        if (!isReady) {
            onError?.(new Error("Google APIs not ready yet"));
            return;
        }

        setIsLoading(true);

        try {
            // Get access token from Supabase session (Google OAuth provider_token)
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                onError?.(new Error("Please log in with Google first"));
                setIsLoading(false);
                return;
            }

            const accessToken = session.provider_token;

            if (!accessToken) {
                onError?.(new Error("Google access token not found. Please log in with Google."));
                setIsLoading(false);
                return;
            }

            // Build picker view
            const docsView = new window.google.picker.DocsView()
                .setIncludeFolders(true)
                .setSelectFolderEnabled(false);

            // Apply MIME type filter if specified
            if (mimeTypes && mimeTypes.length > 0) {
                docsView.setMimeTypes(mimeTypes.join(","));
            }

            // Create and show picker (no API key needed when using OAuth token)
            const picker = new window.google.picker.PickerBuilder()
                .addView(docsView)
                .setOAuthToken(accessToken)
                .setCallback((data: any) => {
                    if (data.action === window.google.picker.Action.PICKED) {
                        const file = data.docs[0];
                        onFilePicked({
                            id: file.id,
                            name: file.name,
                            mimeType: file.mimeType,
                            url: file.url,
                        });
                    }
                })
                .setTitle("Select a file from Google Drive")
                .build();

            picker.setVisible(true);
        } catch (error) {
            console.error("Picker error:", error);
            onError?.(error instanceof Error ? error : new Error("Failed to open picker"));
        } finally {
            setIsLoading(false);
        }
    }, [isReady, onFilePicked, onError, mimeTypes]);

    return {
        openPicker,
        isLoading,
        isReady,
    };
}
