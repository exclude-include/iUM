"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    VANTA: unknown;
    THREE: unknown;
  }
}

export function VantaBackground() {
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    const loadVanta = async () => {
      if (!vantaRef.current || vantaEffect.current) return;

      try {
        const mod = await import("three");
        const THREE = (mod as { default?: unknown }).default ?? mod;
        window.THREE = THREE;

        const VANTA = await import("vanta/dist/vanta.net.min");
        const VANTADefault = (VANTA as { default: (opts: Record<string, unknown>) => { destroy: () => void } }).default;

        vantaEffect.current = VANTADefault({
          el: vantaRef.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1,
          scaleMobile: 1,
          color: 0x93c5fd,
          backgroundColor: 0xf0f7ff,
          points: 8,
          maxDistance: 25,
          spacing: 20,
          showDots: false,
          mouseCoeffX: 0.3,
          mouseCoeffY: 0.3,
        });
      } catch (e) {
        console.warn("Vanta background failed to load:", e);
      }
    };

    loadVanta();

    return () => {
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
        vantaEffect.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={vantaRef}
      className="absolute inset-0 pointer-events-none z-0"
      aria-hidden
    />
  );
}
