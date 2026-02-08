"use client";

import { useAppStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, ExternalLink, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { Mermaid } from "@/components/Mermaid";

export function DeepModeView() {
    const { deepHistory, appendCellToActiveTab, createNotebookTab } = useAppStore();

    const handleAddToTab = (item: any) => {
        appendCellToActiveTab(item);
    };

    const handleNewTab = (item: any) => {
        // 1. Create new tab
        const tabId = createNotebookTab(item.title || "Deep Dive");
        // 2. Add cell to it (store automatically handles active tab switch usually, but appendCellToActiveTab relies on notebookActiveTabId)
        // createNotebookTab sets the new tab as active, so this should work.
        setTimeout(() => {
            appendCellToActiveTab(item);
        }, 100);
    };

    return (
        <div className="flex flex-col h-full bg-background deep-mode-view">
            <div className="p-3 border-b text-xs text-muted-foreground bg-muted/20">
                <p>Select text in the main tab and right-click to "Deep Dive".</p>
            </div>

            <ScrollArea className="flex-1 p-3">
                {deepHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground p-4">
                        <Sparkles className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">No deep dives yet.</p>
                        <p className="text-xs mt-1 opacity-70">
                            Highlight text in your notebook and select <strong>Deep Dive</strong> from the context menu.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {deepHistory.map((item) => (
                            <Card key={item.id} className="overflow-hidden border-primary/20 shadow-sm">
                                <div className="bg-primary/5 p-2 px-3 flex items-center justify-between border-b border-primary/10">
                                    <h3 className="font-semibold text-xs truncate flex-1 text-primary">
                                        {item.title}
                                    </h3>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleAddToTab(item)}
                                            title="Add to current tab"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleNewTab(item)}
                                            title="Open in new tab"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="p-3 text-sm prose prose-sm dark:prose-invert max-w-none break-words">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath, remarkGfm]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            code: (props: any) => {
                                                const { inline, className, children, ...rest } = props;
                                                const match = /language-(\w+)/.exec(className || "");
                                                const isMermaid = match && match[1] === "mermaid";

                                                if (!inline && isMermaid) {
                                                    return (
                                                        <div className="my-2 flex justify-center p-2 bg-white/50 dark:bg-black/20 rounded border overflow-hidden">
                                                            <Mermaid chart={String(children).replace(/\n$/, "")} />
                                                        </div>
                                                    );
                                                }
                                                return !inline ? (
                                                    <code className={cn("block bg-muted p-2 rounded text-xs my-2 overflow-x-auto", className)} {...rest}>
                                                        {children}
                                                    </code>
                                                ) : (
                                                    <code className={cn("bg-muted px-1 py-0.5 rounded text-xs", className)} {...rest}>
                                                        {children}
                                                    </code>
                                                );
                                            }
                                        }}
                                    >
                                        {item.content}
                                    </ReactMarkdown>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
