import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  NodeMouseHandler,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Upload, Sun, Moon, Zap } from 'lucide-react';

import { useStore, AppNode } from '../store/useStore';
import { NODE_CONFIG } from '../config/nodeConfig';
import { DataSourceNode } from './nodes/DataSourceNode';
import { TransformNode } from './nodes/TransformNode';
import { VisualizationNode } from './nodes/VisualizationNode';
import { WatchNode } from './nodes/WatchNode';
import { DashboardNode } from './nodes/DashboardNode';

const nodeTypes = {
  dataSource: DataSourceNode,
  transform: TransformNode,
  visualization: VisualizationNode,
  watch: WatchNode,
  dashboard: DashboardNode,
};

function FlowEditor() {
  const { 
    nodes, edges, dataSources, onNodesChange, onEdgesChange, onConnect, 
    addNode, setSelectedNodeId, loadWorkspace, theme, toggleTheme, 
    llmProvider, setLlmProvider, mistralToken, setMistralToken, geminiToken, setGeminiToken,
    openaiToken, setOpenaiToken, claudeToken, setClaudeToken
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [clipboard, setClipboard] = useState<{nodes: AppNode[], edges: any[]}>({ nodes: [], edges: [] });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Do not trigger copy/paste if user is typing in an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const state = useStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selectedNodes = state.nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          const selectedEdges = state.edges.filter(
            edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
          );
          setClipboard({ nodes: selectedNodes, edges: selectedEdges });
        } else if (state.selectedNodeId) {
          // Fallback if no nodes are strictly 'selected' but we have one active
          const nodeToCopy = state.nodes.find(n => n.id === state.selectedNodeId);
          if (nodeToCopy) {
            setClipboard({ nodes: [nodeToCopy], edges: [] });
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const selectedNodes = state.nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          state.duplicateNodes(selectedNodes.map(n => n.id));
        } else if (state.selectedNodeId) {
          state.duplicateNodes([state.selectedNodeId]);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard.nodes.length > 0) {
          const idMap = new Map<string, string>();
          
          const newNodes = clipboard.nodes.map(node => {
            const clonedNode = JSON.parse(JSON.stringify(node));
            const newId = `${clonedNode.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            idMap.set(node.id, newId);
            
            return {
              ...clonedNode,
              id: newId,
              position: {
                x: clonedNode.position.x + 50,
                y: clonedNode.position.y + 50,
              },
              selected: true,
            };
          });

          const newEdges = clipboard.edges.map(edge => {
            const clonedEdge = JSON.parse(JSON.stringify(edge));
            return {
              ...clonedEdge,
              id: `e-${idMap.get(edge.source)}-${idMap.get(edge.target)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              source: idMap.get(edge.source)!,
              target: idMap.get(edge.target)!,
              selected: true,
            };
          });

          state.addNodesAndEdges(newNodes, newEdges);
          
          if (newNodes.length === 1) {
            state.setSelectedNodeId(newNodes[0].id);
          }
          
          // Update clipboard so pasting again offsets further
          setClipboard({ nodes: newNodes, edges: newEdges });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clipboard]);

  const handleAddNode = (type: string) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    
    // Slight random offset so they don't stack perfectly
    position.x += (Math.random() - 0.5) * 50;
    position.y += (Math.random() - 0.5) * 50;

    const newNode: any = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: { label: `New ${type} node` },
      style: { 
        width: type === 'dataSource' || type === 'dashboard' 
          ? NODE_CONFIG.defaultWidth / 2 
          : NODE_CONFIG.defaultWidth 
      },
    };

    if (type === 'watch') {
      newNode.style.height = NODE_CONFIG.defaultHeight;
    }

    addNode(newNode);
  };

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleSave = () => {
    const workspace = { 
      nodes: useStore.getState().nodes, 
      edges: useStore.getState().edges, 
      dataSources: useStore.getState().dataSources,
      widgets: useStore.getState().widgets
    };
    const json = JSON.stringify(workspace, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const workspace = JSON.parse(content);
        if (workspace.nodes && workspace.edges && workspace.dataSources) {
          loadWorkspace(workspace);
        } else {
          alert('Invalid workspace file format.');
        }
      } catch (err) {
        console.error('Failed to parse workspace file:', err);
        alert('Failed to load workspace.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be loaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const memoizedNodeTypes = React.useMemo(() => nodeTypes, []);

  return (
    <div className="absolute inset-0">
      <input 
        type="file" 
        accept=".json" 
        ref={fileInputRef} 
        onChange={handleLoad} 
        className="hidden" 
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={memoizedNodeTypes}
        fitView
        minZoom={0.05}
        colorMode={theme}
        className="bg-slate-50 dark:bg-slate-950 transition-colors"
      >
        <Background color={theme === 'dark' ? '#475569' : '#cbd5e1'} variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 fill-slate-700 dark:fill-slate-200" />
        <MiniMap 
          nodeColor={(node) => {
            switch (node.type) {
              case 'dataSource': return '#6366f1'; // indigo-500
              case 'transform': return '#3b82f6'; // blue-500
              case 'visualization': return '#10b981'; // emerald-500
              case 'watch': return '#f97316'; // orange-500
              default: return '#94a3b8'; // slate-400
            }
          }}
          maskColor={theme === 'dark' ? "rgba(15, 23, 42, 0.7)" : "rgba(248, 250, 252, 0.7)"}
          className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
        />
        
        <Panel position="top-right" className="flex flex-col gap-2">
          <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 backdrop-blur-sm flex gap-2 justify-end shadow-sm items-center">
            <input
              type="password"
              placeholder={`${llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)} API Key`}
              value={
                llmProvider === 'mistral' ? mistralToken :
                llmProvider === 'gemini' ? geminiToken :
                llmProvider === 'openai' ? openaiToken :
                claudeToken
              }
              onChange={(e) => {
                if (llmProvider === 'mistral') setMistralToken(e.target.value);
                else if (llmProvider === 'gemini') setGeminiToken(e.target.value);
                else if (llmProvider === 'openai') setOpenaiToken(e.target.value);
                else setClaudeToken(e.target.value);
              }}
              className="px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title={`Enter your ${llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)} API Key`}
            />
            <div className="relative flex items-center">
              <div className="absolute left-2 text-slate-500 dark:text-slate-400 pointer-events-none">
                <Zap size={14} />
              </div>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as any)}
                className="pl-7 pr-6 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                title="Select LLM Provider"
              >
                <option value="mistral">Mistral</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
              </select>
            </div>
            <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button 
              onClick={() => toggleTheme()}
              className="flex items-center justify-center w-7 h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs rounded transition-colors"
              title="Load Workspace"
            >
              <Upload size={14} />
              Load
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs rounded transition-colors"
              title="Save Workspace"
            >
              <Save size={14} />
              Save
            </button>
          </div>
          <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 backdrop-blur-sm flex gap-2 shadow-sm">
            <button 
              onClick={() => handleAddNode('dataSource')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition-colors"
            >
              + Data Source
            </button>
            <button 
              onClick={() => handleAddNode('transform')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              + Transform
            </button>
            <button 
              onClick={() => handleAddNode('watch')}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors"
            >
              + Watch
            </button>
            <button 
              onClick={() => handleAddNode('visualization')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors"
            >
              + Visualization
            </button>
            <button 
              onClick={() => handleAddNode('dashboard')}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
            >
              + Dashboard
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function NodeEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
