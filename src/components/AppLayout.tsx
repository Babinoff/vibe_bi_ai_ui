import React, { useEffect } from 'react';
import { DataSourcePanel } from './DataSourcePanel';
import { NodeCanvas } from './NodeCanvas';
import { DashboardPanel } from './DashboardPanel';
import { useStore } from '../store/useStore';

export function AppLayout() {
  const theme = useStore(s => s.theme);
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Sync dashboard widgets with connected visualization nodes
  useEffect(() => {
    const currentWidgets = useStore.getState().widgets;
    const addWidget = useStore.getState().addWidget;
    const updateWidget = useStore.getState().updateWidget;
    const removeWidget = useStore.getState().removeWidget;
    const dataSources = useStore.getState().dataSources;
    
    const connectedWidgetIds = new Set<string>();
    const processedSourceIds = new Set<string>();

    // Find all edges connected to ANY dashboard node
    const allDashboardEdges = edges.filter(e => nodes.find(n => n.id === e.target)?.type === 'dashboard');

    allDashboardEdges.forEach((edge, index) => {
      let sourceNode = nodes.find(n => n.id === edge.source);
      
      // Traverse back if it's a watch node, or a node without output
      while (sourceNode) {
        if (sourceNode.type === 'watch') {
          const watchIncomingEdges = edges.filter(e => e.target === sourceNode!.id);
          sourceNode = nodes.find(n => n.id === watchIncomingEdges[0]?.source);
        } else if (sourceNode.type === 'transform' && (!sourceNode.data.outputHeaders || (sourceNode.data.outputHeaders as any[]).length === 0)) {
          const incomingEdges = edges.filter(e => e.target === sourceNode!.id);
          sourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
        } else if (sourceNode.type === 'visualization' && !sourceNode.data.outputChartConfig) {
          const incomingEdges = edges.filter(e => e.target === sourceNode!.id);
          sourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
        } else {
          break;
        }
      }

      if (!sourceNode) return;

      if (sourceNode.type === 'visualization' && sourceNode.data.outputChartConfig) {
        if (processedSourceIds.has(sourceNode.id)) return;
        processedSourceIds.add(sourceNode.id);

        const widgetId = `widget-${sourceNode.id}`;
        connectedWidgetIds.add(widgetId);
        
        const existingWidget = currentWidgets.find(w => w.id === widgetId);
        const newLibraryId = (sourceNode.data.outputLibraryId || sourceNode.data.libraryId || 'echarts') as string;
        
        if (!existingWidget) {
          addWidget({
            id: widgetId,
            type: 'chart',
            x: (index % 2) * 420 + 20,
            y: Math.floor(index / 2) * 320 + 20,
            width: 400,
            height: 300,
            data: sourceNode.data.outputChartConfig,
            libraryId: newLibraryId
          });
        } else {
          // Update widget data if it changed
          if (
            JSON.stringify(existingWidget.data) !== JSON.stringify(sourceNode.data.outputChartConfig) ||
            existingWidget.libraryId !== newLibraryId
          ) {
            updateWidget(widgetId, {
              data: sourceNode.data.outputChartConfig,
              libraryId: newLibraryId
            });
          }
        }
      } else {
        // Table widget for DataSource or Transform nodes
        let headers: string[] = [];
        let data: any[][] = [];

        if (sourceNode.type === 'dataSource' && sourceNode.data.selectedSourceId) {
          const ds = dataSources.find(d => d.id === sourceNode!.data.selectedSourceId);
          if (ds) {
            headers = ds.headers;
            data = ds.data;
          }
        } else if (sourceNode.type === 'transform') {
          headers = (sourceNode.data.outputHeaders || []) as string[];
          data = (sourceNode.data.outputData || []) as any[][];
        }

        if (headers.length > 0) {
          if (processedSourceIds.has(sourceNode.id)) return;
          processedSourceIds.add(sourceNode.id);

          const widgetId = `widget-${sourceNode.id}`;
          connectedWidgetIds.add(widgetId);
          
          const existingWidget = currentWidgets.find(w => w.id === widgetId);
          const tableData = { headers, data };
          
          if (!existingWidget) {
            addWidget({
              id: widgetId,
              type: 'table',
              x: (index % 2) * 420 + 20,
              y: Math.floor(index / 2) * 320 + 20,
              width: 400,
              height: 300,
              data: tableData
            });
          } else {
            // Update widget data if it changed
            if (JSON.stringify(existingWidget.data) !== JSON.stringify(tableData)) {
              updateWidget(widgetId, {
                data: tableData
              });
            }
          }
        }
      }
    });

    // Remove chart/table widgets that are no longer connected
    currentWidgets.forEach(w => {
      // Only remove widgets that were auto-generated (their ID starts with 'widget-' and they are not text widgets)
      if ((w.type === 'chart' || w.type === 'table') && w.id.startsWith('widget-') && !connectedWidgetIds.has(w.id)) {
        removeWidget(w.id);
      }
    });
  }, [nodes, edges]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-200 transition-colors">
      <DataSourcePanel />
      <NodeCanvas />
      <DashboardPanel />
    </div>
  );
}

