"use client";

import React, { useCallback, useEffect, useMemo } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { GraphData } from '@/lib/store';

// Fix for missing types
// @ts-ignore
declare module 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// Helper to estimate node size based on text
const estimateNodeSize = (label: string) => {
    const baseWidth = 150;
    const baseHeight = 40;
    const charWidth = 7;
    const lineHeight = 18;
    const padding = 20;
    const maxLineWidth = 200; // Max width before wrapping

    const textLength = label.length;

    // Simple estimation
    let width = Math.min(textLength * charWidth + padding, maxLineWidth);
    width = Math.max(width, baseWidth); // Min width

    const lines = Math.ceil((textLength * charWidth) / (width - padding));
    const height = Math.max(baseHeight, lines * lineHeight + padding * 2);

    return { width, height };
};

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node: any) => {
        // ✨ [Updated] Use dynamic size
        const { width, height } = estimateNodeSize(node.data.label || "");
        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge: any) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node: any) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const { width, height } = estimateNodeSize(node.data.label || "");

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
}

function FlowChartInner({ data }: FlowChartProps) {
    const { fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (data && data.nodes && data.edges) {
            // Transform GraphData to ReactFlow elements
            const initialNodes = data.nodes.map(n => ({
                id: n.id,
                data: { label: n.label },
                position: { x: 0, y: 0 }, // Initial position, will be computed by dagre
                type: n.type || 'default', // input, output, default
                style: {
                    background: '#fff',
                    border: '1px solid #777',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '12px',
                    textAlign: 'center',
                    whiteSpace: 'pre-wrap', // ✨ [Added] Allow wrapping
                    wordBreak: 'break-word', // ✨ [Added] Break long words
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

    return (
        <div style={{ width: '100%', height: '400px' }} className="border rounded-md bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            {/* ✨ [Updated] Interactive Diagram: Nodes are draggable by default in ReactFlow unless nodesDraggable={false} */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                attributionPosition="bottom-right"
                nodesDraggable={true} // ✨ Explicitly enable dragging
                nodesConnectable={false} // Disable changing connections by default (view mode)
            >
                <Controls />
                <Background gap={12} size={1} color="#aaa" />
            </ReactFlow>
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
