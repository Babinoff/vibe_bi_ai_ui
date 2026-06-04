import React, { useState } from 'react';
import { Position } from '@xyflow/react';
import { BarChart2, Settings2, Play, Loader2, Terminal, ChevronDown, Code2, History } from 'lucide-react';
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

  const addLog = (text: string, type: 'info'|'error'|'success' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), text, type }]);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setLogs([]);
    setShowLogs(true);
    addLog('Starting chart generation...', 'info');

    try {
      const incomingEdges = edges.filter(e => e.target === id);
      const sourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
      
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
      
      let inputHeaders: string[] = [];
      let inputData: any[][] = [];

      if (actualSourceNode?.type === 'dataSource' && actualSourceNode.data.selectedSourceId) {
        const ds = dataSources.find(d => d.id === actualSourceNode.data.selectedSourceId);
        if (ds) {
          inputHeaders = ds.headers;
          inputData = ds.previewData;
        }
      } else if (actualSourceNode?.data?.outputHeaders) {
        inputHeaders = (actualSourceNode.data.outputHeaders || []) as string[];
        inputData = (actualSourceNode.data.outputData || []) as any[][];
      }

      if (inputHeaders.length === 0) {
        throw new Error('No input data found. Connect a Data Source or Transform node first.');
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
        (prompt as string) || `Create a chart`,
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
        prompt: prompt || `Create a chart`,
        config: generatedConfigStr,
        libraryId,
        chartType: generatedChartType,
        timestamp: new Date().toISOString(),
      };

      updateNodeData(id, { 
        generatedConfig: generatedConfigStr,
        chartType: generatedChartType,
        outputChartConfig: null, // Reset output on new generation
        promptHistory: [newHistoryItem, ...(Array.isArray(promptHistory) ? promptHistory : [])],
      });
      
      addLog('Chart configuration generated successfully!', 'success');
      setTimeout(() => setShowLogs(false), 3000);
    } catch (err: any) {
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRun = () => {
    if (!generatedConfig) return;
    try {
      const incomingEdges = edges.filter(e => e.target === id);
      const sourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
      
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
      
      let inputHeaders: string[] = [];
      let inputData: any[][] = [];

      if (actualSourceNode?.type === 'dataSource' && actualSourceNode.data.selectedSourceId) {
        const ds = dataSources.find(d => d.id === actualSourceNode.data.selectedSourceId);
        if (ds) {
          inputHeaders = ds.headers;
          inputData = ds.previewData;
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
      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
        {showConfig && (
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 nodrag cursor-default shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Library</label>
              <select 
                value={libraryId}
                onChange={(e) => updateNodeData(id, { libraryId: e.target.value })}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="echarts">ECharts</option>
                <option value="chartjs">Chart.js</option>
                <option value="plotly">Plotly</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Prompt (Optional)</label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
                placeholder="e.g., Show revenue by month..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 pb-5 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-y min-h-[48px] custom-scrollbar nodrag"
              />
              <div className="absolute bottom-0 right-0 p-1 pointer-events-none text-slate-400/50 dark:text-slate-500/50">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 10V8H10V10H8ZM5 10V8H7V10H5ZM8 7V5H10V7H8ZM2 10V8H4V10H2ZM5 7V5H7V7H5ZM8 4V2H10V4H8Z" fill="currentColor"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Logs Panel */}
          {showLogs && (
            <div className="flex flex-col gap-1 bg-slate-100 dark:bg-black rounded border border-slate-200 dark:border-slate-700 h-24 shrink-0 overflow-hidden">
              <div className="flex items-center justify-between bg-slate-200/80 dark:bg-slate-800/80 px-2 py-1">
                <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                  <Terminal size={10} />
                  Logs
                </div>
                <button onClick={() => setShowLogs(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white">
                  <ChevronDown size={12} />
                </button>
              </div>
              <div className="p-1.5 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 font-mono text-[9px]">
                {logs.map(log => (
                  <div key={log.id} className={`${log.type === 'error' ? 'text-red-500 dark:text-red-400' : log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    <span className="text-slate-400 dark:text-slate-600 mr-1">[{new Date().toLocaleTimeString()}]</span>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300 cursor-pointer nodrag">
              <input 
                type="checkbox" 
                checked={enablePromptHistory}
                onChange={(e) => updateNodeData(id, { enablePromptHistory: e.target.checked })}
                className="rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-slate-900"
              />
              Включить историю промта
            </label>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs rounded transition-colors nodrag"
            >
              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Settings2 size={12} />}
              Generate Config
            </button>
          </div>
        </div>
      )}

      {/* Code Editor Area */}
      <div className="flex flex-col border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 h-48 shrink-0 nodrag">
        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 px-2 py-1 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            <Code2 size={12} />
            Configuration (JavaScript)
          </div>
          <button
            onClick={handleRun}
            disabled={!generatedConfig}
            className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-[10px] rounded transition-colors"
          >
            <Play size={10} />
            Run
          </button>
        </div>
        <textarea
          value={generatedConfig}
          onChange={(e) => updateNodeData(id, { generatedConfig: e.target.value })}
          spellCheck={false}
          className="flex-1 w-full bg-transparent text-slate-700 dark:text-slate-300 text-[10px] font-mono p-2 resize-none focus:outline-none custom-scrollbar"
          placeholder="// Generated JavaScript function will appear here..."
        />
      </div>

      {/* Prompt History */}
      {promptHistory.length > 0 && (
          <div className="flex flex-col border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 h-24 shrink-0 nodrag">
            <div className="flex items-center justify-between bg-slate-100/80 dark:bg-slate-800/80 px-2 py-1">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                <History size={10} />
                Prompt History
              </div>
            </div>
            <div className="p-1.5 overflow-y-auto custom-scrollbar flex flex-col gap-1">
              {promptHistory.map((item: any) => (
                <div 
                  key={item.id} 
                  className="bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer transition-colors"
                  onClick={() => {
                    updateNodeData(id, { 
                      prompt: item.prompt,
                      generatedConfig: item.config,
                      libraryId: item.libraryId || libraryId,
                      chartType: item.chartType || chartType,
                      outputChartConfig: null
                    });
                  }}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    <span className="text-[8px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded">
                      {item.libraryId} / {item.chartType}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2">
                    {item.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}

