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

const SPOTLIGHT_PADDING = 12;
const SPOTLIGHT_RADIUS = 16;
const OVERLAY_COLOR = "rgba(0, 0, 0, 0.52)";

interface TutorialOverlayProps {
  userId: string | undefined;
  onComplete: () => void;
}

export function TutorialOverlay({ userId, onComplete }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

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

  useEffect(() => {
    const t = setTimeout(measureTarget, 180);
    return () => clearTimeout(t);
  }, [stepIndex, measureTarget]);

  const handleNext = () => {
    if (isLast) {
      setTutorialCompleted(userId);
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleSkip = () => {
    setTutorialCompleted(userId);
    onComplete();
  };

  if (!currentStep) return null;

  const padding = SPOTLIGHT_PADDING;
  const hole = targetRect
    ? {
        x: targetRect.left - padding,
        y: targetRect.top - padding,
        w: targetRect.width + padding * 2,
        h: targetRect.height + padding * 2,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      aria-modal="true"
      role="dialog"
      aria-label="Tutorial"
    >
      {/* Dimmed overlay with rounded spotlight hole via SVG mask */}
      <div className="absolute inset-0 pointer-events-none">
        {hole && typeof document !== "undefined" ? (
          <svg
            className="absolute inset-0 h-full w-full"
            width="100%"
            height="100%"
            style={{ overflow: "hidden" }}
          >
            <defs>
              <mask id="tutorial-spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={hole.x}
                  y={hole.y}
                  width={hole.w}
                  height={hole.h}
                  rx={SPOTLIGHT_RADIUS}
                  ry={SPOTLIGHT_RADIUS}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill={OVERLAY_COLOR}
              mask="url(#tutorial-spotlight-mask)"
            />
          </svg>
        ) : (
          <div className="absolute inset-0" style={{ background: OVERLAY_COLOR }} />
        )}
      </div>

      {/* Rounded highlight ring */}
      {targetRect && (
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute pointer-events-none rounded-2xl border-2 border-sky-400/90 shadow-[0_0_0_2px_rgba(56,189,248,0.2)]"
          style={{
            left: targetRect.left - SPOTLIGHT_PADDING,
            top: targetRect.top - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            borderRadius: SPOTLIGHT_RADIUS,
          }}
        />
      )}

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

  if (targetRect && typeof window !== "undefined") {
    const gap = 20;
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
    // 보정: 튜토리얼 카드가 오른쪽으로 밀려 보이지 않도록 왼쪽으로 이동 (메뉴바 두께 정도)
    left -= 28;
    left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - 200));
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="absolute z-10 rounded-2xl border border-sky-200/80 bg-white p-4 shadow-xl"
        style={{
          left,
          top,
          width: cardWidth,
          boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(14,165,233,0.08)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{stepLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 -mr-1 text-slate-500 hover:text-slate-700"
            onClick={onSkip}
            aria-label="Skip"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="mb-1.5 text-sm font-semibold text-slate-800">{step.title}</h3>
        <p className="mb-4 text-xs leading-relaxed text-slate-600">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-slate-600 hover:text-slate-800"
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                Back
              </Button>
            )}
          </div>
          <Button
            size="sm"
            onClick={onNext}
            className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white"
          >
            {isLast ? "Get started" : "Next"}
            {!isLast && <ChevronRight className="h-4 w-4 ml-0.5" />}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
