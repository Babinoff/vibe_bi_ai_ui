import React, { useState, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { BarChart2, Settings2, Play, Loader2, Terminal, ChevronDown, ChevronRight, Code2, History, Send } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '../../store/useStore';
import { LLMClient } from '../../services/llmClient';
import { BaseNode } from './BaseNode';

export function VisualizationNode({ id, selected }: { id: string, selected?: boolean }) {
  const node = useStore(s => s.nodes.find(n => n.id === id));
  const updateNodeData = useStore(s => s.updateNodeData);
  const edges = useStore(s => s.edges);
  const nodes = useStore(s => s.nodes);
  const dataSources = useStore(s => s.dataSources);

  const libraryId = (node?.data?.libraryId || 'echarts') as string;
  const chartType = (node?.data?.chartType || 'bar') as string;
  const prompt = (node?.data?.prompt || '') as string;
  const generatedConfig = (node?.data?.generatedConfig || '') as string;
  const promptHistory = (node?.data?.promptHistory || []) as any[];
  const enablePromptHistory = (node?.data?.enablePromptHistory ?? false) as boolean;

  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<{id: string, text: string, type: 'info'|'error'|'success'}[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    setLocalPrompt(prompt);
  }, [prompt]);

  const addLog = (text: string, type: 'info'|'error'|'success' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), text, type }]);
  };

  const handleGenerate = async () => {
    if (!localPrompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setLogs([]);
    setShowLogs(true);
    addLog('Starting chart generation...', 'info');

    try {
      const state = useStore.getState();
      const incomingEdges = state.edges.filter(e => e.target === id);
      const sourceNode = state.nodes.find(n => n.id === incomingEdges[0]?.source);
      
      addLog(`[Debug] Edges to this node: ${incomingEdges.length}. Source: ${sourceNode?.id} (${sourceNode?.type})`, 'info');
      
      let actualSourceNode = sourceNode;
      while (actualSourceNode) {
        if (actualSourceNode.type === 'watch') {
          const watchIncomingEdges = state.edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = state.nodes.find(n => n.id === watchIncomingEdges[0]?.source);
        } else if (actualSourceNode.type === 'transform' && (!actualSourceNode.data.outputHeaders || (actualSourceNode.data.outputHeaders as any[]).length === 0)) {
          const incomingEdges = state.edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = state.nodes.find(n => n.id === incomingEdges[0]?.source);
        } else if (actualSourceNode.type === 'visualization' && !actualSourceNode.data.outputChartConfig) {
          const incomingEdges = state.edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = state.nodes.find(n => n.id === incomingEdges[0]?.source);
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

      if (inputHeaders.length === 0) {
        throw new Error(`No input data found. Debug: sourceNode=${actualSourceNode?.id}, type=${actualSourceNode?.type}, hasDS=${!!actualSourceNode?.data?.selectedSourceId}, dsFound=${!!state.dataSources.find(d => d.id === actualSourceNode?.data?.selectedSourceId)}, headersLen=${inputHeaders.length}`);
      }

      // Extract unique values for categorical columns (up to 20 unique values) to help LLM
      const uniqueCategories: Record<string, string[]> = {};
      inputHeaders.forEach((header, colIndex) => {
        const values = inputData.map(row => row[colIndex]);
        const isString = values.some(v => typeof v === 'string');
        if (isString) {
          const uniques = Array.from(new Set(values)).filter(Boolean).map(String);
          if (uniques.length <= 20) {
            uniqueCategories[header] = uniques;
          }
        }
      });

      addLog(`Generating chart using ${libraryId}...`, 'info');
      
      const configData = await LLMClient.generateChartConfig(
        libraryId as string,
        inputHeaders,
        inputData,
        (localPrompt as string) || `Create a chart`,
        (msg: string) => addLog(msg, 'info'),
        enablePromptHistory ? promptHistory : [],
        uniqueCategories
      );
      
      const parsedChartType = configData.chartType || chartType;
      const anyConfigData = configData as any;
      const generatedConfigStr = anyConfigData.configCode || (typeof anyConfigData.config === 'string' ? anyConfigData.config : JSON.stringify(anyConfigData.config || configData, null, 2));
      const generatedChartType = parsedChartType;

      const newHistoryItem = {
        id: Date.now().toString(),
        prompt: localPrompt || `Create a chart`,
        config: generatedConfigStr,
        libraryId,
        chartType: generatedChartType,
        timestamp: new Date().toISOString(),
      };

      updateNodeData(id, { 
        prompt: localPrompt,
        generatedConfig: generatedConfigStr,
        chartType: generatedChartType,
        outputChartConfig: null, // Reset output on new generation
        promptHistory: [newHistoryItem, ...(Array.isArray(promptHistory) ? promptHistory : [])],
      });
      
      addLog('Chart configuration generated successfully!', 'success');
      setTimeout(() => setShowLogs(false), 3000);
    } catch (err: any) {
      const errorMsg = err.message || 'An error occurred during generation';
      setError(errorMsg);
      addLog(`Error: ${errorMsg}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestoreHistory = (item: any) => {
    updateNodeData(id, { 
      prompt: item.prompt,
      generatedConfig: item.config,
      libraryId: item.libraryId || libraryId,
      chartType: item.chartType || chartType,
      outputChartConfig: null
    });
    setLocalPrompt(item.prompt);
  };

  const handleRun = () => {
    if (!generatedConfig) return;
    try {
      const state = useStore.getState();
      const incomingEdges = state.edges.filter(e => e.target === id);
      const sourceNode = state.nodes.find(n => n.id === incomingEdges[0]?.source);
      
      let actualSourceNode = sourceNode;
      while (actualSourceNode) {
        if (actualSourceNode.type === 'watch') {
          const watchIncomingEdges = state.edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = state.nodes.find(n => n.id === watchIncomingEdges[0]?.source);
        } else if (actualSourceNode.type === 'transform' && (!actualSourceNode.data.outputHeaders || (actualSourceNode.data.outputHeaders as any[]).length === 0)) {
          const incomingEdges = state.edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = state.nodes.find(n => n.id === incomingEdges[0]?.source);
        } else if (actualSourceNode.type === 'visualization' && !actualSourceNode.data.outputChartConfig) {
          const incomingEdges = state.edges.filter(e => e.target === actualSourceNode!.id);
          actualSourceNode = state.nodes.find(n => n.id === incomingEdges[0]?.source);
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

      let configCode = generatedConfig as string;
      
      // Clean up potential markdown formatting if LLM wrapped the JS code
      let cleanCode = configCode.replace(/```(?:javascript|js)?\n([\s\S]*?)```/gi, '$1').trim();

      // Create a wrapper to safely execute the generated function
      const wrapper = `
        ${cleanCode}
        if (typeof generateChart === 'function') {
          return generateChart(headers, data);
        } else {
          throw new Error("Function 'generateChart' is not defined in the generated code.");
        }
      `;

      addLog('Executing generated JavaScript code...', 'info');
      
      let parsedConfig;
      try {
        const executor = new Function('headers', 'data', wrapper);
        parsedConfig = executor(inputHeaders, inputData);
      } catch (execErr: any) {
        throw new Error(`Execution error: ${execErr.message}`);
      }

      if (!parsedConfig || typeof parsedConfig !== 'object') {
        throw new Error("generateChart must return a configuration object.");
      }

      const finalConfig = { type: chartType as any, ...parsedConfig };
      if (libraryId !== 'echarts') {
        finalConfig.data = parsedConfig.data || parsedConfig;
        finalConfig.options = parsedConfig.options || {};
      } else {
        finalConfig.data = parsedConfig;
      }
      
      const latestHistoryItem = promptHistory[0];
      let newPromptHistory = promptHistory;
      if (generatedConfig && (!latestHistoryItem || latestHistoryItem.config !== generatedConfig)) {
        const newHistoryItem = {
          id: Date.now().toString(),
          prompt: "Пользовательская корректировка",
          config: generatedConfig,
          libraryId,
          chartType,
          timestamp: new Date().toISOString(),
        };
        newPromptHistory = [newHistoryItem, ...(Array.isArray(promptHistory) ? promptHistory : [])];
      }
      
      updateNodeData(id, { 
        outputChartConfig: finalConfig,
        outputLibraryId: libraryId,
        promptHistory: newPromptHistory
      });
      addLog('Visualization running. Connect a Watch node to view.', 'success');
      setShowLogs(true);
      setTimeout(() => setShowLogs(false), 3000);
    } catch (err: any) {
      addLog(`Error running config: ${err.message}`, 'error');
      setShowLogs(true);
    }
  };

  return (
    <BaseNode
      id={id}
      title="Visualization"
      icon={<BarChart2 size={14} />}
      color="emerald"
      selected={selected}
      className="w-80"
      handles={[
        { type: 'target', position: Position.Left },
        { type: 'source', position: Position.Right }
      ]}
      headerActions={
        <button onClick={() => setShowConfig(!showConfig)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <Settings2 size={14} />
        </button>
      }
    >
      {showConfig && (
        <div className="flex flex-col gap-3 w-full p-3 h-full overflow-y-auto custom-scrollbar nodrag cursor-default">
          {/* Library Selector */}
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Library</label>
              <select 
                value={libraryId}
                onChange={(e) => updateNodeData(id, { libraryId: e.target.value })}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs text-slate-700 dark:text-slate-200 nodrag"
              >
                <option value="echarts">ECharts</option>
                <option value="chartjs">Chart.js</option>
                <option value="plotly">Plotly</option>
              </select>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="flex flex-col gap-1">
            <div className="relative">
              <textarea
                value={localPrompt}
                onChange={(e) => setLocalPrompt(e.target.value)}
                placeholder="e.g., Show revenue by month..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2 pb-8 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-y min-h-[64px] custom-scrollbar nodrag"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleGenerate();
                  }
                }}
              />
              <div className="absolute bottom-0 right-0 p-1 pointer-events-none text-slate-400/50 dark:text-slate-500/50">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 10V8H10V10H8ZM5 10V8H7V10H5ZM8 7V5H10V7H8ZM2 10V8H4V10H2ZM5 7V5H7V7H5ZM8 4V2H10V4H8Z" fill="currentColor"/>
                </svg>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !localPrompt.trim()}
                className="absolute bottom-2 right-4 p-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded transition-colors nodrag"
                title="Generate (Cmd/Ctrl + Enter)"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
            {error && (
              <div className="text-[10px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-1.5 rounded">
                {error}
              </div>
            )}
            <label className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300 cursor-pointer nodrag mt-1">
              <input 
                type="checkbox" 
                checked={enablePromptHistory}
                onChange={(e) => updateNodeData(id, { enablePromptHistory: e.target.checked })}
                className="rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-slate-900"
              />
              Включить контекст истории
            </label>
          </div>

          {/* Logs Panel */}
          {showLogs && (
            <div className="flex flex-col gap-1 border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-slate-50 dark:bg-black h-24 shrink-0">
              <div className="flex items-center justify-between bg-slate-200/80 dark:bg-slate-800/80 px-2 py-1">
                <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                  <Terminal size={10} />
                  Execution Logs
                </div>
                <button onClick={() => setShowLogs(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white nodrag">
                  <ChevronDown size={12} />
                </button>
              </div>
              <div className="p-1.5 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 font-mono text-[9px] nodrag select-text cursor-text">
                {logs.map(log => (
                  <div key={log.id} className={`whitespace-pre-wrap ${log.type === 'error' ? 'text-red-500 dark:text-red-400' : log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    <span className="text-slate-400 dark:text-slate-600 mr-1 select-none">[{new Date().toLocaleTimeString()}]</span>
                    <span className="select-text">{log.text}</span>
                  </div>
                ))}
                {isGenerating && (
                  <div className="text-slate-400 dark:text-slate-500 animate-pulse">...</div>
                )}
              </div>
            </div>
          )}

          {/* Code Display */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Code2 size={12} />
                Generated Code
              </label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 nodrag ${isEditing ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  title="Toggle Edit Mode"
                >
                  {isEditing ? 'View' : 'Edit'}
                </button>
                {!showLogs && logs.length > 0 && (
                  <button 
                    onClick={() => setShowLogs(true)}
                    className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center gap-1 nodrag"
                  >
                    <Terminal size={10} />
                    Show Logs
                  </button>
                )}
                <button 
                  onClick={handleRun}
                  disabled={!generatedConfig}
                  className="flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-600/30 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed nodrag"
                  title="Run Code"
                >
                  <Play size={10} />
                  Run
                </button>
              </div>
            </div>
            
            <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-slate-50 dark:bg-[#1e1e1e] relative h-32 shrink-0">
              {generatedConfig || isEditing ? (
                isEditing ? (
                  <textarea
                    value={generatedConfig}
                    onChange={(e) => updateNodeData(id, { generatedConfig: e.target.value })}
                    spellCheck={false}
                    className="w-full h-full bg-transparent text-slate-700 dark:text-slate-300 text-[10px] font-mono p-2 resize-none focus:outline-none custom-scrollbar nodrag"
                    placeholder="// Write your JavaScript code here..."
                  />
                ) : (
                  <SyntaxHighlighter
                    language="javascript"
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '0.5rem', height: '100%', fontSize: '0.75rem', backgroundColor: 'transparent' }}
                    className="custom-scrollbar nodrag"
                  >
                    {String(generatedConfig)}
                  </SyntaxHighlighter>
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-600 text-[10px]">
                  No code generated yet
                </div>
              )}
            </div>
          </div>

          {/* History Panel */}
          {promptHistory.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden shrink-0 mt-2">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300 transition-colors nodrag"
              >
                {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <History size={12} />
                Prompt History ({promptHistory.length})
              </button>
              
              {showHistory && (
                <div className="max-h-48 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900 p-1.5 flex flex-col gap-1.5 nodrag">
                  {promptHistory.map((item: any) => (
                    <div 
                      key={item.id} 
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group flex flex-col gap-1"
                    >
                      <div 
                        className="flex justify-between items-start cursor-pointer"
                        onClick={() => {
                          setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id);
                          setLocalPrompt(item.prompt);
                        }}
                        title="Click to copy to prompt input & expand"
                      >
                        <div className="text-[10px] text-slate-700 dark:text-slate-300 line-clamp-2 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors flex-1 pr-2">
                          {item.prompt}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <div className="text-[9px] text-slate-400 dark:text-slate-500">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </div>
                          <span className="text-[8px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded">
                            {item.libraryId} / {item.chartType}
                          </span>
                        </div>
                      </div>
                      
                      {expandedHistoryId === item.id && (
                        <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700/50">
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Configuration Code:</div>
                          <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto custom-scrollbar nodrag whitespace-pre-wrap">
                            {item.config}
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRestoreHistory(item); }}
                            className="mt-1.5 w-full py-1 bg-emerald-100 dark:bg-emerald-600/20 hover:bg-emerald-200 dark:hover:bg-emerald-600/40 text-emerald-600 dark:text-emerald-400 text-[10px] rounded transition-colors nodrag"
                          >
                            Restore this version
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </BaseNode>
  );
}

