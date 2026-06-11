import React from 'react';
import { Position } from '@xyflow/react';
import { LayoutDashboard } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { BaseNode } from './BaseNode';

export function DashboardNode({ id, selected }: { id: string, selected?: boolean }) {
  const edges = useStore(s => s.edges);
  const nodes = useStore(s => s.nodes);

  const incomingEdges = edges.filter(e => e.target === id);

  return (
    <BaseNode
      id={id}
      title="Dashboard"
      icon={<LayoutDashboard size={14} />}
      color="purple"
      selected={selected}
      className="w-full h-full"
      handles={[{ type: 'target', position: Position.Left }]}
    >
      <div className="p-3 flex flex-col gap-3 h-full overflow-auto custom-scrollbar">
        <div className="text-[10px] text-slate-500 dark:text-slate-400">
          Connected Inputs: {incomingEdges.length}
        </div>
        
        <div className="flex flex-col gap-1">
          {incomingEdges.map((edge, i) => (
            <div key={edge.id} className="text-[9px] text-slate-600 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
              IN[{i}]: {nodes.find(n => n.id === edge.source)?.type || 'Unknown'}
            </div>
          ))}
          {incomingEdges.length === 0 && (
            <div className="text-[9px] text-slate-400 dark:text-slate-600 italic">No inputs connected</div>
          )}
        </div>
      </div>
    </BaseNode>
  );
}
