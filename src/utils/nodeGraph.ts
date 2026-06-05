import { useStore } from '../store/useStore';

export function getActualSourceData(nodeId: string, state: ReturnType<typeof useStore.getState>) {
  const incomingEdges = state.edges.filter(e => e.target === nodeId);
  const sourceNode = state.nodes.find(n => n.id === incomingEdges[0]?.source);
  
  let actualSourceNode = sourceNode;
  
  // Traverse back if it's a watch node
  while (actualSourceNode) {
    if (actualSourceNode.type === 'watch') {
      const watchIncomingEdges = state.edges.filter(e => e.target === actualSourceNode!.id);
      actualSourceNode = state.nodes.find(n => n.id === watchIncomingEdges[0]?.source);
    } else {
      break;
    }
  }
  
  let inputHeaders: string[] = [];
  let inputData: any[][] = [];

  if (actualSourceNode?.type === 'dataSource' && actualSourceNode.data.selectedSourceId) {
    const ds = state.dataSources.find(d => d.id === actualSourceNode!.data.selectedSourceId);
    if (ds) {
      inputHeaders = ds.headers || [];
      inputData = ds.data || (ds as any).previewData || [];
    }
  } else if (actualSourceNode?.data?.outputHeaders) {
    inputHeaders = (actualSourceNode.data.outputHeaders || []) as string[];
    inputData = (actualSourceNode.data.outputData || []) as any[][];
  }

  return { inputHeaders, inputData, actualSourceNode };
}
