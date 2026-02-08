"use client";

import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Background,
    Controls,
    MiniMap,
    Panel,
    useReactFlow,
    ReactFlowProvider,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GraphData } from '@/lib/store';

// Fix for missing types
// @ts-ignore
declare module 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node: any) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge: any) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node: any) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = isHorizontal ? 'left' : 'top';
        node.sourcePosition = isHorizontal ? 'right' : 'bottom';

        // Shift dagre's center-point based position to ReactFlow's top-left based position
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes, edges };
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
                    width: 'auto',
                    minWidth: '100px',
                    textAlign: 'center'
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
                style: { stroke: '#555' }
            }));

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                initialNodes,
                initialEdges
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);

            // Fit view after a brief delay to ensure rendering
            setTimeout(() => {
                fitView({ padding: 0.2 });
            }, 100);
        }
    }, [data, setNodes, setEdges, fitView]);

    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const handleDownload = () => {
        alert("Download feature coming soon for Reactflow!");
    };

    return (
        <div style={{ width: '100%', height: '400px' }} className="border rounded-md bg-slate-50 dark:bg-slate-900">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                attributionPosition="bottom-right"
            >
                <Controls />
                <Background gap={12} size={1} />
                <Panel position="top-right">
                    <div className="flex gap-2">
                        {/* Placeholders for future controls */}
                    </div>
                </Panel>
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
