"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Grid3x3, Heart, Bookmark, Play } from "lucide-react";
import { useSocialStore } from "./useSocialStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function MyProfileView() {
  const { user } = useAuth();
  const router = useRouter();
  const { getMyReels, likedReels, bookmarkedReels, setCurrentView, setCurrentReelIndex } = useSocialStore();
  const [activeTab, setActiveTab] = useState("posts");
  
  const myReels = getMyReels();
  const likedReelsList = myReels.filter((reel) => likedReels.has(reel.id));
  const bookmarkedReelsList = myReels.filter((reel) => bookmarkedReels.has(reel.id));

  const getDisplayName = () => {
    if (!user) return "User";
    return user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  };

  const getUserInitials = () => {
    if (!user) return "?";
    const displayName = getDisplayName();
    return displayName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleReelClick = (reelIndex: number) => {
    setCurrentReelIndex(reelIndex);
    setCurrentView("feed");
  };

  const renderReelGrid = (reels: typeof myReels) => {
    if (reels.length === 0) {
      return (
        <div className="flex h-64 items-center justify-center text-center">
          <div>
            <p className="text-muted-foreground">No reels yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload your first reel to get started
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-1">
        {reels.map((reel, index) => (
          <button
            key={reel.id}
            onClick={() => handleReelClick(index)}
            className="relative aspect-square overflow-hidden rounded-sm bg-muted group hover:opacity-90 transition-opacity"
          >
            {reel.videoUrl ? (
              <div className="absolute inset-0 bg-black">
                <video
                  src={reel.videoUrl}
                  className="h-full w-full object-cover"
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="h-8 w-8 text-white" />
                </div>
              </div>
            ) : (
              <div
                className="h-full w-full"
                style={{ background: reel.color }}
              >
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <p className="text-white text-xs font-semibold line-clamp-3 text-center">
                    {reel.title}
                  </p>
                </div>
              </div>
            )}
            
            {/* Stats overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <div className="flex items-center gap-3 text-white text-xs">
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {reel.likes}
                </span>
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {reel.comments}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        {/* Profile Header */}
        <div className="flex items-center gap-6">
          <Avatar className="h-32 w-32">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={getDisplayName()} />
            <AvatarFallback className="text-3xl">{getUserInitials()}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">{getDisplayName()}</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/settings")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
            
            {/* Stats */}
            <div className="flex gap-8">
              <div>
                <span className="font-semibold">{myReels.length}</span>
                <span className="text-sm text-muted-foreground ml-1">posts</span>
              </div>
              <div>
                <span className="font-semibold">{likedReelsList.length}</span>
                <span className="text-sm text-muted-foreground ml-1">liked</span>
              </div>
              <div>
                <span className="font-semibold">{bookmarkedReelsList.length}</span>
                <span className="text-sm text-muted-foreground ml-1">saved</span>
              </div>
            </div>
            
            {/* Bio */}
            <div>
              <p className="text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1">
              <Grid3x3 className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="liked" className="flex-1">
              <Heart className="h-4 w-4 mr-2" />
              Liked
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex-1">
              <Bookmark className="h-4 w-4 mr-2" />
              Saved
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="posts" className="mt-6">
            {renderReelGrid(myReels)}
          </TabsContent>
          
          <TabsContent value="liked" className="mt-6">
            {renderReelGrid(likedReelsList)}
          </TabsContent>
          
          <TabsContent value="saved" className="mt-6">
            {renderReelGrid(bookmarkedReelsList)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
