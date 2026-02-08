"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Smile, LogOut, FolderOpen, Upload, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface ProfileMenuProps {
  onUploadClick?: () => void;
}

export function ProfileMenu({ onUploadClick }: ProfileMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      
      setIsOpen(false);
      router.push("/");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const handleSignIn = () => {
    router.push("/login");
  };

  const getUserDisplayName = () => {
    if (!user) return "User";
    return user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  };

  const getUserInitials = () => {
    if (!user) return "?";
    const displayName = getUserDisplayName();
    if (displayName !== "User") {
      return displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email?.charAt(0).toUpperCase() || "?";
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg hover:bg-accent"
        >
          {user ? (
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Smile className="h-5 w-5 text-yellow-500" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>
            {user ? "Profile" : "Sign in to iUM"}
          </SheetTitle>
          <SheetDescription>
            {user
              ? "Manage your account and preferences"
              : "Sign in to access all features"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {user ? (
            <>
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user.user_metadata?.avatar_url} alt={getUserDisplayName()} />
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {getUserDisplayName()}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Menu Options */}
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to workspace view
                    window.dispatchEvent(new CustomEvent("navigate-to-hard"));
                  }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  My Workspace
                </Button>

                {onUploadClick && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setIsOpen(false);
                      onUploadClick();
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Reel
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/settings");
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </div>

              <Separator />

              {/* Sign Out */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>

              {/* Google Drive Status */}
              {user.app_metadata?.provider === "google" && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    ✓ Google Drive Connected
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can now upload files from Google Drive
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Sign In Prompt */}
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  Sign in to access your workspace, upload reels, and connect with Google Drive.
                </p>
                <Button className="w-full" onClick={handleSignIn}>
                  Sign In
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
