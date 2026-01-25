"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/store";

interface QuizViewProps {
  questions: QuizQuestion[];
}

export function QuizView({ questions }: QuizViewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<Map<number, { optionId: string; isCorrect: boolean }>>(new Map());
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasAnswered = selectedOptionId !== null;

  const handleOptionClick = (optionId: string) => {
    if (showExplanation) return; // Prevent changing answer after submission

    setSelectedOptionId(optionId);
    const selectedOption = currentQuestion.options.find((opt) => opt.id === optionId);
    const isCorrect = selectedOption?.is_correct || false;

    // Save the answer
    setAnswers((prev) => {
      const newMap = new Map(prev);
      newMap.set(currentQuestionIndex, { optionId, isCorrect });
      return newMap;
    });

    // Show explanation immediately
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setIsComplete(true);
    } else {
      // Move to next question
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setShowExplanation(false);
    }
  };

  const handleReset = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setShowExplanation(false);
    setAnswers(new Map());
    setIsComplete(false);
  };

  // Calculate score
  const score = Array.from(answers.values()).filter((answer) => answer.isCorrect).length;
  const totalQuestions = questions.length;

  if (isComplete) {
    return (
      <Card className="p-8 bg-background border-border">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">Quiz Complete!</h2>
            <p className="text-lg text-muted-foreground">
              You got <span className="font-semibold text-primary">{score}</span> out of{" "}
              <span className="font-semibold">{totalQuestions}</span> questions correct!
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <div
              className={cn(
                "text-4xl font-bold",
                score === totalQuestions
                  ? "text-green-600 dark:text-green-400"
                  : score >= totalQuestions * 0.7
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-orange-600 dark:text-orange-400"
              )}
            >
              {Math.round((score / totalQuestions) * 100)}%
            </div>
          </div>

          {/* Review answers */}
          <div className="mt-8 space-y-4 text-left">
            <h3 className="text-lg font-semibold">Review Your Answers:</h3>
            {questions.map((question, idx) => {
              const userAnswer = answers.get(idx);
              const userOption = userAnswer
                ? question.options.find((opt) => opt.id === userAnswer.optionId)
                : null;

              return (
                <Card key={question.id} className="p-4 border-border">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-sm">Q{idx + 1}:</span>
                      <p className="text-sm flex-1">{question.question_text}</p>
                      {userAnswer?.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                      )}
                    </div>

                    <div className="ml-6 space-y-1">
                      {question.options.map((option) => {
                        const isUserChoice = userOption?.id === option.id;
                        const isCorrect = option.is_correct;

                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "text-xs px-2 py-1 rounded",
                              isCorrect && "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
                              isUserChoice && !isCorrect && "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
                              isUserChoice && isCorrect && "font-semibold"
                            )}
                          >
                            {option.id}. {option.text}
                            {isCorrect && " ✓"}
                            {isUserChoice && !isCorrect && " ✗"}
                          </div>
                        );
                      })}
                    </div>

                    <div className="ml-6 mt-2 p-2 bg-muted rounded text-xs">
                      <span className="font-medium">Explanation: </span>
                      {question.explanation}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Button onClick={handleReset} className="mt-6" variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake Quiz
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-background border-border">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          <span>
            Score: {score}/{totalQuestions}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          {currentQuestion.question_text}
        </h2>

        {/* Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const isCorrect = option.is_correct;
            const showCorrect = showExplanation && isCorrect;
            const showIncorrect = showExplanation && isSelected && !isCorrect;

            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                disabled={showExplanation}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all",
                  "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-100",
                  !showExplanation && isSelected && "border-primary bg-primary/10",
                  showCorrect && "border-green-500 bg-green-50 dark:bg-green-900/20",
                  showIncorrect && "border-red-500 bg-red-50 dark:bg-red-900/20",
                  !isSelected && !showExplanation && "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 font-semibold text-sm shrink-0",
                      showCorrect && "border-green-500 bg-green-500 text-white",
                      showIncorrect && "border-red-500 bg-red-500 text-white",
                      !showExplanation && isSelected && "border-primary bg-primary text-primary-foreground",
                      !isSelected && !showExplanation && "border-border"
                    )}
                  >
                    {option.id}
                  </div>
                  <span className="flex-1 text-sm">{option.text}</span>
                  {showCorrect && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
                  {showIncorrect && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && (
        <Card className="p-4 mb-6 bg-muted border-border">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Explanation:</p>
            <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
          </div>
        </Card>
      )}

      {/* Next button */}
      {showExplanation && (
        <div className="flex justify-end">
          <Button onClick={handleNext} className="min-w-[120px]">
            {isLastQuestion ? "Finish Quiz" : "Next Question"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </Card>
  );
}

