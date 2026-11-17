import { useEffect, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  useNodesState,
  type NodeProps,
  type Node,
  type ReactFlowInstance,
  type EdgeProps,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { Building2, UserRound, CircleHelp, Globe, Server, CreditCard } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { Account, AccountRisk, CaseData, Transaction } from '../shared/types';
import { money } from './components';

type NodeData = { label: string; subtitle: string; role: string; score: number; selected: boolean };
function EntityNode({ data }: NodeProps<Node<NodeData>>) {
  const Icon =
    data.role === 'victim'
      ? UserRound
      : data.role === 'external'
        ? CircleHelp
        : data.role === 'domain'
          ? Globe
          : data.role === 'ip'
            ? Server
            : data.role === 'upi'
              ? CreditCard
              : Building2;
  return (
    <div className={`entity-node ${data.role} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-top">
        <span className="node-symbol">
          <Icon size={17} />
        </span>
        <span className="node-role">
          {data.role === 'victim'
            ? 'ORIGIN'
            : data.role === 'external'
              ? 'RECORDS MISSING'
              : data.role === 'account'
                ? 'BANK ACCOUNT'
                : data.role.toUpperCase()}
        </span>
        {data.score > 0 && (
          <span className={`node-score ${data.score >= 60 ? 'high' : ''}`}>{data.score}</span>
        )}
      </div>
      <strong title={data.label}>{data.label}</strong>
      <span className="node-subtitle">{data.subtitle}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { entity: EntityNode };
function TransferEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, style, markerEnd, id, data } = props;
  const offset = Number(data?.parallelOffset || 0);
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2 + offset * 0.75;
  const path = `M ${sourceX} ${sourceY} C ${centerX} ${sourceY + offset}, ${centerX} ${targetY + offset}, ${targetX} ${targetY}`;
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={20} />
      <EdgeLabelRenderer>
        <button
          className={`transfer-edge-label nodrag nopan ${props.selected ? 'selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${centerX}px, ${centerY}px)` }}
          aria-label={`Inspect graph transfer ${String(data?.reference || id)}`}
          onClick={(e) => {
            e.stopPropagation();
            (data?.inspect as (() => void) | undefined)?.();
          }}
        >
          {props.label}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { transfer: TransferEdge };
export function MoneyGraph({
  accounts,
  transactions,
  risks,
  onAccount,
  onTransaction,
  selected,
  selectedTransaction,
  compact = false,
}: {
  accounts: Account[];
  transactions: Transaction[];
  risks: AccountRisk[];
  onAccount: (id: string) => void;
  onTransaction: (id: string) => void;
  selected?: string;
  selectedTransaction?: string;
  compact?: boolean;
}) {
  const initial = useMemo(() => {
    const ids = [...new Set(transactions.flatMap((t) => [t.from, t.to]))];
    const graph = new dagre.graphlib.Graph({ multigraph: true });
    graph.setGraph({ rankdir: 'LR', nodesep: 42, ranksep: 75, marginx: 10, marginy: 10 });
    graph.setDefaultEdgeLabel(() => ({}));
    ids.forEach((id) => graph.setNode(id, { width: 150, height: 100 }));
    // Parallel edges receive separate layout slots; labels must not overlap nodes.
    transactions.forEach((t) => graph.setEdge(t.from, t.to, {}, t.id));
    dagre.layout(graph);
    return ids.map((id) => {
      const account = accounts.find((a) => a.id === id);
      const pos = graph.node(id);
      return {
        id,
        type: 'entity',
        position: { x: pos.x - 75, y: pos.y - 50 },
        data: {
          label: account?.label || id,
          subtitle: id,
          role: account?.role || 'account',
          score: risks.find((r) => r.accountId === id)?.score || 0,
          selected:
            selected === id ||
            transactions.some(
              (t) => t.id === selectedTransaction && (t.from === id || t.to === id),
            ),
        },
      };
    });
  }, [accounts, transactions, risks, selected, selectedTransaction]);
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<ReactFlowInstance<any, any> | null>(null);
  useEffect(() => {
    if (!container.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => instance.current?.fitView({ padding: 0.08 }), 100);
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial);
  useEffect(() => setNodes(initial), [initial, setNodes]);
  const edges = useMemo(
    () =>
      transactions.map((t, i) => {
        const parallel = transactions.filter((other) => other.from === t.from && other.to === t.to);
        const index = parallel.findIndex((other) => other.id === t.id);
        return {
          id: t.id,
          source: t.from,
          target: t.to,
          label: money(t.amountPaise),
          type: 'transfer',
          data: {
            parallelOffset: (index - (parallel.length - 1) / 2) * 48,
            reference: t.utr,
            inspect: () => onTransaction(t.id),
          },
          animated: t.id === selectedTransaction,
          selected: t.id === selectedTransaction,
          style: {
            stroke: t.id === selectedTransaction ? '#087f78' : i === 0 ? '#0c928a' : '#8c9aad',
            strokeWidth: t.id === selectedTransaction ? 3 : i === 0 ? 2.5 : 1.7,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: i === 0 ? '#0c928a' : '#8c9aad' },
          labelStyle: { fontSize: 11, fontWeight: 650, fill: '#39465c' },
          labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.96 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          pathOptions: { offset: 25 + (i % 3) * 12 },
        };
      }),
    [transactions, compact, selectedTransaction, onTransaction],
  );
  return (
    <div ref={container} className={`graph-canvas ${compact ? 'compact' : ''}`}>
      <ReactFlow
        key={transactions.map((t) => t.id).join('|')}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(flow) => {
          instance.current = flow;
        }}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onAccount(node.id)}
        onEdgeClick={(_, edge) => onTransaction(edge.id)}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.25}
        maxZoom={1.7}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll={!compact}
        preventScrolling={!compact}
        aria-label="Interactive money trail graph"
      >
        <Background color="#d6dfe6" gap={20} size={1} />
        <Controls showInteractive={false} />
        {!compact && (
          <>
            <MiniMap
              nodeColor={(n) =>
                n.data.role === 'victim'
                  ? '#14a399'
                  : n.data.role === 'external'
                    ? '#df9d48'
                    : '#91a5b8'
              }
              maskColor="rgba(243,247,250,.7)"
            />
          </>
        )}
      </ReactFlow>
      <div className="graph-key">
        <span>
          <i className="teal-dot" />
          Victim
        </span>
        <span>
          <i className="slate-dot" />
          Account
        </span>
        <span>
          <i className="amber-dot" />
          Missing statement
        </span>
      </div>
    </div>
  );
}
export function InfrastructureGraph({
  c,
  onSelect,
}: {
  c: CaseData;
  onSelect: (value: string) => void;
}) {
  const nodes: Node<NodeData>[] = [];
  const edges: any[] = [];
  const ids = new Set<string>();
  const add = (id: string, label: string, role: string, subtitle: string, x: number, y: number) => {
    if (ids.has(id)) return;
    ids.add(id);
    nodes.push({
      id,
      type: 'entity',
      position: { x, y },
      data: { label, subtitle, role, score: 0, selected: false },
    });
  };
  c.indicators.forEach((i, n) => {
    add(i.value, i.value, i.type, i.relation || 'Submitted indicator', 30, n * 150);
    if (i.relatedAccount) {
      const a = c.accounts.find((a) => a.id === i.relatedAccount);
      add(
        i.relatedAccount,
        a?.label || i.relatedAccount,
        'account',
        i.relatedAccount,
        340,
        n * 150,
      );
      edges.push({
        id: i.id,
        source: i.value,
        target: i.relatedAccount,
        label: 'Submitted evidence',
        style: { stroke: '#0c928a' },
        labelStyle: { fontSize: 10 },
      });
    }
  });
  c.lookups
    .filter((l) => l.type === 'domain')
    .forEach((l) =>
      l.records
        .filter((r) => r.type === 'A' || r.type === 'AAAA')
        .slice(0, 4)
        .forEach((r, n) => {
          add(
            l.indicator,
            l.indicator,
            'domain',
            `${l.mode} · ${l.observedAt.slice(0, 10)}`,
            30,
            0,
          );
          add(
            r.value,
            r.value,
            'ip',
            l.mode === 'fixture' ? 'Synthetic DNS record' : 'DNS observation',
            650,
            n * 160,
          );
          edges.push({
            id: `${l.id}-${r.value}`,
            source: l.indicator,
            target: r.value,
            label: `${r.type} · ${l.mode}`,
            style: { stroke: '#8c9aad', strokeDasharray: '5 4' },
            labelStyle: { fontSize: 10 },
          });
        }),
    );
  return (
    <div className="graph-canvas infra-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => onSelect(n.id)}
        fitView
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background gap={20} color="#d6dfe6" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
