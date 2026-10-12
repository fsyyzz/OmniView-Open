import React from 'react';
import { PanelTopOpen } from 'lucide-react';

interface DiagramCompactTriggerProps {
  onExpand: () => void;
  title?: string;
  label?: string;
}

export const DiagramCompactTrigger: React.FC<DiagramCompactTriggerProps> = ({
  onExpand,
  title = '展开图表工具栏',
  label = '工具栏',
}) => {
  return (
    <div className="diagram-compact-trigger absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border shadow-xs backdrop-blur-md transition cursor-pointer hover:bg-[var(--ov-surface-hover)]"
        style={{
          borderColor: 'var(--ov-border)',
          background: 'color-mix(in srgb, var(--ov-surface) 85%, transparent)',
          color: 'var(--ov-text)',
        }}
        title={title}
        aria-label={title}
      >
        <PanelTopOpen className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
        <span>{label}</span>
      </button>
    </div>
  );
};
