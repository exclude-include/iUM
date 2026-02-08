"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, MessageSquare, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VantaBackground } from "./VantaBackground";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const stagger = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const features = [
  {
    icon: BookOpen,
    title: "Workspace",
    desc: "Notes and AI to organize and review",
  },
  {
    icon: MessageSquare,
    title: "AI Chat",
    desc: "Ask questions and deepen understanding",
  },
  {
    icon: Flame,
    title: "Reels & Quiz",
    desc: "Short videos and quizzes made fun",
  },
];

export function OnboardingLanding() {
  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen flex-col overflow-hidden bg-[#ffffff]">
      {/* Vanta CLOUDS background (sky + clouds, mouse-reactive) */}
      <VantaBackground />
      {/* Light sky/cloud tone overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(104, 184, 215, 0.12) 0%, transparent 40%, rgba(173, 193, 222, 0.08) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="mx-auto flex max-w-2xl flex-col items-center text-center"
        >
          {/* Logo / Brand */}
          <motion.div
            variants={fadeUp}
            className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, #93c5fd 0%, #60a5fa 50%, #3b82f6 100%)",
              color: "#fff",
              boxShadow: "0 10px 40px -10px rgba(59, 130, 246, 0.4)",
            }}
          >
            <span className="text-2xl font-bold tracking-tight">iUM</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mb-3 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl md:text-5xl"
          >
            Insight, Understanding, Mastery
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mb-14 max-w-lg text-lg text-slate-600"
          >
            A learning ecosystem powered by AI. Notes, chat, and reels to deepen your understanding.
          </motion.p>

          {/* Value props */}
          <motion.div
            variants={stagger}
            className="mb-14 grid w-full grid-cols-1 gap-5 sm:grid-cols-3"
          >
            {features.map((item, i) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-sky-200/60 bg-white/70 px-5 py-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-sky-600"
                  style={{ background: "rgba(147, 197, 253, 0.25)" }}
                >
                  <item.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {item.title}
                </span>
                <span className="text-xs leading-relaxed text-slate-500">
                  {item.desc}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons - text only */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col items-center gap-4 sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="min-w-[168px] rounded-xl bg-[#3b82f6] px-6 py-6 text-base font-medium shadow-md transition-all hover:bg-[#2563eb] hover:shadow-lg"
            >
              <Link href="/login?mode=signup">Sign Up</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-w-[168px] rounded-xl border-sky-300 bg-white/80 px-6 py-6 text-base font-medium text-slate-700 hover:bg-sky-50 hover:text-slate-900"
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="mt-8 text-sm text-slate-500"
          >
            Already have an account? Sign in. New here? Sign up to get started.
          </motion.p>
        </motion.div>
      </div>

      {/* Footer: powered by OPIK */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="relative z-10 flex shrink-0 items-center justify-center gap-2.5 py-8"
      >
        <span className="text-sm text-slate-500">powered by</span>
        <span
          className="inline-flex items-center rounded-lg bg-slate-700/90 px-2.5 py-1 font-semibold tracking-tight text-white"
          style={{ letterSpacing: "0.08em", fontSize: "0.8rem" }}
        >
          OPIK
        </span>
      </motion.footer>
    </div>
  );
}
