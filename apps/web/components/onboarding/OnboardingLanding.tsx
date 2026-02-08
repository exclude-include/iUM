"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, BookOpen, MessageSquare, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingLanding() {
  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen flex-col bg-background">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto flex max-w-2xl flex-col items-center text-center"
        >
          {/* Logo / Brand */}
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"
          >
            <span className="text-2xl font-bold">iUM</span>
          </motion.div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Insight, Understanding, Mastery
          </h1>
          <p className="mb-10 max-w-md text-muted-foreground text-lg">
            AI와 함께하는 학습 생태계. 노트, 채팅, 릴스로 이해를 깊게 만드세요.
          </p>

          {/* Value props - icons + short text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {[
              {
                icon: BookOpen,
                title: "워크스페이스",
                desc: "노트와 AI로 정리하고 복습하세요",
              },
              {
                icon: MessageSquare,
                title: "AI 채팅",
                desc: "질문하고 대화하며 이해를 높이세요",
              },
              {
                icon: Flame,
                title: "릴스 & 퀴즈",
                desc: "짧은 영상과 퀴즈로 재미있게",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-4 py-4 backdrop-blur-sm"
              >
                <item.icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="min-w-[160px] gap-2">
              <Link href="/login?mode=signup">
                <Sparkles className="h-4 w-4" />
                Sign Up
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-[160px]">
              <Link href="/login">Sign In</Link>
            </Button>
          </motion.div>

          <p className="mt-6 text-xs text-muted-foreground">
            계정이 있으시면 Sign In, 처음이시면 Sign Up으로 시작하세요.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
