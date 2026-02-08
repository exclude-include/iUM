"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, MessageSquare, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

// Triangular lattice mesh (dots + lines forming triangles, Include-style)
const COLS = 24;
const ROWS = 18;
const SPACING = 52;
const ROW_HEIGHT = SPACING * 0.866; // sqrt(3)/2 for equilateral triangles
const MESH_WIDTH = COLS * SPACING + SPACING / 2;
const MESH_HEIGHT = ROWS * ROW_HEIGHT;
const TILT_MAX_DEG = 10;
const TILT_SMOOTH_MS = 180;

function edgeKey(a: [number, number], b: [number, number]): string {
  const [ax, ay] = a;
  const [bx, by] = b;
  return ax < bx || (ax === bx && ay <= by) ? `${ax},${ay}-${bx},${by}` : `${bx},${by}-${ax},${ay}`;
}

function useMouseTilt() {
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMouse({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
  }, []);

  const onMouseLeave = useCallback(() => {
    setMouse({ x: 0.5, y: 0.5 });
  }, []);

  const rotateY = (mouse.x - 0.5) * 2 * TILT_MAX_DEG;
  const rotateX = (0.5 - mouse.y) * 2 * TILT_MAX_DEG;

  return { onMouseMove, onMouseLeave, rotateX, rotateY };
}

function MeshBackground({ rotateX, rotateY }: { rotateX: number; rotateY: number }) {
  const { points, lines } = useMemo(() => {
    // Triangular lattice: alternating rows offset by SPACING/2 (dots + lines → triangles/polygons)
    const points: [number, number][] = [];
    const pointByCoord = new Map<string [number, number]>();

    for (let j = 0; j < ROWS; j++) {
      const xOffset = (j % 2) * (SPACING / 2);
      for (let i = 0; i < COLS; i++) {
        const x = i * SPACING + xOffset;
        const y = j * ROW_HEIGHT;
        const pt: [number, number] = [x, y];
        points.push(pt);
        pointByCoord.set(`${i},${j}`, pt);
      }
    }

    const seen = new Set<string>();
    const lines: [[number, number], [number, number]][] = [];

    const addEdge = (a: [number, number], b: [number, number]) => {
      const key = edgeKey(a, b);
      if (seen.has(key)) return;
      seen.add(key);
      lines.push([a, b]);
    };

    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const a = pointByCoord.get(`${i},${j}`);
        if (!a) continue;
        // Horizontal: right neighbor
        if (i < COLS - 1) {
          const b = pointByCoord.get(`${i + 1},${j}`);
          if (b) addEdge(a, b);
        }
        // Diagonal down: triangular lattice (each point connects to 2 neighbors in row below)
        if (j < ROWS - 1) {
          if (j % 2 === 0) {
            const b = pointByCoord.get(`${i},${j + 1}`);
            const c = pointByCoord.get(`${i - 1},${j + 1}`);
            if (b) addEdge(a, b);
            if (c) addEdge(a, c);
          } else {
            const b = pointByCoord.get(`${i},${j + 1}`);
            const c = pointByCoord.get(`${i + 1},${j + 1}`);
            if (b) addEdge(a, b);
            if (c) addEdge(a, c);
          }
        }
      }
    }

    return { points, lines };
  }, []);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 select-none"
      style={{
        width: MESH_WIDTH,
        height: MESH_HEIGHT,
        marginLeft: -MESH_WIDTH / 2,
        marginTop: -MESH_HEIGHT / 2,
        perspective: 1200,
        transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: `transform ${TILT_SMOOTH_MS}ms ease-out`,
        filter: "blur(0.5px)",
      }}
    >
      <svg
        width={MESH_WIDTH}
        height={MESH_HEIGHT}
        className="overflow-visible"
        style={{ opacity: 0.45 }}
      >
        <defs>
          <linearGradient id="mesh-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(148, 163, 184)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="rgb(100, 116, 139)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <g stroke="url(#mesh-line)" strokeWidth="0.6" fill="none">
          {lines.map(([[x1, y1], [x2, y2]], i) => (
            <line key={`l-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        <g fill="rgb(100, 116, 139)" fillOpacity="0.4">
          {points.map(([x, y], i) => (
            <circle key={`p-${i}`} cx={x} cy={y} r="1.2" />
          ))}
        </g>
      </svg>
    </div>
  );
}

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
  const { onMouseMove, onMouseLeave, rotateX, rotateY } = useMouseTilt();

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen flex-col overflow-hidden bg-[#f0f7ff]"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Pastel blue gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#e8f4fd] via-[#f0f7ff] to-[#e0effe]" />
      {/* Cursor-reactive mesh (dots + lines, tilts with mouse) - faint, behind content */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <MeshBackground rotateX={rotateX} rotateY={rotateY} />
      </div>
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(147, 197, 253, 0.35), transparent 55%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/2 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(191, 219, 254, 0.4), transparent 60%)",
        }}
      />
      {/* Soft floating orbs */}
      <motion.div
        className="absolute left-[15%] top-[25%] h-64 w-64 rounded-full bg-[#bfdbfe]/40 blur-3xl"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.4, 0.55, 0.4],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[10%] top-[50%] h-72 w-72 rounded-full bg-[#93c5fd]/30 blur-3xl"
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
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
