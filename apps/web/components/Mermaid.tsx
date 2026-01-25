"use client";

import React, { useEffect, useState, useRef } from "react";
import mermaid from "mermaid";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

// Mermaid 초기화
const initMermaid = () => {
  if (typeof window !== "undefined") {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
    });
  }
};

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const [scale, setScale] = useState(1);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
        // [자동 수리 로직] -------------------------------------------------------
        let fixedChart = chart;

        // 1. subgraph 제목에 따옴표 강제 적용
        // 예: subgraph Memory (RAM) -> subgraph "Memory (RAM)"
        fixedChart = fixedChart.replace(/subgraph\s+([^\n"\[]+?)\s*(\n|\[)/g, 'subgraph "$1"$2');

        // 2. 괄호가 포함된 노드 라벨에 따옴표 강제 적용 (단, 이미 따옴표가 있는 경우 제외)
        // 예: A[Water (H2O)] -> A["Water (H2O)"]
        // 주의: 이 정규식은 단순한 케이스만 처리하며 복잡한 중첩은 놓칠 수 있음
        fixedChart = fixedChart.replace(/([a-zA-Z0-9_]+)(\[|\(|\{)\s*([^"\]\}\)]*?[\(\)][^"\]\}\)]*?)\s*(\]|\)|\})/g, '$1$2"$3"$4');
        // ----------------------------------------------------------------------

        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, fixedChart);

        if (renderId.current === currentRenderId) {
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err: any) {
        console.error("Mermaid Render Failed:", err);
        if (renderId.current === currentRenderId) {
          // 에러 메시지 간소화
          const msg = err.message?.split('\n')[0] || "Syntax Error";
          setError(msg);
          setIsRendering(false);
        }
      }
    };

    // DOM 안정화를 위해 약간의 지연
    const timer = setTimeout(renderChart, 50);
    return () => clearTimeout(timer);
  }, [chart]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.2));
  const handleReset = () => setScale(1);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg my-4 text-left">
        <h3 className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">
          Diagram Error
        </h3>
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
    <div className="relative border rounded-xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col my-4 group">
      {/* 툴바: 마우스 오버 시에만 진하게 표시 */}
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1 rounded-lg border shadow-sm">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></Button>
      </div>

      <div ref={containerRef} className="overflow-auto p-4 min-h-[300px] flex items-center justify-center bg-gray-50/50 dark:bg-gray-950/30">
        {isRendering ? (
           <span className="text-xs text-muted-foreground animate-pulse">Generating Diagram...</span>
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            style={{ transform: `scale(${scale})`, transformOrigin: "center top", transition: "transform 0.2s" }}
            className="[&_svg]:max-w-none"
          />
        )}
      </div>
    </div>
  );
}