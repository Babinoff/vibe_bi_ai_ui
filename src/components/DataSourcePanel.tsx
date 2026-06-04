import React, { useRef, useState } from 'react';
import { Database, Upload, ChevronLeft, ChevronRight, Maximize2, Minimize2, FileSpreadsheet, X } from 'lucide-react';
import Papa from 'papaparse';
import { useStore } from '../store/useStore';

export function DataSourcePanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [encoding, setEncoding] = useState('UTF-8');
  
  const state = useStore((s) => s.leftPanelState);
  const setState = useStore((s) => s.setLeftPanelState);
  const dataSources = useStore((s) => s.dataSources);
  const addDataSource = useStore((s) => s.addDataSource);
  const removeDataSource = useStore((s) => s.removeDataSource);

  const isOpen = state !== 'closed';
  const isMaximized = state === 'maximized';

  const handleToggle = () => {
    setState(isOpen ? 'closed' : 'open');
  };

  const handleMaximize = () => {
    setState(isMaximized ? 'open' : 'maximized');
  };

  const detectEncoding = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          resolve('utf-8');
          return;
        }
        try {
          // Attempt to decode as UTF-8 strictly.
          // If the file contains invalid UTF-8 (e.g., windows-1251 cyrillic characters), this will throw.
          const decoder = new TextDecoder('utf-8', { fatal: true });
          // stream: true prevents throwing on a multi-byte character split at the end of the chunk
          decoder.decode(buffer, { stream: true });
          resolve('utf-8');
        } catch (err) {
          // If UTF-8 decoding fails, fallback to windows-1251
          resolve('windows-1251');
        }
      };
      reader.onerror = () => resolve('utf-8');
      
      // Read the first 1MB to check encoding. 
      // If the file is smaller, it reads the whole file.
      reader.readAsArrayBuffer(file.slice(0, 1024 * 1024));
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    const detectedEncoding = await detectEncoding(file);
    setEncoding(detectedEncoding);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      encoding: detectedEncoding,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data.map((row: any) => 
          headers.map(field => row[field])
        );
        
        addDataSource({
          id: `ds-${Date.now()}`,
          name: file.name,
          headers,
          data: rows
        });
        
        setIsLoading(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setIsLoading(false);
      }
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={`relative h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col shrink-0 ${
        state === 'closed' ? 'w-0' : state === 'maximized' ? 'w-[80vw]' : 'w-80'
      }`}
    >
      <div className={`flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 overflow-hidden whitespace-nowrap'}`}>
        <div className="flex items-center gap-2 font-semibold">
          <Database size={18} className="text-indigo-500 dark:text-indigo-400" />
          <span>Data Source</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleMaximize} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 transition-opacity duration-200 flex flex-col gap-4 ${isOpen ? 'opacity-100' : 'opacity-0 overflow-hidden whitespace-nowrap'}`}>
        <input 
          type="file" 
          accept=".csv" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        
        <div className="flex flex-col gap-2">
          {/* We keep encoding in state for debugging or extension if needed, but it's hidden from the user to simplify UX */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 disabled:text-slate-500 dark:disabled:text-slate-400 text-white py-2 px-4 rounded-md transition-colors cursor-pointer shrink-0"
          >
            <Upload size={16} />
            <span>{isLoading ? 'Loading...' : 'Upload CSV'}</span>
          </button>
        </div>

        <div className={`grid gap-4 ${isMaximized ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {dataSources.map((ds) => (
            <div key={ds.id} className="flex flex-col gap-2 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800/50 overflow-hidden min-h-[200px] max-h-[300px]">
              <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileSpreadsheet size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-medium truncate" title={ds.name}>{ds.name}</span>
                </div>
                <button onClick={() => removeDataSource(ds.id)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0">
                  <X size={14} />
                </button>
              </div>
              
              <div className="overflow-auto flex-1 p-0 custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 shadow-sm z-10">
                    <tr>
                      {ds.headers.map((header, i) => (
                        <th key={i} className="p-2 border-b border-r border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ds.data?.slice(0, 500).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                        {row.map((cell: any, cellIndex: number) => (
                          <td key={cellIndex} className="p-2 border-b border-r border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[150px] truncate" title={String(cell)}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-2 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 text-center shrink-0">
                Previewing first {Math.min(500, ds.data?.length || 0)} of {ds.data?.length || 0} rows
              </div>
            </div>
          ))}
        </div>

        {dataSources.length === 0 && (
          <div className="space-y-2 mt-2">
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Recent Files</h3>
            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors text-sm text-slate-500 dark:text-slate-400">
              <span className="italic text-xs">No recent files</span>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className="absolute -right-3 top-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full p-1 z-10 shadow-md transition-colors cursor-pointer"
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </div>
  );
}
