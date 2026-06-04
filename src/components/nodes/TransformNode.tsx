import React from 'react';
import { Position } from '@xyflow/react';
import { Cpu } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { LLMPromptEditor } from '../PromptEditor/LLMPromptEditor';
import { LLMClient } from '../../services/llmClient';
import { PythonRunner } from '../../services/pythonRunner';
import { useStore } from '../../store/useStore';

export function TransformNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const updateNodeData = useStore(s => s.updateNodeData);

  const handleGenerate = async (
    prompt: string, 
    inputHeaders: string[], 
    inputData: any[][], 
    enableHistory: boolean, 
    history: any[],
    addLog: (msg: string, type?: 'info'|'error'|'success') => void,
    actualSourceNode: any
  ) => {
    let schema = inputHeaders.map(h => ({ name: h, type: 'unknown' as const }));
    let sampleData = inputData.slice(0, 2).map((row: any[]) => {
      const obj: Record<string, any> = {};
      inputHeaders.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    const context = { schema, sampleData };
    const result = await LLMClient.generateCode(prompt, context, (msg) => addLog(msg, 'info'));
    
    addLog('Code generated successfully!', 'success');
    
    return {
      code: result.code,
      historyItemData: {
        rawResponse: result.rawResponse
      }
    };
  };

  const handleRun = async (
    code: string, 
    inputHeaders: string[], 
    inputData: any[][], 
    addLog: (msg: string, type?: 'info'|'error'|'success') => void
  ) => {
    addLog(`Passing ${inputData.length} rows to Python runtime...`, 'info');
    
    const result = await PythonRunner.run(code, inputHeaders, inputData, (msg: string) => addLog(msg, 'info'));
    
    updateNodeData(id, {
      outputHeaders: result.headers,
      outputData: result.data
    });
    
    if (result.printed_text) {
      addLog(`Execution complete.\nPrint output:\n${result.printed_text}\nResult: ${result.data.length} rows.`, 'success');
    } else {
      addLog(`Execution complete. Result: ${result.data.length} rows.`, 'success');
    }
  };

  return (
    <BaseNode
      id={id}
      title="Transform"
      icon={<Cpu size={14} />}
      color="blue"
      selected={selected}
      className="w-[800px]"
      handles={[
        { type: 'target', position: Position.Left },
        { type: 'source', position: Position.Right }
      ]}
    >
      <div className="h-full flex flex-col">
        <LLMPromptEditor 
          nodeId={id}
          language="python"
          colorTheme="blue"
          placeholder="e.g., Group by product and calculate total amount..."
          onGenerate={handleGenerate}
          onRun={handleRun}
        />
      </div>
    </BaseNode>
  );
}
