import React, { useState } from 'react';
import { Position } from '@xyflow/react';
import { BarChart2, Settings2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { LLMClient } from '../../services/llmClient';
import { BaseNode } from './BaseNode';
import { LLMPromptEditor } from '../PromptEditor/LLMPromptEditor';

export function VisualizationNode({ id, selected }: { id: string, selected?: boolean }) {
  const node = useStore(s => s.nodes.find(n => n.id === id));
  const updateNodeData = useStore(s => s.updateNodeData);

  const libraryId = (node?.data?.libraryId || 'echarts') as string;
  const chartType = (node?.data?.chartType || 'bar') as string;

  const [showConfig, setShowConfig] = useState(true);

  const handleGenerate = async (
    prompt: string, 
    inputHeaders: string[], 
    inputData: any[][], 
    enableHistory: boolean, 
    history: any[],
    addLog: (msg: string, type?: 'info'|'error'|'success') => void,
    actualSourceNode: any
  ) => {
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
      libraryId,
      inputHeaders,
      inputData,
      prompt || `Create a chart`,
      (msg: string) => addLog(msg, 'info'),
      enableHistory ? history : [],
      uniqueCategories
    );
    
    const parsedChartType = configData.chartType || chartType;
    const anyConfigData = configData as any;
    const generatedConfigStr = anyConfigData.configCode || (typeof anyConfigData.config === 'string' ? anyConfigData.config : JSON.stringify(anyConfigData.config || configData, null, 2));

    updateNodeData(id, { 
      chartType: parsedChartType,
      outputChartConfig: null, // Reset output on new generation
    });
    
    addLog('Chart configuration generated successfully!', 'success');
    
    return {
      code: generatedConfigStr,
      historyItemData: {
        libraryId,
        chartType: parsedChartType,
        rawResponse: generatedConfigStr
      }
    };
  };

  const handleRun = async (
    code: string, 
    inputHeaders: string[], 
    inputData: any[][], 
    addLog: (msg: string, type?: 'info'|'error'|'success') => void
  ) => {
    // Clean up potential markdown formatting if LLM wrapped the JS code
    let cleanCode = code.replace(/```(?:javascript|js)?\n([\s\S]*?)```/gi, '$1').trim();

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
    
    updateNodeData(id, { 
      outputChartConfig: finalConfig,
      outputLibraryId: libraryId
    });
    
    addLog('Visualization running. Connect a Dashboard node to view.', 'success');
  };

  const librarySelector = (
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
  );

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
        <div className="h-full flex flex-col">
          <LLMPromptEditor 
            nodeId={id}
            language="javascript"
            colorTheme="emerald"
            placeholder="e.g., Show revenue by month..."
            topContent={librarySelector}
            onGenerate={handleGenerate}
            onRun={handleRun}
          />
        </div>
      )}
    </BaseNode>
  );
}
