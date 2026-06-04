import React, { useState } from 'react';
import { Send, Loader2, Code2, Play, History, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '../../store/useStore';
import { LLMClient } from '../../services/llmClient';
import { PythonRunner } from '../../services/pythonRunner';
import { PromptHistoryItem, ColumnInfo } from '../../types/llm';

export function PromptEditor({ nodeId }: { nodeId: string }) {
  const node = useStore(s => s.nodes.find(n => n.id === nodeId));
  const updateNodeData = useStore(s => s.updateNodeData);
  const edges = useStore(s => s.edges);
  const nodes = useStore(s => s.nodes);
  const dataSources = useStore(s => s.dataSources);
  
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<{id: string, text: string, type: 'info'|'error'|'success'}[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const history: PromptHistoryItem[] = (node?.data?.history || []) as PromptHistoryItem[];
  const currentCode = (node?.data?.code || '') as string;

  const addLog = (text: string, type: 'info'|'error'|'success' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), text, type }]);
  };

  const handleRun = async () => {
    if (!currentCode) return;
    
    setIsRunning(true);
    setLogs([]);
    setShowLogs(true);
    addLog('Starting local Python execution...', 'info');
    
    try {
      const incomingEdges = edges.filter(e => e.target === nodeId);
      const sourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
      
      let actualSourceNode = sourceNode;
      // Traverse back if it's a watch node, or a node without output
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
        throw new Error('No input data found. Connect a Data Source first.');
      }

      addLog(`Passing ${inputData.length} rows to Python runtime...`, 'info');
      
      const result = await PythonRunner.run(currentCode, inputHeaders, inputData, (msg: string) => addLog(msg, 'info'));
      
      const latestHistoryItem = history[history.length - 1];
      let updatedHistory = history;
      if (currentCode && (!latestHistoryItem || latestHistoryItem.code !== currentCode)) {
        const newHistoryItem: PromptHistoryItem = {
          id: Date.now().toString(),
          prompt: "Пользовательская корректировка",
          code: currentCode,
          rawResponse: "Отредактировано пользователем вручную",
          timestamp: Date.now()
        };
        updatedHistory = [...history, newHistoryItem];
      }
      
      updateNodeData(nodeId, {
        outputHeaders: result.headers,
        outputData: result.data,
        history: updatedHistory
      });
      
      if (result.printed_text) {
        addLog(`Execution complete.\\nPrint output:\\n${result.printed_text}\\nResult: ${result.data.length} rows.`, 'success');
      } else {
        addLog(`Execution complete. Result: ${result.data.length} rows.`, 'success');
      }
      setTimeout(() => setShowLogs(false), 5000);
    } catch (err: any) {
      addLog(`Execution Error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setLogs([]);
    setShowLogs(true);
    
    addLog('Starting generation process...', 'info');
    
    try {
      addLog('Analyzing connected nodes...', 'info');
      // Find connected data source
      const incomingEdges = edges.filter(e => e.target === nodeId);
      const sourceNode = nodes.find(n => n.id === incomingEdges[0]?.source);
      
      let schema: ColumnInfo[] = [];
      let sampleData: Record<string, any>[] = [];

      let actualSourceNode = sourceNode;
      // Traverse back if it's a watch node, or a node without output
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

      if (actualSourceNode?.type === 'dataSource' && actualSourceNode.data.selectedSourceId) {
        const ds = dataSources.find(d => d.id === actualSourceNode.data.selectedSourceId);
        if (ds) {
          addLog(`Found data source: ${ds.name}`, 'info');
          schema = ds.headers.map(h => ({ name: h, type: 'unknown' }));
          // Get first 2 rows
          sampleData = ds.previewData.slice(0, 2).map(row => {
            const obj: Record<string, any> = {};
            ds.headers.forEach((h, i) => {
              obj[h] = row[i];
            });
            return obj;
          });
          addLog(`Extracted schema (${schema.length} columns) and sample data.`, 'info');
        } else {
          addLog('Selected data source not found in store.', 'error');
        }
      } else if (actualSourceNode?.data?.outputHeaders) {
        addLog(`Found transformed data source`, 'info');
        const headers = actualSourceNode.data.outputHeaders as string[];
        const data = actualSourceNode.data.outputData as any[][];
        schema = headers.map(h => ({ name: h, type: 'unknown' }));
        sampleData = data.slice(0, 2).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });
        addLog(`Extracted schema (${schema.length} columns) and sample data from previous transform.`, 'info');
      } else {
        addLog('No data source connected. Proceeding without context.', 'info');
      }

      const context = {
        schema,
        sampleData
      };

      const result = await LLMClient.generateCode(prompt, context, (msg) => addLog(msg, 'info'));
      
      addLog('Code generated successfully!', 'success');

      const newHistoryItem: PromptHistoryItem = {
        id: Date.now().toString(),
        prompt,
        code: result.code,
        rawResponse: result.rawResponse,
        timestamp: Date.now()
      };

      updateNodeData(nodeId, {
        code: result.code,
        prompt: prompt,
        history: [...history, newHistoryItem]
      });
      
      setPrompt('');
      // Auto-hide logs after 3 seconds on success
      setTimeout(() => setShowLogs(false), 3000);
    } catch (err: any) {
      const errorMsg = err.message || 'An error occurred during generation';
      setError(errorMsg);
      addLog(`Error: ${errorMsg}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestoreHistory = (item: PromptHistoryItem) => {
    updateNodeData(nodeId, {
      code: item.code,
      prompt: item.prompt
    });
    setPrompt(item.prompt);
  };

  return (
    <div className="flex flex-col gap-3 w-full nodrag cursor-default">
      {/* Prompt Input */}
      <div className="flex flex-col gap-1">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Group by product and calculate total amount..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2 pb-8 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-y min-h-[64px] custom-scrollbar nodrag"
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
            disabled={isGenerating || !prompt.trim()}
            className="absolute bottom-2 right-4 p-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded transition-colors"
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
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <div className="flex flex-col gap-1 border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-slate-50 dark:bg-black h-24 shrink-0">
          <div className="flex items-center justify-between bg-slate-200/80 dark:bg-slate-800/80 px-2 py-1">
            <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
              <Terminal size={10} />
              Execution Logs
            </div>
            <button onClick={() => setShowLogs(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white">
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="p-1.5 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 font-mono text-[9px] nodrag">
            {logs.map(log => (
              <div key={log.id} className={`whitespace-pre-wrap ${log.type === 'error' ? 'text-red-500 dark:text-red-400' : log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                <span className="text-slate-400 dark:text-slate-600 mr-1">[{new Date().toLocaleTimeString()}]</span>
                {log.text}
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
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${isEditing ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title="Toggle Edit Mode"
            >
              {isEditing ? 'View' : 'Edit'}
            </button>
            {!showLogs && logs.length > 0 && (
              <button 
                onClick={() => setShowLogs(true)}
                className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <Terminal size={10} />
                Show Logs
              </button>
            )}
            <button 
              onClick={handleRun}
              disabled={isRunning || !currentCode}
              className="flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-600/30 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Run Code (Simulate via LLM)"
            >
              {isRunning ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
              Run
            </button>
          </div>
        </div>
        
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-slate-50 dark:bg-[#1e1e1e] relative h-32">
          {currentCode || isEditing ? (
            isEditing ? (
              <textarea
                value={currentCode}
                onChange={(e) => updateNodeData(nodeId, { code: e.target.value })}
                spellCheck={false}
                className="w-full h-full bg-transparent text-slate-700 dark:text-slate-300 text-[10px] font-mono p-2 resize-none focus:outline-none custom-scrollbar nodrag"
                placeholder="# Write your Python code here..."
              />
            ) : (
              <SyntaxHighlighter
                language="python"
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: '0.5rem', height: '100%', fontSize: '0.75rem', backgroundColor: 'transparent' }}
                className="custom-scrollbar nodrag"
              >
                {String(currentCode)}
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
      {history.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden shrink-0">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300 transition-colors"
          >
            {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <History size={12} />
            Prompt History ({history.length})
          </button>
          
          {showHistory && (
            <div className="max-h-48 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900 p-1.5 flex flex-col gap-1.5">
              {history.slice().reverse().map((item) => (
                <div 
                  key={item.id} 
                  className="p-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group flex flex-col gap-1"
                >
                  <div 
                    className="flex justify-between items-start cursor-pointer"
                    onClick={() => {
                      setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id);
                      setPrompt(item.prompt);
                    }}
                    title="Click to copy to prompt input & expand"
                  >
                    <div className="text-[10px] text-slate-700 dark:text-slate-300 line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors flex-1 pr-2">
                      {item.prompt}
                    </div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  {expandedHistoryId === item.id && (
                    <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700/50">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Full Response:</div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto custom-scrollbar nodrag whitespace-pre-wrap">
                        {item.rawResponse}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRestoreHistory(item); }}
                        className="mt-1.5 w-full py-1 bg-blue-100 dark:bg-blue-600/20 hover:bg-blue-200 dark:hover:bg-blue-600/40 text-blue-600 dark:text-blue-400 text-[10px] rounded transition-colors"
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
  );
}

