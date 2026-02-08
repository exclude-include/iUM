"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { OnboardingLanding } from "@/components/onboarding/OnboardingLanding";
import { TutorialOverlay } from "@/components/onboarding/TutorialOverlay";
import { useAuth } from "@/hooks/use-auth";
import { isTutorialCompleted } from "@/components/onboarding/tutorialSteps";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [showTutorial, setShowTutorial] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authLoading && user && showTutorial === null) {
      setShowTutorial(!isTutorialCompleted(user.id));
    }
  }, [authLoading, user, showTutorial]);

  const handleTutorialComplete = () => setShowTutorial(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <OnboardingLanding />;
  }

  return (
    <>
      <MainLayout>
        <div />
      </MainLayout>
      {showTutorial === true && (
        <TutorialOverlay
          userId={user.id}
          onComplete={handleTutorialComplete}
        />
      )}
    </>
  );
}
