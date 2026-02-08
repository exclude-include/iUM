"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
// import mermaid from "mermaid"; // Removed static import
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Move, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import * as d3 from "d3";
// import svgPanZoom from "svg-pan-zoom"; // Dynamic import used instead

// Mermaid 초기화
const initMermaid = async () => {
  if (typeof window !== "undefined") {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
      maxTextSize: 900000,
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
        wrappingWidth: 300,
        nodeSpacing: 50,
        rankSpacing: 80,
        padding: 15
      },
      wrap: true,
      sequence: {
        wrap: true,
        width: 300,
        useMaxWidth: false
      },
      mindmap: {
        useMaxWidth: false,
        padding: 20
      }
    });
  }
};

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const [svgId] = useState(`mermaid-${Math.random().toString(36).substr(2, 9)}`);
  const [isRendering, setIsRendering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomInstanceRef = useRef<SvgPanZoom.Instance | null>(null);

  useEffect(() => {
    initMermaid();
  }, []);

  const renderChart = useCallback(async () => {
    if (!chart || !containerRef.current) return;

    setIsRendering(true);
    try {
      // SVG Pan Zoom 인스턴스 정리
      if (panZoomInstanceRef.current) {
        panZoomInstanceRef.current.destroy();
        panZoomInstanceRef.current = null;
      }

      const element = containerRef.current;
      element.innerHTML = ""; // Clear previous chart

      // Mermaid 렌더링
      const mermaid = (await import("mermaid")).default;
      const { svg: svgContent } = await mermaid.render(svgId, chart);
      element.innerHTML = svgContent;

      const svgElement = element.querySelector("svg");
      if (svgElement) {
        // 스타일 보정
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";
        svgElement.style.minHeight = "300px";

        // 1. Enable Pan/Zoom
        // Dynamically import svg-pan-zoom to avoid SSR window error
        const { default: svgPanZoom } = await import("svg-pan-zoom");

        panZoomInstanceRef.current = svgPanZoom(svgElement, {
          zoomEnabled: true,
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom: 0.1,
          maxZoom: 10,
        });

        // 2. Enable Node Dragging using D3
        const nodes = d3.select(svgElement).selectAll(".node");

        nodes.call(d3.drag<any, any>()
          .on("start", function (event) {
            // Drag 시작 시 PanZoom 비활성화 안 함 (자연스러운 동작 위해)
            // 하지만 드래그 중에는 Pan이 튀지 않게 조심해야 함
            // PanZoom 라이브러리가 이벤트를 먼저 먹을 수 있음 -> stopPropagation
            if (event.sourceEvent) {
              event.sourceEvent.stopPropagation();
            }
          })
          .on("drag", function (event) {
            // 현재 transform 파싱
            const transform = d3.select(this).attr("transform");
            let x = 0, y = 0;

            // translate(x, y) 파싱
            if (transform) {
              const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
              if (match) {
                x = parseFloat(match[1]);
                y = parseFloat(match[2]);
              }
            }

            // SVG의 현재 줌 레벨 고려
            const zoomLevel = panZoomInstanceRef.current?.getZoom() || 1;

            // 새로운 위치 계산
            const newX = x + event.dx / zoomLevel;
            const newY = y + event.dy / zoomLevel;

            d3.select(this).attr("transform", `translate(${newX},${newY})`);

            // 참고: Edge(화살표) 업데이트는 매우 복잡하므로 여기서는 생략.
            // 노드만 이동됨. 
          })
        );

        // 커서 스타일 변경
        nodes.style("cursor", "move");
      }

    } catch (error) {
      console.error("Mermaid render error:", error);
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div class="text-destructive text-sm p-2">Failed to render diagram</div>`;
      }
    } finally {
      setIsRendering(false);
    }
  }, [chart, svgId]);

  useEffect(() => {
    // Debounce rendering
    const timer = setTimeout(() => {
      renderChart();
    }, 100);
    return () => clearTimeout(timer);
  }, [renderChart]);

  // Control Handlers
  const handleZoomIn = () => panZoomInstanceRef.current?.zoomIn();
  const handleZoomOut = () => panZoomInstanceRef.current?.zoomOut();
  const handleReset = () => panZoomInstanceRef.current?.reset();

  const handleDownload = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "diagram.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-full h-full min-h-[300px] border rounded-lg overflow-hidden bg-background group">
      {/* Controls Overlay */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 p-1 rounded backdrop-blur-sm border shadow-sm">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset} title="Reset View">
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDownload} title="Download SVG">
          <Download className="h-3 w-3" />
        </Button>
      </div>

      {/* Diagram Container */}
      <div
        ref={containerRef}
        className={cn(
          "w-full h-full min-h-[300px] flex items-center justify-center transition-opacity duration-300",
          isRendering ? "opacity-50" : "opacity-100"
        )}
      />
    </div>
  );
}