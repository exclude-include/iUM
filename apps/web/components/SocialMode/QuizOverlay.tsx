"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReelQuiz } from "@/types/api";

function normalizeQuizMath(text: string): string {
  if (!text || typeof text !== "string") return text;
  let s = text.replace(/\$\s+/g, "$").replace(/\s+\$/g, "$").replace(/\\\$/g, "$");
  const greekNames = "eta|beta|alpha|gamma|delta|theta|sigma|omega|mu|nu|pi|rho|tau|phi|chi|psi|epsilon|zeta|xi|lambda";
  s = s.replace(new RegExp(`\\$\\s*(${greekNames})\\s*\\$`, "g"), (_, name: string) => `$\\${name}$`);
  return s;
}

function QuizMathText({ text, className }: { text: string; className?: string }) {
  const normalized = normalizeQuizMath(text);
  return (
    <span className={cn("quiz-math-inline", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={{
          p: ({ children }) => <span>{children}</span>,
          span: ({ children }) => <span>{children}</span>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </span>
  );
}

interface QuizOverlayProps {
  quiz: ReelQuiz;
  onCorrectAnswer: () => void;
  onClose: () => void;
}

type AnswerState = "unanswered" | "correct" | "incorrect";

export function QuizOverlay({ quiz, onCorrectAnswer, onClose }: QuizOverlayProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered");
  const [showExplanation, setShowExplanation] = useState(false);

  const handleOptionSelect = (optionKey: string) => {
    if (answerState !== "unanswered") return;

    setSelectedOption(optionKey);

    if (optionKey === quiz.answer) {
      setAnswerState("correct");
      // Auto-close after correct answer
      setTimeout(() => {
        onCorrectAnswer();
        onClose();
      }, 1500);
    } else {
      setAnswerState("incorrect");
      setShowExplanation(true);
    }
  };

  const handleRetry = () => {
    setSelectedOption(null);
    setAnswerState("unanswered");
    setShowExplanation(false);
  };

  const getOptionStyle = (optionKey: string) => {
    if (answerState === "unanswered") {
      return selectedOption === optionKey
        ? "border-primary bg-primary/20"
        : "border-white/30 bg-white/10 hover:bg-white/20";
    }

    if (optionKey === quiz.answer) {
      return "border-green-500 bg-green-500/30";
    }

    if (selectedOption === optionKey && answerState === "incorrect") {
      return "border-red-500 bg-red-500/30";
    }

    return "border-white/20 bg-white/5 opacity-50";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-[350px] mx-4 max-h-[85vh] flex flex-col rounded-2xl bg-gradient-to-b from-gray-900/95 to-gray-800/95 shadow-2xl border border-white/10 overflow-hidden"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Scrollable area so long quiz + hint don't get cut off (reel scroll = trackpad; inner drag scrollbar for quiz) */}
        <div className="quiz-overlay-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">
        {/* Question */}
        <div className="mb-6">
          <p className="text-xs font-medium text-primary mb-2 uppercase tracking-wider">
            Quiz Time!
          </p>
          <p className="text-lg font-semibold text-white leading-relaxed">
            <QuizMathText text={quiz.question} />
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {quiz.options.map((option) => (
            <motion.button
              key={option.key}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleOptionSelect(option.key)}
              disabled={answerState !== "unanswered"}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                getOptionStyle(option.key)
              )}
            >
              <span
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                  answerState !== "unanswered" && option.key === quiz.answer
                    ? "bg-green-500 text-white"
                    : selectedOption === option.key && answerState === "incorrect"
                      ? "bg-red-500 text-white"
                      : "bg-white/20 text-white"
                )}
              >
                {option.key}
              </span>
              <span className="text-white text-sm flex-1"><QuizMathText text={option.text} /></span>
              {answerState !== "unanswered" && option.key === quiz.answer && (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
              {selectedOption === option.key && answerState === "incorrect" && (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              )}
            </motion.button>
          ))}
        </div>

        {/* Feedback */}
        <AnimatePresence mode="wait">
          {answerState === "correct" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-green-500/20 border border-green-500/30"
            >
              <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-green-400 font-semibold">Correct!</p>
                <p className="text-green-300/80 text-sm">Great job! Resuming video...</p>
              </div>
            </motion.div>
          )}

          {answerState === "incorrect" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-400 font-semibold">Not quite right</p>
                  <p className="text-red-300/80 text-sm">Try again!</p>
                </div>
              </div>

              {/* Explanation/Hint */}
              {showExplanation && quiz.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/20 border border-amber-500/30"
                >
                  <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium text-sm">Hint</p>
                    <p className="text-amber-200/80 text-sm"><QuizMathText text={quiz.explanation || ""} /></p>
                  </div>
                </motion.div>
              )}

              <Button
                onClick={handleRetry}
                className="w-full bg-white/20 text-white border border-white/30 hover:bg-white/30"
              >
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
