import React from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Copy } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { NODE_CONFIG } from '../../config/nodeConfig';

export type BaseNodeColor = 'indigo' | 'blue' | 'emerald' | 'orange' | 'purple';

interface BaseNodeProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: BaseNodeColor;
  selected?: boolean;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  handles?: {
    type: 'source' | 'target';
    position: Position;
    id?: string;
  }[];
}

const colorMap = {
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/50',
    text: 'text-indigo-500 dark:text-indigo-400',
    handle: 'bg-indigo-500',
    ring: 'ring-indigo-500',
    hoverText: 'hover:text-indigo-500 dark:hover:text-indigo-400'
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/50',
    text: 'text-blue-500 dark:text-blue-400',
    handle: 'bg-blue-500',
    ring: 'ring-blue-500',
    hoverText: 'hover:text-blue-500 dark:hover:text-blue-400'
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/50',
    text: 'text-emerald-500 dark:text-emerald-400',
    handle: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    hoverText: 'hover:text-emerald-500 dark:hover:text-emerald-400'
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/50',
    text: 'text-orange-500 dark:text-orange-400',
    handle: 'bg-orange-500',
    ring: 'ring-orange-500',
    hoverText: 'hover:text-orange-500 dark:hover:text-orange-400'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/50',
    text: 'text-purple-500 dark:text-purple-400',
    handle: 'bg-purple-500',
    ring: 'ring-purple-500',
    hoverText: 'hover:text-purple-500 dark:hover:text-purple-400'
  }
};

// Единый источник правды для стилей и размеров коннекторов
const HANDLE_CLASS = "!w-4 !h-4 !bg-slate-400 dark:!bg-slate-500 border-[3px] border-white dark:border-slate-800 hover:!scale-125 transition-transform cursor-crosshair";

export function BaseNode({
  id,
  title,
  icon,
  color,
  selected,
  resizable = true,
  minWidth = NODE_CONFIG.minWidth,
  minHeight = NODE_CONFIG.minHeight,
  children,
  className = '',
  headerActions,
  handles = []
}: BaseNodeProps) {
  const duplicateNodes = useStore((s) => s.duplicateNodes);
  const theme = colorMap[color];

  return (
    <>
      {resizable && (
        <NodeResizer minWidth={minWidth} minHeight={minHeight} isVisible={selected} />
      )}
      <div 
        className={`bg-white dark:bg-slate-800 border rounded-lg shadow-lg flex flex-col transition-shadow h-full w-full
          ${selected ? `ring-2 ${theme.ring} border-transparent shadow-xl` : 'border-slate-200 dark:border-slate-700'} 
          ${className}
        `}
      >
        {handles.map((h, i) => (
          <Handle
            key={i}
            id={h.id}
            type={h.type}
            position={h.position}
            className={`${HANDLE_CLASS}`}
          />
        ))}
        
        <div className={`${theme.bg} p-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0 rounded-t-lg`}>
          <div className="flex items-center gap-2">
            <div className={theme.text}>{icon}</div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => duplicateNodes([id])}
              className={`text-slate-400 ${theme.hoverText} dark:text-slate-500 transition-colors`}
              title="Duplicate Node"
            >
              <Copy size={12} />
            </button>
            {headerActions}
          </div>
        </div>
        
        <div className="grow flex flex-col relative min-h-0 rounded-b-lg">
          {children}
        </div>
      </div>
    </>
  );
}
