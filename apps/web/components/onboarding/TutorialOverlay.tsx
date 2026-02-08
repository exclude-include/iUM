"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TUTORIAL_STEPS,
  setTutorialCompleted,
  type TutorialStep,
} from "./tutorialSteps";

const SPOTLIGHT_PADDING = 8;
const OVERLAY_COLOR = "rgba(0, 0, 0, 0.55)";

interface TutorialOverlayProps {
  userId: string | undefined;
  onComplete: () => void;
}

export function TutorialOverlay({ userId, onComplete }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(true);

  const steps = TUTORIAL_STEPS;
  const currentStep = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const measureTarget = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tutorial="${currentStep.id}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
    setIsMeasuring(false);
  }, [currentStep?.id]);

  useEffect(() => {
    measureTarget();
    const ro = new ResizeObserver(measureTarget);
    ro.observe(document.body);
    window.addEventListener("scroll", measureTarget, true);
    window.addEventListener("resize", measureTarget);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measureTarget, true);
      window.removeEventListener("resize", measureTarget);
    };
  }, [measureTarget]);

  // Small delay so DOM is ready for first step
  useEffect(() => {
    const t = setTimeout(measureTarget, 150);
    return () => clearTimeout(t);
  }, [stepIndex, measureTarget]);

  const handleNext = () => {
    if (isLast) {
      setTutorialCompleted(userId);
      onComplete();
    } else {
      setIsMeasuring(true);
      setStepIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    setIsMeasuring(true);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleSkip = () => {
    setTutorialCompleted(userId);
    onComplete();
  };

  if (!currentStep) return null;

  // Dimmed regions around spotlight (top, left, right, bottom) so we don't rely on clip-path holes
  const padding = SPOTLIGHT_PADDING;
  const hole = targetRect
    ? {
        left: targetRect.left - padding,
        top: targetRect.top - padding,
        right: targetRect.right + padding,
        bottom: targetRect.bottom + padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      aria-modal="true"
      role="dialog"
      aria-label="사용법 안내"
    >
      {/* Dimmed overlay: four strips around the spotlight hole */}
      <div className="absolute inset-0 pointer-events-none">
        {hole ? (
          <>
            <div
              className="absolute left-0 right-0 top-0"
              style={{ height: hole.top, background: OVERLAY_COLOR }}
            />
            <div
              className="absolute left-0 top-0"
              style={{
                top: hole.top,
                width: hole.left,
                height: hole.height,
                background: OVERLAY_COLOR,
              }}
            />
            <div
              className="absolute right-0 top-0"
              style={{
                top: hole.top,
                left: hole.right,
                right: 0,
                height: hole.height,
                background: OVERLAY_COLOR,
              }}
            />
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{ top: hole.bottom, height: `calc(100vh - ${hole.bottom}px)`, background: OVERLAY_COLOR }}
            />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: OVERLAY_COLOR }} />
        )}
      </div>

      {/* Highlight ring around target */}
      {targetRect && (
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute pointer-events-none rounded-lg border-2 border-primary ring-2 ring-primary/30"
          style={{
            left: targetRect.left - SPOTLIGHT_PADDING,
            top: targetRect.top - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      )}

      {/* Tooltip card - positioned near spotlight */}
      <TooltipCard
        step={currentStep}
        targetRect={targetRect}
        stepLabel={`${stepIndex + 1} / ${steps.length}`}
        isFirst={isFirst}
        isLast={isLast}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleSkip}
      />
    </div>
  );
}

interface TooltipCardProps {
  step: TutorialStep;
  targetRect: DOMRect | null;
  stepLabel: string;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function TooltipCard({
  step,
  targetRect,
  stepLabel,
  isFirst,
  isLast,
  onNext,
  onBack,
  onSkip,
}: TooltipCardProps) {
  const placement = step.placement ?? "bottom";
  const cardWidth = 320;

  let left = typeof window !== "undefined" ? window.innerWidth / 2 - cardWidth / 2 : 0;
  let top = typeof window !== "undefined" ? window.innerHeight - 180 : 0;

  if (targetRect) {
    const gap = 16;
    switch (placement) {
      case "right":
        left = targetRect.right + gap;
        top = targetRect.top + targetRect.height / 2 - 80;
        break;
      case "left":
        left = targetRect.left - cardWidth - gap;
        top = targetRect.top + targetRect.height / 2 - 80;
        break;
      case "top":
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
        top = targetRect.top - 180 - gap;
        break;
      default:
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
        top = targetRect.bottom + gap;
    }
    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - 200));
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="absolute z-10 rounded-xl border bg-card p-4 shadow-xl"
        style={{
          left,
          top,
          width: cardWidth,
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {stepLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 -mr-1"
            onClick={onSkip}
            aria-label="건너뛰기"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="mb-1.5 text-sm font-semibold">{step.title}</h3>
        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div>
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                이전
              </Button>
            )}
          </div>
          <Button size="sm" onClick={onNext}>
            {isLast ? "시작하기" : "다음"}
            {!isLast && <ChevronRight className="h-4 w-4 ml-0.5" />}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
