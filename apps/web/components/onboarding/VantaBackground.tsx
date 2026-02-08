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

        // Use require to bypass static analysis issues
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const VANTA = await import("vanta/dist/vanta.clouds.min.js");
        const VANTADefault = (VANTA as { default: (opts: Record<string, unknown>) => { destroy: () => void } }).default;

        if (!vantaRef.current) return;

        vantaEffect.current = VANTADefault({
          el: vantaRef.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          skyColor: 0x68b8d7,
          cloudColor: 0xadc1de,
          cloudShadowColor: 0x183550,
          sunColor: 0xff9919,
          sunGlareColor: 0xff6633,
          sunlightColor: 0xff9933,
          speed: 1,
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
