/**
 * PlantUML 多图表多图页 Tab 切换与管理栏 (PlantUmlDiagramTabBar)
 */
import React from 'react';
import { Layers, Plus, Grid, Eye } from 'lucide-react';
import { PlantUmlBlockInfo } from './plantUmlBlockParser';

interface PlantUmlDiagramTabBarProps {
  blocks: PlantUmlBlockInfo[];
  selectedBlockIndex: number;
  onSelectBlock: (index: number) => void;
  onAddNewDiagram: () => void;
  renderAllMode: boolean;
  onToggleRenderAllMode: () => void;
}

export const PlantUmlDiagramTabBar: React.FC<PlantUmlDiagramTabBarProps> = ({
  blocks,
  selectedBlockIndex,
  onSelectBlock,
  onAddNewDiagram,
  renderAllMode,
  onToggleRenderAllMode,
}) => {
  if (blocks.length <= 1) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface-header)',
        borderBottomColor: 'var(--ov-border)',
      }}
      className="flex items-center justify-between px-2 py-1 border-b text-xs shrink-0 select-none overflow-x-auto no-scrollbar gap-2"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono flex items-center gap-1 shrink-0 px-1">
          <Layers className="w-3 h-3 text-[var(--ov-accent)]" />
          图页 ({blocks.length}):
        </span>

        {blocks.map((block, idx) => {
          const isSelected = !renderAllMode && selectedBlockIndex === idx;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelectBlock(idx)}
              style={
                isSelected
                  ? {
                      backgroundColor: 'var(--ov-accent)',
                      color: '#ffffff',
                      borderColor: 'var(--ov-accent)',
                    }
                  : {
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                      color: 'var(--ov-text-secondary)',
                    }
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition shrink-0 cursor-pointer shadow-xs ${
                isSelected ? '' : 'hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]'
              }`}
              title={`切换至: ${block.title}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSelected ? 'bg-white' : 'bg-[var(--ov-accent)]'
                }`}
              />
              <span className="truncate max-w-[140px]">{block.title}</span>
              <span
                style={{
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--ov-bg)',
                  color: isSelected ? '#ffffff' : 'var(--ov-text-muted)',
                }}
                className="text-[9px] px-1 py-0.2 rounded font-mono uppercase"
              >
                {block.diagramType}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Toggle between single focused diagram vs full file rendering */}
        <button
          type="button"
          onClick={onToggleRenderAllMode}
          style={{
            backgroundColor: renderAllMode ? 'var(--ov-accent-bg, rgba(99,102,241,0.15))' : 'var(--ov-surface)',
            borderColor: renderAllMode ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: renderAllMode ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition hover:text-[var(--ov-text)] cursor-pointer"
          title={renderAllMode ? '当前为全量连续渲染模式 (点击切换为单图聚焦)' : '切换为全量多图顺序渲染模式'}
        >
          {renderAllMode ? <Grid className="w-3 h-3 text-[var(--ov-accent)]" /> : <Eye className="w-3 h-3" />}
          <span className="hidden md:inline">{renderAllMode ? '全量连续' : '单图聚焦'}</span>
        </button>

        <button
          type="button"
          onClick={onAddNewDiagram}
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition hover:border-[var(--ov-accent)] hover:text-[var(--ov-accent)] cursor-pointer"
          title="在文件末尾追加新的 @startuml 图表块"
        >
          <Plus className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">追加图表</span>
        </button>
      </div>
    </div>
  );
};
