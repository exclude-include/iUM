"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFCellRendererProps {
  pdfUrl: string;
  title: string;
  maxHeight?: number; // Maximum height in pixels (default: 600)
}

export function PDFCellRenderer({ pdfUrl, title, maxHeight = 600 }: PDFCellRendererProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error("PDF load error:", error);
    setError("Failed to load PDF. The file may be corrupted or unsupported.");
    setLoading(false);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  return (
    <div className="w-full">
      {/* PDF Controls */}
      <div className="flex items-center justify-between mb-3 p-2 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1 || loading}
            className="h-7 px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium min-w-[80px] text-center">
            {loading ? "Loading..." : `Page ${pageNumber} of ${numPages || "?"}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1) || loading}
            className="h-7 px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5 || loading}
            className="h-7 px-2"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 2.0 || loading}
            className="h-7 px-2"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer Container with Fixed Height and Scroll */}
      <div
        className={cn(
          "w-full border border-border rounded-lg bg-muted/10 overflow-auto",
          "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
        )}
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
            <p className="text-sm text-destructive mb-2">⚠️ {error}</p>
            <p className="text-xs text-muted-foreground">
              Please try uploading a different PDF file.
            </p>
          </div>
        ) : (
          <div className="flex justify-center p-4">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Loading PDF...</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-md"
              />
            </Document>
          </div>
        )}
      </div>

      {/* Page Info */}
      {!loading && !error && numPages && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          {numPages === 1 ? "1 page" : `${numPages} pages total`}
        </div>
      )}
    </div>
  );
}
