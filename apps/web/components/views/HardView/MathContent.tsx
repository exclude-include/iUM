"use client";

import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";

interface MathContentProps {
  document: {
    id: string;
    title: string;
    content?: string;
    sections?: Array<{
      title: string;
      content: string;
    }>;
    equations?: string[];
  };
}

export function MathContent({ document }: MathContentProps) {
  // If document has sections, render them
  if (document.sections && document.sections.length > 0) {
    return (
      <div className="space-y-4 text-xs leading-relaxed text-foreground document-content">
        {document.sections.map((section, index) => (
          <div key={index} className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">
              {section.title}
            </h3>
            <p className="text-foreground">{section.content}</p>
          </div>
        ))}

        {/* Render equations if available */}
        {document.equations && document.equations.length > 0 && (
          <div className="space-y-3 border-l-2 border-muted pl-3 mt-4">
            {document.equations.map((equation, index) => (
              <div key={index}>
                <div className="flex justify-center my-2">
                  <BlockMath math={equation} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback: Render document content if no sections
  return (
    <div className="space-y-4 text-xs leading-relaxed text-foreground document-content">
      {/* Section Title */}
      {document.title && (
        <h3 className="text-sm font-semibold border-b pb-1">
          {document.title}
        </h3>
      )}

      {/* Document Content */}
      {document.content && (
        <p className="text-foreground">{document.content}</p>
      )}

      {/* Equations */}
      {document.equations && document.equations.length > 0 && (
        <div className="space-y-3 border-l-2 border-muted pl-3 mt-4">
          {document.equations.map((equation, index) => (
            <div key={index}>
              <div className="flex justify-center my-2">
                <BlockMath math={equation} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state if no content */}
      {!document.title && !document.content && (!document.equations || document.equations.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No content available for this document.</p>
        </div>
      )}
    </div>
  );
}
