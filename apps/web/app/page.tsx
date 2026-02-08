"use client";

import { useState, useEffect } from "react";
import { OnboardingLanding } from "@/components/onboarding/OnboardingLanding";
import { HardLearningView } from "@/components/views/HardLearningView";
import { TutorialOverlay } from "@/components/onboarding/TutorialOverlay";
import { useAuth } from "@/hooks/use-auth";
import { isTutorialCompleted } from "@/components/onboarding/tutorialSteps";

export default function Home() {
  const { user } = useAuth();
  const [showTutorial, setShowTutorial] = useState<boolean | null>(null);

  useEffect(() => {
    if (user && showTutorial === null) {
      setShowTutorial(!isTutorialCompleted(user.id));
    }
  }, [user, showTutorial]);

  const handleTutorialComplete = () => setShowTutorial(false);

  if (!user) {
    return <OnboardingLanding />;
  }

  return (
    <>
      <HardLearningView />
      {showTutorial === true && (
        <TutorialOverlay
          userId={user.id}
          onComplete={handleTutorialComplete}
        />
      )}
    </>
  );
}
