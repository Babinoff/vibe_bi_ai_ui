import React from 'react';
import { LayoutDashboard, ChevronLeft, ChevronRight, Maximize2, Minimize2, BarChart3, Settings2, Database, Cpu, Eye, Play, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ChartCanvas } from './ChartCanvas/ChartCanvas';
import { libraries } from '../services/chartLibs';
import { DashboardEditor } from './DashboardEditor/DashboardEditor';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export function DashboardPanel() {
  const state = useStore((s) => s.rightPanelState);
  const setState = useStore((s) => s.setRightPanelState);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectedNode = useStore((s) => s.nodes.find(n => n.id === selectedNodeId));
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);
  const dataSources = useStore((s) => s.dataSources);
  const isPresentationMode = useStore((s) => s.isPresentationMode);
  const setIsPresentationMode = useStore((s) => s.setIsPresentationMode);
  const theme = useStore((s) => s.theme);

  const isOpen = state !== 'closed';
  const isMaximized = state === 'maximized';

  const handleToggle = () => {
    setState(isOpen ? 'closed' : 'open');
  };

  const handleMaximize = () => {
    setState(isMaximized ? 'open' : 'maximized');
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('dashboard-editor-scroll-area');
    if (!element) return;
    
    try {
      const wasPresentationMode = useStore.getState().isPresentationMode;
      if (!wasPresentationMode) {
        useStore.getState().setIsPresentationMode(true);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const originalHeight = element.style.height;
      const originalOverflow = element.style.overflow;
      
      element.style.height = `${element.scrollHeight}px`;
      element.style.overflow = 'visible';

      const dataUrl = await toPng(element, {
        backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
        pixelRatio: 2,
        width: element.scrollWidth,
        height: element.scrollHeight,
      });
      
      element.style.height = originalHeight;
      element.style.overflow = originalOverflow;

      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => { img.onload = resolve; });

      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height]
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save(`dashboard-${new Date().toISOString().split('T')[0]}.pdf`);

      if (!wasPresentationMode) {
        useStore.getState().setIsPresentationMode(false);
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF. Try again or check console for details.');
    }
  };

  const renderContent = () => {
    if (!selectedNodeId) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-purple-500 dark:text-purple-400">
              <LayoutDashboard size={20} />
              <h3 className="font-semibold text-slate-900 dark:text-slate-200">Dashboard Presentation</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded transition-colors"
                title="Export to PDF"
              >
                <Download size={14} />
                PDF
              </button>
              {!isPresentationMode && (
                <button
                  onClick={() => {
                    useStore.getState().addWidget({
                      id: `widget-text-${Date.now()}`,
                      type: 'text',
                      x: 20,
                      y: 20,
                      width: 300,
                      height: 150,
                      data: 'New text widget. You can use markdown or plain text here.'
                    });
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded transition-colors"
                >
                  +Text
                </button>
              )}
              <button
                onClick={() => setIsPresentationMode(!isPresentationMode)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  isPresentationMode 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Play size={14} />
                {isPresentationMode ? 'Edit Mode' : 'Present'}
              </button>
            </div>
          </div>
          <div id="dashboard-container" className="flex-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden relative">
            <DashboardEditor />
          </div>
        </div>
      );
    }

    if (selectedNode?.type === 'visualization') {
      const libraryId = (selectedNode.data?.outputLibraryId || selectedNode.data?.libraryId || 'echarts') as string;
      const chartConfig = selectedNode.data?.outputChartConfig as any || null;

      return (
        <div className="flex flex-col h-full gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
              <BarChart3 size={20} />
              <h3 className="font-semibold text-slate-900 dark:text-slate-200">Visualization Full View</h3>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
              {libraries[libraryId]?.name || libraryId}
            </div>
          </div>
          
          <div className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 p-4 relative">
            {chartConfig ? (
              <ChartCanvas libraryId={libraryId} config={chartConfig} className="absolute inset-4" />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
                Run the visualization node to see the chart here.
              </div>
            )}
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Generated Configuration</h4>
            <pre className="text-[10px] text-slate-500 dark:text-slate-400 font-mono overflow-auto max-h-40 custom-scrollbar">
              {String(selectedNode.data?.generatedConfig || '// No configuration generated yet')}
            </pre>
          </div>
        </div>
      );
    }

    if (selectedNode?.type === 'watch') {
      const incomingEdge = edges.find(e => e.target === selectedNode.id);
      const sourceNode = nodes.find(n => n.id === incomingEdge?.source);
      
      let actualSourceNode = sourceNode;
      while (actualSourceNode) {
        if (actualSourceNode.type === 'watch') {
          const watchIncomingEdges = edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = nodes.find(n => n.id === watchIncomingEdges[0]?.source);
        } else if (actualSourceNode.type === 'transform' && (!actualSourceNode.data.outputHeaders || (actualSourceNode.data.outputHeaders as any[]).length === 0)) {
          const incomingEdges = edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
        } else if (actualSourceNode.type === 'visualization' && !actualSourceNode.data.outputChartConfig) {
          const incomingEdges = edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
        } else {
          break;
        }
      }
      
      let headers: string[] = [];
      let data: any[][] = [];

      if (actualSourceNode) {
        if (actualSourceNode.type === 'dataSource' && actualSourceNode.data.selectedSourceId) {
          const ds = dataSources.find(d => d.id === actualSourceNode.data.selectedSourceId);
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
        <div className="flex flex-col h-full gap-4">
          <div className="flex items-center gap-2 text-orange-500 dark:text-orange-400">
            <Eye size={20} />
            <h3 className="font-semibold text-slate-900 dark:text-slate-200">Watch Data</h3>
          </div>
          
          {headers.length > 0 ? (
            <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800/50 custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 shadow-sm z-10">
                  <tr>
                    {headers.map((header: string, i: number) => (
                      <th key={i} className="p-2 border-b border-r border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any[], rowIndex: number) => (
                    <tr key={rowIndex} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                      {row.map((cell: any, cellIndex: number) => (
                        <td key={cellIndex} className="p-2 border-b border-r border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[200px] truncate" title={String(cell)}>
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500">
              <span className="text-sm">No data available</span>
              <span className="text-xs mt-1">Connect to a node and click Run</span>
            </div>
          )}
        </div>
      );
    }

    if (selectedNode?.type === 'transform') {
      return (
        <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 mb-4">
          <Cpu size={24} className="mb-2 opacity-50 text-blue-500 dark:text-blue-400" />
          <span className="text-sm">Transform Properties</span>
          <span className="text-xs text-slate-500 dark:text-slate-600 mt-2 text-center px-4">Use the node interface on the canvas to edit prompts and code.</span>
        </div>
      );
    }

    if (selectedNode?.type === 'dataSource') {
      return (
        <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 mb-4">
          <Database size={24} className="mb-2 opacity-50 text-indigo-500 dark:text-indigo-400" />
          <span className="text-sm">Data Source Properties</span>
        </div>
      );
    }

    if (selectedNode?.type === 'dashboard') {
      return (
        <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 mb-4 text-center px-4">
          <LayoutDashboard size={24} className="mb-2 opacity-50 text-purple-500 dark:text-purple-400" />
          <span className="text-sm">Dashboard Node</span>
          <span className="text-xs text-slate-500 dark:text-slate-600 mt-2">Connect visualization nodes to add them to the dashboard. Deselect to view the dashboard.</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 mb-4">
        <LayoutDashboard size={24} className="mb-2 opacity-50" />
        <span className="text-sm">No node selected</span>
      </div>
    );
  };

  return (
    <div
      className={`relative h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col shrink-0 ${
        state === 'closed' ? 'w-0' : state === 'maximized' ? 'w-[80vw]' : 'w-80'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className="absolute -left-3 top-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full p-1 z-10 shadow-md transition-colors cursor-pointer"
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={`flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 overflow-hidden whitespace-nowrap'}`}>
        <div className="flex items-center gap-2 font-semibold">
          {selectedNode ? <Settings2 size={18} className="text-blue-500 dark:text-blue-400" /> : <LayoutDashboard size={18} className="text-emerald-500 dark:text-emerald-400" />}
          <span>{selectedNode ? 'Properties' : 'Dashboard'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleMaximize} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 overflow-hidden whitespace-nowrap'}`}>
        {renderContent()}
      </div>
    </div>
  );
}

