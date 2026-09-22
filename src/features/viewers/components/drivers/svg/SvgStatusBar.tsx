/**
 * SVG 画布底部辅助指示与吸附开关状态栏 (SvgStatusBar)
 */
import React from 'react';
import { Move, Crosshair, Magnet, Hash } from 'lucide-react';

export interface SvgStatusBarProps {
  scale: number;
  inspectorActive: boolean;
  hoveredTag: string | null;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  gridSnapEnabled: boolean;
  onToggleGridSnap: () => void;
  gridSize: number;
  onSetGridSize: (size: number) => void;
  snap15Deg?: boolean;
  onToggleSnap15Deg?: () => void;
  isCtrlPressed?: boolean;
  isAltPressed?: boolean;
  isShiftPressed?: boolean;
}

export const SvgStatusBar: React.FC<SvgStatusBarProps> = ({
  scale,
  inspectorActive,
  hoveredTag,
  snapEnabled,
  onToggleSnap,
  gridSnapEnabled,
  onToggleGridSnap,
  gridSize,
  onSetGridSize,
  snap15Deg = false,
  onToggleSnap15Deg,
  isCtrlPressed = false,
  isAltPressed = false,
  isShiftPressed = false,
}) => {
  return (
    <div
      id="canvas-statusbar"
      data-canvas-ui="true"
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text-secondary)',
        boxShadow: 'var(--ov-shadow, 0 8px 24px rgba(0,0,0,0.2))',
      }}
      className="absolute bottom-3 left-4 flex items-center gap-2 text-[11px] backdrop-blur-md px-3 py-1.5 rounded-lg border shadow-md z-30 select-none pointer-events-auto"
    >
      <div className="flex items-center gap-1.5">
        <Move className="w-3.5 h-3.5 text-cyan-400" />
        <span>平移 · 缩放 ({Math.round(scale * 100)}%)</span>
      </div>

      {inspectorActive && (
        <>
          <span style={{ color: 'var(--ov-border)' }}>|</span>
          <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <Crosshair className="w-3.5 h-3.5" />
            <span>拖调/缩放</span>
            {hoveredTag && (
              <span
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="ml-1 px-1.5 py-0.2 rounded border font-mono text-[10px]"
              >
                {hoveredTag}
              </span>
            )}
          </div>

          <span style={{ color: 'var(--ov-border)' }}>|</span>
          {/* 智能吸附一键切换按钮 */}
          <button
            type="button"
            onClick={onToggleSnap}
            title="按 S 键快速切换智能吸附"
            style={{
              backgroundColor: snapEnabled ? 'rgba(236, 72, 153, 0.15)' : 'var(--ov-surface-header)',
              borderColor: snapEnabled ? 'rgba(236, 72, 153, 0.4)' : 'var(--ov-border)',
              color: snapEnabled ? '#f472b6' : 'var(--ov-text-secondary)',
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors text-[10px] font-medium cursor-pointer"
          >
            <Magnet className={`w-3 h-3 ${snapEnabled ? 'text-pink-400' : 'text-slate-500'}`} />
            <span>智能吸附: {snapEnabled ? '开' : '关'}</span>
            <kbd
              style={{
                backgroundColor: 'var(--ov-surface)',
                color: 'var(--ov-text-muted)',
              }}
              className="ml-0.5 px-1 py-0.2 rounded text-[9px] font-mono"
            >
              S
            </kbd>
          </button>

          {/* 网格吸附切换与网格步长选择 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleGridSnap}
              title="按 G 键快速切换网格吸附"
              style={{
                backgroundColor: gridSnapEnabled ? 'rgba(6, 182, 212, 0.15)' : 'var(--ov-surface-header)',
                borderColor: gridSnapEnabled ? 'rgba(6, 182, 212, 0.4)' : 'var(--ov-border)',
                color: gridSnapEnabled ? '#22d3ee' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors text-[10px] font-medium cursor-pointer"
            >
              <Hash className={`w-3 h-3 ${gridSnapEnabled ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>网格吸附: {gridSnapEnabled ? '开' : '关'}</span>
              <kbd
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  color: 'var(--ov-text-muted)',
                }}
                className="ml-0.5 px-1 py-0.2 rounded text-[9px] font-mono"
              >
                G
              </kbd>
            </button>

            {/* 网格大小快捷药丸 */}
            {gridSnapEnabled && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                }}
                className="flex items-center rounded border p-0.5 ml-0.5"
              >
                {[10, 20, 50].map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onSetGridSize(sz)}
                    style={{
                      backgroundColor: gridSize === sz ? 'var(--ov-accent, #06b6d4)' : 'transparent',
                      color: gridSize === sz ? '#ffffff' : 'var(--ov-text-secondary)',
                    }}
                    className="px-1.5 py-0.2 text-[9px] font-mono rounded transition-colors font-medium"
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            )}
          </div>

          <span style={{ color: 'var(--ov-border)' }}>|</span>

          {/* Inkscape 15° 角度吸附快速切换 */}
          {onToggleSnap15Deg && (
            <button
              type="button"
              onClick={onToggleSnap15Deg}
              title="15° 角度步进吸附 (在拖拽时按住 Ctrl / Cmd 键生效)"
              style={{
                backgroundColor: snap15Deg || isCtrlPressed ? 'rgba(245, 158, 11, 0.15)' : 'var(--ov-surface-header)',
                borderColor: snap15Deg || isCtrlPressed ? 'rgba(245, 158, 11, 0.5)' : 'var(--ov-border)',
                color: snap15Deg || isCtrlPressed ? '#fbbf24' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors text-[10px] font-medium cursor-pointer"
            >
              <span>15° 角度锁定</span>
              <kbd
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  color: 'var(--ov-text-muted)',
                }}
                className="ml-0.5 px-1 py-0.2 rounded text-[9px] font-mono"
              >
                Ctrl
              </kbd>
            </button>
          )}

          {/* 实时按键辅助提示 (Inkscape 动态修饰键反馈) */}
          <div className="flex items-center gap-1">
            {isAltPressed && (
              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[9px] font-mono">
                Alt: 锁定方向延长
              </span>
            )}
            {isShiftPressed && (
              <span className="px-1.5 py-0.2 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[9px] font-mono">
                Shift: 对称伸缩
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

