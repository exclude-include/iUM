"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import mermaid from "mermaid";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Move } from "lucide-react";
import { cn } from "@/lib/utils";

// Mermaid 초기화
const initMermaid = () => {
  if (typeof window !== "undefined") {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
      maxTextSize: 900000,
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }
};

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Transform State for Pan/Zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const renderId = useRef(0);

  useEffect(() => {
    initMermaid();
  }, []);

  useEffect(() => {
    if (!chart) return;

    const renderChart = async () => {
      const currentRenderId = ++renderId.current;
      setIsRendering(true);
      setError(null);

      try {
        // [자동 수리 로직]
        let fixedChart = chart;

        // 1. subgraph 제목에 따옴표 강제 적용
        fixedChart = fixedChart.replace(/subgraph\s+([^\n"\[]+?)\s*(\n|\[)/g, 'subgraph "$1"$2');

        // 2. 괄호가 포함된 노드 라벨에 따옴표 강제 적용 (Deleted to fix parse errors with inline content)
        // fixedChart = fixedChart.replace(/([a-zA-Z0-9_]+)(\[|\(|\{)\s*([^"\]\}\)]*?[\(\)][^"\]\}\)]*?)\s*(\]|\)|\})/g, '$1$2"$3"$4');

        const id = `mermaid-${Date.now()}`;
        // SVG 생성을 위해 임시 div 사용 (DOM에 직접 렌더링하지 않음)
        const { svg: renderedSvg } = await mermaid.render(id, fixedChart);

        if (renderId.current === currentRenderId) {
          setSvg(renderedSvg);
          setIsRendering(false);
          // 렌더링 후 리셋 (선택적)
          setTransform({ x: 0, y: 0, scale: 1 });
        }
      } catch (err: any) {
        console.error("Mermaid Render Failed:", err);
        if (renderId.current === currentRenderId) {
          const msg = err.message?.split('\n')[0] || "Syntax Error";
          setError(msg);
          setIsRendering(false);
        }
      }
    };

    const timer = setTimeout(renderChart, 50);
    return () => clearTimeout(timer);
  }, [chart]);

  // --- Pan/Zoom Handlers ---

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // Stop page scrolling

      const zoomIntensity = 0.001;
      const delta = -e.deltaY * zoomIntensity;

      setTransform(prev => ({
        ...prev,
        scale: Math.min(Math.max(0.2, prev.scale + delta), 5)
      }));
    };

    // Passive: false is required to generic preventDefault
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - transform.x,
      y: e.clientY - transform.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => setTransform({ x: 0, y: 0, scale: 1 });
  const handleZoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 5) }));
  const handleZoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.2) }));

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg my-4 text-left">
        <h3 className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">Diagram Error</h3>
        <p className="text-xs text-red-600 dark:text-red-300 mb-2">{error}</p>
        <details className="cursor-pointer">
          <summary className="text-xs text-gray-500">Show Source Code</summary>
          <pre className="mt-2 text-[10px] bg-white dark:bg-black p-2 rounded border overflow-auto max-h-32 font-mono">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      className="relative border rounded-xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col my-4 group select-none w-full h-[60vh] min-h-[400px]"
    // Fixed height removed, using responsive classes
    >
      {/* 툴바 */}
      <div className="absolute top-2 right-2 flex gap-1 z-20 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1 rounded-lg border shadow-sm">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Zoom In"><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Reset View"><RotateCcw className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Zoom Out"><ZoomOut className="h-4 w-4" /></Button>
        <div className="w-px bg-border mx-1" />
        <div className="flex items-center justify-center w-7 h-7" title="Drag to Pan, Scroll to Zoom">
          <Move className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "w-full h-full bg-gray-50/50 dark:bg-gray-950/30 overflow-hidden cursor-grab active:cursor-grabbing",
          isDragging && "cursor-grabbing"
        )}
        // onWheel removed - handled natively
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        title="Scroll to Zoom, Drag to Pan"
      >
        {isRendering ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-muted-foreground animate-pulse">Generating Diagram...</span>
          </div>
        ) : (
          <div
            ref={contentRef}
            className="w-full h-full flex items-center justify-center origin-center"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out"
            }}
          >
            <div
              className="pointer-events-none [&_svg]:max-w-none [&_svg]:h-auto [&_svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        )}
      </div>
    </div>
  );
}