"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Background,
    Controls,
    Panel,
    useReactFlow,
    ReactFlowProvider,
    MarkerType,
    Node,
    NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { GraphData } from '@/lib/store';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Copy, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Fix for missing types
// @ts-ignore
declare module 'dagre';

const estimateNodeSize = (label: string) => {
    // Basic heuristic: 8px per char, 20px per line, with minimums
    const lines = String(label || "").split('\n');
    const maxLineLength = Math.max(...lines.map(l => l.length));
    const width = Math.max(150, Math.min(400, maxLineLength * 8 + 40));
    const height = Math.max(50, lines.length * 20 + 40);
    return { width, height };
};

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    // ✨ [Fix] Create graph instance INSIDE function to prevent stale state across renders
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node: any) => {
        // ✨ [Updated] Use dynamic size
        const { width, height } = estimateNodeSize(node.data.rawLabel || "");
        dagreGraph.setNode(node.id, { width, height });
    });

    // ✨ [Fix] Filter edges to ensure source/target nodes exist
    // This prevents Dagre from auto-creating 0-size nodes for missing IDs, which causes the "intersection" error
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    edges.forEach((edge: any) => {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
            dagreGraph.setEdge(edge.source, edge.target);
        }
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node: any) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const { width, height } = estimateNodeSize(node.data.rawLabel || "");

        // Shift dagre's center-point based position to ReactFlow's top-left based position
        return {
            ...node,
            targetPosition: isHorizontal ? 'left' : 'top',
            sourcePosition: isHorizontal ? 'right' : 'bottom',
            position: {
                x: nodeWithPosition.x - width / 2,
                y: nodeWithPosition.y - height / 2,
            },
            style: {
                ...node.style,
                width: width,
                height: height,
            }
        };
    });

    return { nodes: layoutedNodes, edges };
};

interface FlowChartProps {
    data: GraphData;
    onDeepDive?: (text: string) => void; // ✨ [Added] Callback for Deep Dive
}

function FlowChartInner({ data, onDeepDive }: FlowChartProps) {
    const { fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (data && data.nodes && data.edges) {
            // Transform GraphData to ReactFlow elements
            const initialNodes = data.nodes.map(n => ({
                id: n.id,
                // ✨ [Updated] Render label with Markdown/Math support
                data: {
                    rawLabel: n.label, // Store raw string for layout estimation
                    label: (
                        <div className="math-node-label">
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    p: ({ children }) => <span className="text-xs">{children}</span>
                                }}
                            >
                                {n.label}
                            </ReactMarkdown>
                        </div>
                    )
                },
                position: { x: 0, y: 0 }, // Initial position, will be computed by dagre
                type: n.type || 'default', // input, output, default
                style: {
                    background: '#fff',
                    border: '1px solid #777',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '12px',
                    textAlign: 'center',
                    // whiteSpace: 'pre-wrap', // Handled by Markdown
                    width: 'fit-content', // Let CSS handle it? No, dagre needs explicit size. 
                    // We just use style for box. content is checked by markdown.
                    color: '#000', // Ensure text is visible (black)
                }
            }));

            const initialEdges = data.edges.map(e => ({
                id: e.id || `e${e.source}-${e.target}`,
                source: e.source,
                target: e.target,
                label: e.label,
                animated: true,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
                style: { stroke: '#555' },
                labelStyle: { fill: '#555', fontWeight: 700 }
            }));

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                initialNodes,
                initialEdges
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);

            // Fit view after a brief delay to ensure rendering
            setTimeout(() => {
                fitView({ padding: 0.2, duration: 800 });
            }, 100);
        }
    }, [data, setNodes, setEdges, fitView]);

    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // ✨ [Added] Context menu state for node right-click
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        position: { x: number; y: number };
        nodeLabel: string;
    }>({ visible: false, position: { x: 0, y: 0 }, nodeLabel: '' });
    
    const { toast } = useToast();

    // ✨ [Added] Handle node right-click
    const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
        // Prevent default browser context menu
        event.preventDefault();
        event.stopPropagation();
        
        const rawLabel = node.data?.rawLabel || '';
        console.log('[FlowChart] Node context menu triggered:', rawLabel);
        
        setContextMenu({
            visible: true,
            position: { x: event.clientX, y: event.clientY },
            nodeLabel: rawLabel,
        });
    }, []);

    // ✨ [Added] Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(prev => ({ ...prev, visible: false }));
        if (contextMenu.visible) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu.visible]);

    // ✨ [Added] Copy node text
    const handleCopyNodeText = useCallback(() => {
        if (contextMenu.nodeLabel) {
            navigator.clipboard.writeText(contextMenu.nodeLabel);
            toast({ description: "Copied to clipboard" });
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, [contextMenu.nodeLabel, toast]);

    // ✨ [Added] Deep Dive on node
    const handleNodeDeepDive = useCallback(() => {
        if (contextMenu.nodeLabel && onDeepDive) {
            onDeepDive(contextMenu.nodeLabel);
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, [contextMenu.nodeLabel, onDeepDive]);

    return (
        <div style={{ width: '100%', height: '400px' }} className="border rounded-md bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
            {/* ✨ [Updated] Interactive Diagram: Nodes are draggable by default in ReactFlow unless nodesDraggable={false} */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeContextMenu={onNodeContextMenu}
                fitView
                attributionPosition="bottom-right"
                nodesDraggable={true} // ✨ Explicitly enable dragging
                nodesConnectable={false} // Disable changing connections by default (view mode)
            >
                <Controls />
                <Background gap={12} size={1} color="#aaa" />
            </ReactFlow>

            {/* ✨ [Added] Custom Context Menu for Nodes - Rendered via Portal */}
            {contextMenu.visible && typeof document !== 'undefined' && ReactDOM.createPortal(
                <div
                    className="fixed z-[9999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[180px]"
                    style={{ 
                        top: contextMenu.position.y, 
                        left: contextMenu.position.x,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                        onClick={handleCopyNodeText}
                    >
                        <Copy className="h-4 w-4" />
                        Copy Text
                    </button>
                    {onDeepDive && (
                        <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                            onClick={handleNodeDeepDive}
                        >
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            Deep Dive
                        </button>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}

export function FlowChart(props: FlowChartProps) {
    return (
        <ReactFlowProvider>
            <FlowChartInner {...props} />
        </ReactFlowProvider>
    );
}
