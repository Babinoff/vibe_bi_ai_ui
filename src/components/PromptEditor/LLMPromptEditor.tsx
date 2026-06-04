import React, { useState, useEffect } from 'react';
import { Send, Loader2, Code2, Play, History, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '../../store/useStore';
import { getActualSourceData } from '../../utils/nodeGraph';

export interface HistoryItem {
  id: string;
  prompt: string;
  code: string;
  timestamp: number | string;
  [key: string]: any;
}

export interface LLMPromptEditorProps {
  nodeId: string;
  language: 'python' | 'javascript';
  colorTheme: 'blue' | 'emerald';
  topContent?: React.ReactNode;
  placeholder?: string;
  onGenerate: (
    prompt: string, 
    inputHeaders: string[], 
    inputData: any[][], 
    enableHistory: boolean, 
    history: HistoryItem[],
    addLog: (msg: string, type?: 'info'|'error'|'success') => void,
    actualSourceNode: any
  ) => Promise<{code: string, historyItemData?: any}>;
  onRun: (
    code: string, 
    inputHeaders: string[], 
    inputData: any[][], 
    addLog: (msg: string, type?: 'info'|'error'|'success') => void
  ) => Promise<void>;
}

export function LLMPromptEditor({ 
  nodeId, 
  language, 
  colorTheme, 
  topContent, 
  placeholder,
  onGenerate, 
  onRun 
}: LLMPromptEditorProps) {
  const node = useStore(s => s.nodes.find(n => n.id === nodeId));
  const updateNodeData = useStore(s => s.updateNodeData);
  
  const [localPrompt, setLocalPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<{id: string, text: string, type: 'info'|'error'|'success'}[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const prompt = (node?.data?.prompt || '') as string;
  const history: HistoryItem[] = (node?.data?.history || []) as HistoryItem[];
  const currentCode = (node?.data?.code || '') as string;
  const enableHistoryContext = (node?.data?.enableHistoryContext ?? false) as boolean;

  useEffect(() => {
    setLocalPrompt(prompt);
  }, [prompt]);

  const addLog = (text: string, type: 'info'|'error'|'success' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), text, type }]);
  };

  const themeColors = {
    blue: {
      bg: 'bg-blue-600',
      hoverBg: 'hover:bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      borderFocus: 'focus:border-blue-500',
      bgLight: 'bg-blue-100 dark:bg-blue-600/20',
      hoverBgLight: 'hover:bg-blue-200 dark:hover:bg-blue-600/40',
      groupHoverText: 'group-hover:text-blue-500 dark:group-hover:text-blue-400',
      ringFocus: 'focus:ring-blue-500'
    },
    emerald: {
      bg: 'bg-emerald-600',
      hoverBg: 'hover:bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
      borderFocus: 'focus:border-emerald-500',
      bgLight: 'bg-emerald-100 dark:bg-emerald-600/20',
      hoverBgLight: 'hover:bg-emerald-200 dark:hover:bg-emerald-600/40',
      groupHoverText: 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400',
      ringFocus: 'focus:ring-emerald-500'
    }
  };

  const colors = themeColors[colorTheme];

  const handleRunClick = async () => {
    if (!currentCode) return;
    
    setIsRunning(true);
    setLogs([]);
    setShowLogs(true);
    
    try {
      const state = useStore.getState();
      const { inputHeaders, inputData, actualSourceNode } = getActualSourceData(nodeId, state);

      if (inputHeaders.length === 0) {
        throw new Error(`No input data found. Debug: sourceNode=${actualSourceNode?.id}`);
      }
      
      await onRun(currentCode, inputHeaders, inputData, addLog);
      
      const latestHistoryItem = history[0]; // Assuming newest is first, or check logic. Let's make it newest first consistently.
      let updatedHistory = history;
      if (currentCode && (!latestHistoryItem || latestHistoryItem.code !== currentCode)) {
        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          prompt: "Пользовательская корректировка",
          code: currentCode,
          timestamp: new Date().toISOString()
        };
        updatedHistory = [newHistoryItem, ...history];
        updateNodeData(nodeId, { history: updatedHistory });
      }
      
      setTimeout(() => setShowLogs(false), 5000);
    } catch (err: any) {
      addLog(`Execution Error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleGenerateClick = async () => {
    if (!localPrompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setLogs([]);
    setShowLogs(true);
    
    try {
      const state = useStore.getState();
      const { inputHeaders, inputData, actualSourceNode } = getActualSourceData(nodeId, state);

      const result = await onGenerate(
        localPrompt, 
        inputHeaders, 
        inputData, 
        enableHistoryContext, 
        history, 
        addLog,
        actualSourceNode
      );
      
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        prompt: localPrompt,
        code: result.code,
        timestamp: new Date().toISOString(),
        ...(result.historyItemData || {})
      };

      updateNodeData(nodeId, {
        code: result.code,
        prompt: localPrompt,
        history: [newHistoryItem, ...history]
      });
      
      setTimeout(() => setShowLogs(false), 3000);
    } catch (err: any) {
      const errorMsg = err.message || 'An error occurred during generation';
      setError(errorMsg);
      addLog(`Error: ${errorMsg}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    updateNodeData(nodeId, {
      code: item.code,
      prompt: item.prompt,
      // For Visualization node we need to restore libraryId, chartType
      ...(item.libraryId ? { libraryId: item.libraryId } : {}),
      ...(item.chartType ? { chartType: item.chartType } : {})
    });
    setLocalPrompt(item.prompt);
  };

  return (
    <div className="flex flex-col gap-3 w-full nodrag cursor-default p-3 h-full overflow-y-auto custom-scrollbar">
      {topContent}

      {/* Prompt Input */}
      <div className="flex flex-col gap-1">
        <div className="relative">
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder={placeholder || "e.g., Process data..."}
            className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2 pb-8 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none ${colors.borderFocus} resize-y min-h-[64px] custom-scrollbar nodrag`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleGenerateClick();
              }
            }}
          />
          <div className="absolute bottom-0 right-0 p-1 pointer-events-none text-slate-400/50 dark:text-slate-500/50">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 10V8H10V10H8ZM5 10V8H7V10H5ZM8 7V5H10V7H8ZM2 10V8H4V10H2ZM5 7V5H7V7H5ZM8 4V2H10V4H8Z" fill="currentColor"/>
            </svg>
          </div>
          <button
            onClick={handleGenerateClick}
            disabled={isGenerating || !localPrompt.trim()}
            className={`absolute bottom-2 right-4 p-1 ${colors.bg} ${colors.hoverBg} disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded transition-colors nodrag`}
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
            checked={enableHistoryContext}
            onChange={(e) => updateNodeData(nodeId, { enableHistoryContext: e.target.checked })}
            className={`rounded border-slate-300 dark:border-slate-600 ${colors.text} ${colors.ringFocus} bg-white dark:bg-slate-900`}
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
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 nodrag ${isEditing ? `${colors.bgLight} ${colors.text}` : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
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
              onClick={handleRunClick}
              disabled={isRunning || !currentCode}
              className={`flex items-center gap-1 text-[10px] ${colors.bgLight} ${colors.text} ${colors.hoverBgLight} px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed nodrag`}
              title="Run Code"
            >
              {isRunning ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
              Run
            </button>
          </div>
        </div>
        
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-slate-50 dark:bg-[#1e1e1e] relative h-32 shrink-0">
          {currentCode || isEditing ? (
            isEditing ? (
              <textarea
                value={currentCode}
                onChange={(e) => updateNodeData(nodeId, { code: e.target.value })}
                spellCheck={false}
                className="w-full h-full bg-transparent text-slate-700 dark:text-slate-300 text-[10px] font-mono p-2 resize-none focus:outline-none custom-scrollbar nodrag"
                placeholder={`// Write your ${language} code here...`}
              />
            ) : (
              <SyntaxHighlighter
                language={language}
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
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden shrink-0 mt-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300 transition-colors nodrag"
          >
            {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <History size={12} />
            Prompt History ({history.length})
          </button>
          
          {showHistory && (
            <div className="max-h-48 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900 p-1.5 flex flex-col gap-1.5 nodrag">
              {history.map((item) => (
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
                    <div className={`text-[10px] text-slate-700 dark:text-slate-300 line-clamp-2 ${colors.groupHoverText} transition-colors flex-1 pr-2`}>
                      {item.prompt}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <div className="text-[9px] text-slate-400 dark:text-slate-500">
                        {typeof item.timestamp === 'number' 
                          ? new Date(item.timestamp).toLocaleTimeString() 
                          : new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                      {item.libraryId && (
                        <span className="text-[8px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded">
                          {item.libraryId} {item.chartType ? `/ ${item.chartType}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {expandedHistoryId === item.id && (
                    <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700/50">
                      {item.rawResponse && (
                        <>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Full Response:</div>
                          <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto custom-scrollbar nodrag whitespace-pre-wrap mb-2">
                            {item.rawResponse}
                          </div>
                        </>
                      )}
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Configuration Code:</div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto custom-scrollbar nodrag whitespace-pre-wrap">
                        {item.code}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRestoreHistory(item); }}
                        className={`mt-1.5 w-full py-1 ${colors.bgLight} ${colors.hoverBgLight} ${colors.text} text-[10px] rounded transition-colors nodrag`}
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
