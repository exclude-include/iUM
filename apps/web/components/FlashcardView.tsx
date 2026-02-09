"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw, Layers } from "lucide-react";

interface Flashcard {
    front: string;
    back: string;
}

interface FlashcardViewProps {
    cards: Flashcard[];
}

export function FlashcardView({ cards }: FlashcardViewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentCard = cards[currentIndex];

    const handleNext = useCallback(() => {
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, [cards.length]);

    const handlePrev = useCallback(() => {
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, [cards.length]);

    const handleFlip = useCallback(() => {
        setIsFlipped((prev) => !prev);
    }, []);

    // Keyboard navigation - only when focused
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ✨ Only handle keys when flashcard component is focused
            if (!isFocused) return;
            
            // ✨ Don't interfere with input fields
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
                return;
            }
            
            if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                handleFlip();
            } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                handleNext();
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                handlePrev();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleFlip, handleNext, handlePrev, isFocused]);

    if (!cards || cards.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Layers className="w-5 h-5 mr-2" />
                No flashcards available.
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            tabIndex={0}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
                "flex flex-col items-center w-full max-w-lg mx-auto py-4 outline-none",
                isFocused && "ring-2 ring-primary/30 rounded-lg"
            )}
        >
            {/* Card Container with 3D Perspective */}
            <div 
                className="relative w-full aspect-[16/10] cursor-pointer perspective-1000"
                onClick={handleFlip}
            >
                <div 
                    className={cn(
                        "relative w-full h-full preserve-3d transition-transform duration-500 ease-out",
                        isFlipped && "rotate-y-180"
                    )}
                >
                    {/* Front Card - Question */}
                    <div className={cn(
                        "absolute inset-0 backface-hidden rounded-xl",
                        "bg-gradient-to-br from-background to-muted/50",
                        "border border-border shadow-lg",
                        "flex flex-col items-center justify-center p-6 text-center"
                    )}>
                        <div className="absolute top-4 left-4 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider">
                            Question
                        </div>
                        <div className="text-lg md:text-xl font-medium text-foreground leading-relaxed px-4">
                            {currentCard.front}
                        </div>
                        <div className="absolute bottom-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Click to reveal answer</span>
                        </div>
                    </div>

                    {/* Back Card - Answer */}
                    <div className={cn(
                        "absolute inset-0 backface-hidden rounded-xl rotate-y-180",
                        "bg-gradient-to-br from-primary/5 to-primary/10",
                        "border border-primary/20 shadow-lg",
                        "flex flex-col items-center justify-center p-6 text-center"
                    )}>
                        <div className="absolute top-4 left-4 px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
                            Answer
                        </div>
                        <div className="text-base md:text-lg text-foreground leading-relaxed px-4">
                            {currentCard.back}
                        </div>
                        <div className="absolute bottom-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Click to see question</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between w-full mt-6 px-4">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }} 
                    disabled={cards.length <= 1}
                    className="gap-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Prev</span>
                </Button>
                
                <div className="flex items-center gap-2">
                    {/* Progress dots for small card counts, text for larger */}
                    {cards.length <= 10 ? (
                        <div className="flex items-center gap-1.5">
                            {cards.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setIsFlipped(false);
                                        setCurrentIndex(idx); 
                                    }}
                                    className={cn(
                                        "w-2 h-2 rounded-full transition-all duration-200",
                                        idx === currentIndex 
                                            ? "bg-primary scale-125" 
                                            : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                    )}
                                />
                            ))}
                        </div>
                    ) : (
                        <span className="text-sm font-medium text-muted-foreground tabular-nums">
                            {currentIndex + 1} / {cards.length}
                        </span>
                    )}
                </div>

                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); handleNext(); }} 
                    disabled={cards.length <= 1}
                    className="gap-1"
                >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Keyboard hint */}
            <p className="text-xs text-muted-foreground mt-3">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">Space</kbd> to flip, 
                <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono ml-1">←</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">→</kbd> to navigate
            </p>
        </div>
    );
}
