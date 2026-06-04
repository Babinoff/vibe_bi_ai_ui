import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';

export type AppNode = Node;

export type DataSource = {
  id: string;
  name: string;
  headers: string[];
  data: any[][];
};

export interface WidgetConfig {
  id: string;
  type: 'chart' | 'text' | 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  data: any;
  libraryId?: string;
}

type PanelState = 'closed' | 'open' | 'maximized';

type AppState = {
  nodes: AppNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: AppNode) => void;
  addNodesAndEdges: (nodes: AppNode[], edges: Edge[]) => void;
  duplicateNodes: (ids: string[]) => void;
  updateNodeData: (id: string, data: any) => void;

  dataSources: DataSource[];
  addDataSource: (ds: DataSource) => void;
  removeDataSource: (id: string) => void;

  leftPanelState: PanelState;
  rightPanelState: PanelState;
  setLeftPanelState: (state: PanelState) => void;
  setRightPanelState: (state: PanelState) => void;

  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  selectedDataValue: string | null;
  setSelectedDataValue: (val: string | null) => void;

  widgets: WidgetConfig[];
  addWidget: (widget: WidgetConfig) => void;
  updateWidget: (id: string, data: Partial<WidgetConfig>) => void;
  removeWidget: (id: string) => void;

  isPresentationMode: boolean;
  setIsPresentationMode: (val: boolean) => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  llmProvider: 'mistral' | 'gemini' | 'openai' | 'claude';
  setLlmProvider: (provider: 'mistral' | 'gemini' | 'openai' | 'claude') => void;

  mistralToken: string;
  setMistralToken: (token: string) => void;
  geminiToken: string;
  setGeminiToken: (token: string) => void;
  openaiToken: string;
  setOpenaiToken: (token: string) => void;
  claudeToken: string;
  setClaudeToken: (token: string) => void;

  loadWorkspace: (workspace: { nodes: AppNode[], edges: Edge[], dataSources: DataSource[], widgets?: WidgetConfig[] }) => void;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      onNodesChange: (changes: NodeChange<AppNode>[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      onConnect: (connection: Connection) => {
        set({
          edges: addEdge(connection, get().edges),
        });
      },
      addNode: (node: AppNode) => {
        set({
          nodes: [...get().nodes, node],
        });
      },
      addNodesAndEdges: (newNodes: AppNode[], newEdges: Edge[]) => {
        set({
          nodes: [
            ...get().nodes.map((n) => ({ ...n, selected: false })),
            ...newNodes,
          ],
          edges: [
            ...get().edges.map((e) => ({ ...e, selected: false })),
            ...newEdges,
          ],
        });
      },
      duplicateNodes: (ids: string[]) => {
        const state = get();
        const nodesToCopy = state.nodes.filter((n) => ids.includes(n.id));
        if (nodesToCopy.length === 0) return;

        const idMap = new Map<string, string>();
        const newNodes: AppNode[] = nodesToCopy.map((node) => {
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

        const edgesToCopy = state.edges.filter(
          (edge) => idMap.has(edge.source) && idMap.has(edge.target)
        );

        const newEdges: Edge[] = edgesToCopy.map((edge) => {
          const clonedEdge = JSON.parse(JSON.stringify(edge));
          return {
            ...clonedEdge,
            id: `e-${idMap.get(edge.source)}-${idMap.get(edge.target)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            source: idMap.get(edge.source)!,
            target: idMap.get(edge.target)!,
            selected: true,
          };
        });

        set({
          nodes: [
            ...state.nodes.map((n) => ({ ...n, selected: false })),
            ...newNodes,
          ],
          edges: [
            ...state.edges.map((e) => ({ ...e, selected: false })),
            ...newEdges,
          ],
          selectedNodeId: newNodes.length === 1 ? newNodes[0].id : null,
        });
      },
      updateNodeData: (id: string, data: any) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id === id) {
              return { ...node, data: { ...node.data, ...data } };
            }
            return node;
          }),
        });
      },

      dataSources: [],
      addDataSource: (ds: DataSource) => {
        set({ dataSources: [...get().dataSources, ds] });
      },
      removeDataSource: (id: string) => {
        set({ dataSources: get().dataSources.filter((d) => d.id !== id) });
      },

      leftPanelState: 'open',
      rightPanelState: 'open',
      setLeftPanelState: (state: PanelState) => {
        set({ 
          leftPanelState: state,
          ...(state === 'maximized' ? { rightPanelState: get().rightPanelState === 'maximized' ? 'closed' : get().rightPanelState } : {})
        });
      },
      setRightPanelState: (state: PanelState) => {
        set({ 
          rightPanelState: state,
          ...(state === 'maximized' ? { leftPanelState: get().leftPanelState === 'maximized' ? 'closed' : get().leftPanelState } : {})
        });
      },

      selectedNodeId: null,
      setSelectedNodeId: (id: string | null) => {
        set({ selectedNodeId: id });
      },

      selectedDataValue: null,
      setSelectedDataValue: (val: string | null) => {
        set({ selectedDataValue: val });
      },

      widgets: [],
      addWidget: (widget: WidgetConfig) => {
        set({ widgets: [...get().widgets, widget] });
      },
      updateWidget: (id: string, data: Partial<WidgetConfig>) => {
        set({
          widgets: get().widgets.map((w) => (w.id === id ? { ...w, ...data } : w)),
        });
      },
      removeWidget: (id: string) => {
        set({ widgets: get().widgets.filter((w) => w.id !== id) });
      },

      isPresentationMode: false,
      setIsPresentationMode: (val: boolean) => {
        set({ isPresentationMode: val });
      },

      theme: 'dark',
      toggleTheme: () => {
        set({ theme: get().theme === 'dark' ? 'light' : 'dark' });
      },

      llmProvider: 'mistral',
      setLlmProvider: (provider) => {
        set((state) => {
          const updates: Partial<AppState> = { llmProvider: provider };
          if (provider === 'mistral' && !state.mistralToken) {
            updates.mistralToken = (import.meta as any).env.VITE_MISTRAL_API_KEY || '';
          }
          return updates;
        });
      },

      mistralToken: (import.meta as any).env.VITE_MISTRAL_API_KEY || '',
      setMistralToken: (token) => {
        set({ mistralToken: token });
      },

      geminiToken: '',
      setGeminiToken: (token) => {
        set({ geminiToken: token });
      },

      openaiToken: '',
      setOpenaiToken: (token) => {
        set({ openaiToken: token });
      },

      claudeToken: '',
      setClaudeToken: (token) => {
        set({ claudeToken: token });
      },

      loadWorkspace: (workspace) => {
        set({
          nodes: workspace.nodes || [],
          edges: workspace.edges || [],
          dataSources: (workspace.dataSources || []).map(ds => ({
            ...ds,
            data: ds.data || (ds as any).previewData || []
          })),
          widgets: workspace.widgets || [],
          selectedNodeId: null,
          selectedDataValue: null,
        });
      },
    }),
    {
      name: 'biui-workspace-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        dataSources: state.dataSources,
        widgets: state.widgets,
        leftPanelState: state.leftPanelState,
        rightPanelState: state.rightPanelState,
        theme: state.theme,
        llmProvider: state.llmProvider,
        mistralToken: state.mistralToken,
        geminiToken: state.geminiToken,
        openaiToken: state.openaiToken,
        claudeToken: state.claudeToken,
      }),
    }
  )
);
