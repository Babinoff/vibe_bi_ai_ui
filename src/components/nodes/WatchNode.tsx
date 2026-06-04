import React from 'react';
import { Position } from '@xyflow/react';
import { Eye, Table2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ChartCanvas } from '../ChartCanvas/ChartCanvas';
import { BaseNode } from './BaseNode';

export function WatchNode({ id, selected }: { id: string, selected?: boolean }) {
  const edges = useStore(s => s.edges);
  const nodes = useStore(s => s.nodes);
  const dataSources = useStore(s => s.dataSources);
  
  const incomingEdge = edges.find(e => e.target === id);
  const sourceNode = nodes.find(n => n.id === incomingEdge?.source);
  
  let actualSourceNode = sourceNode;
  // Traverse back if the source is a watch node, or a transform node without output
  while (actualSourceNode) {
    if (actualSourceNode.type === 'watch') {
      const watchIncomingEdges = edges.filter(e => e.target === actualSourceNode!.id);
      actualSourceNode = nodes.find(n => n.id === watchIncomingEdges[0]?.source);
    } else if (actualSourceNode.type === 'transform' && (!actualSourceNode.data.outputHeaders || (actualSourceNode.data.outputHeaders as any[]).length === 0)) {
      // If transform hasn't run, show its input (raw data)
      const incomingEdges = edges.filter(e => e.target === actualSourceNode!.id);
      actualSourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
    } else if (actualSourceNode.type === 'visualization' && !actualSourceNode.data.outputChartConfig) {
      // If visualization hasn't run, show its input data
      const incomingEdges = edges.filter(e => e.target === actualSourceNode!.id);
      actualSourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
    } else {
      break;
    }
  }
  
  let headers: string[] = [];
  let data: any[][] = [];
  let outputChartConfig = null;
  let outputLibraryId = null;

  if (actualSourceNode) {
    console.log('WatchNode actualSourceNode:', actualSourceNode);
    console.log('WatchNode dataSources:', dataSources);
    if (actualSourceNode.type === 'visualization') {
      outputChartConfig = actualSourceNode.data.outputChartConfig;
      outputLibraryId = actualSourceNode.data.outputLibraryId;
    } else if (actualSourceNode.type === 'dataSource' && actualSourceNode.data.selectedSourceId) {
      const ds = dataSources.find(d => d.id === actualSourceNode.data.selectedSourceId);
      console.log('WatchNode found ds:', ds);
      if (ds) {
        headers = ds.headers;
        data = ds.previewData;
      }
    } else {
      headers = (actualSourceNode.data.outputHeaders || []) as string[];
      data = (actualSourceNode.data.outputData || []) as any[][];
    }
  }

  return (
    <BaseNode
      id={id}
      title="Watch"
      icon={<Eye size={14} />}
      color="orange"
      selected={selected}
      resizable={true}
      minWidth={200}
      minHeight={150}
      className="w-full h-full"
      handles={[
        { type: 'target', position: Position.Left },
        { type: 'source', position: Position.Right }
      ]}
    >
      <div className="p-2 flex-1 overflow-hidden flex flex-col relative nodrag">
        {outputChartConfig && outputLibraryId ? (
            <div className="absolute inset-2">
              <ChartCanvas libraryId={outputLibraryId} config={outputChartConfig} className="w-full h-full" />
            </div>
          ) : headers.length > 0 ? (
            <div className="flex flex-col gap-1 h-full">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 shrink-0">
                <Table2 size={10} />
                {data.length} rows, {headers.length} cols
              </div>
              <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse text-[8px]">
                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 text-slate-700 dark:text-slate-300">
                    <tr>
                      {headers.slice(0, 10).map((h: string, i: number) => (
                        <th key={i} className="p-1 border-b border-r border-slate-200 dark:border-slate-700 truncate max-w-[100px]">{h}</th>
                      ))}
                      {headers.length > 10 && <th className="p-1 border-b border-slate-200 dark:border-slate-700">...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 50).map((row: any[], rowIndex: number) => (
                      <tr key={rowIndex} className="bg-white dark:bg-slate-800">
                        {row.slice(0, 10).map((cell: any, cellIndex: number) => (
                          <td key={cellIndex} className="p-1 border-b border-r border-slate-200 dark:border-slate-700 truncate max-w-[100px] text-slate-600 dark:text-slate-300">
                            {String(cell)}
                          </td>
                        ))}
                        {row.length > 10 && <td className="p-1 border-b border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center h-full">No data. Run source node.</div>
          )}
        </div>
    </BaseNode>
  );
}

