import React, { useEffect } from 'react';
import { Position } from '@xyflow/react';
import { Database, ChevronDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { BaseNode } from './BaseNode';

export function DataSourceNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const dataSources = useStore((s) => s.dataSources);
  const updateNodeData = useStore((s) => s.updateNodeData);

  // Auto-select if only one data source exists and none is selected
  useEffect(() => {
    if (dataSources.length === 1 && !data.selectedSourceId) {
      updateNodeData(id, { selectedSourceId: dataSources[0].id });
    }
  }, [dataSources, data.selectedSourceId, id, updateNodeData]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { selectedSourceId: e.target.value });
  };

  return (
    <BaseNode
      id={id}
      title="Data Source"
      icon={<Database size={14} />}
      color="indigo"
      selected={selected}
      minWidth={100}
      className="w-full h-full"
      handles={[{ type: 'source', position: Position.Right }]}
    >
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="text-xs text-slate-500 dark:text-slate-400">Select File:</div>
        <div className="relative">
          <select 
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs text-slate-700 dark:text-slate-300 appearance-none cursor-pointer focus:outline-none focus:border-indigo-500"
            value={data.selectedSourceId || ''}
            onChange={handleSelectChange}
          >
            <option value="" disabled>Select a file...</option>
            {dataSources.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
        </div>
      </div>
    </BaseNode>
  );
}
