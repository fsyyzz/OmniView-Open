/**
 * Inkscape 风格 Path 节点编辑器手柄组件 (SvgPathNodeHandles - Node Tool F2)
 * 支持节点拖拽、贝塞尔控制点操作、中点加点分割、节点类型平滑/尖锐切换、节点删除
 */
import React, { useState } from 'react';
import { PathNodeInfo } from './svgUtils';

export interface SvgPathNodeHandlesProps {
  nodes?: PathNodeInfo[];
  screenNodes?: PathNodeInfo[];
  svgToScreen?: (svgX: number, svgY: number) => { x: number; y: number };
  dragNodeIndex?: number | null;
  dragCpInfo?: { nodeIndex: number; cpIndex: number } | null;
  dragMode?: string;
  screenDragOffset: { x: number; y: number };
  selectedNodeIndex?: number | null;
  onSelectNode?: (nodeIndex: number) => void;
  onInsertNode?: (afterNodeIndex: number) => void;
  onDeleteNode?: (nodeIndex: number) => void;
  onToggleNodeType?: (nodeIndex: number) => void;
}

export const SvgPathNodeHandles: React.FC<SvgPathNodeHandlesProps> = ({
  nodes,
  screenNodes,
  svgToScreen = (x, y) => ({ x, y }),
  dragNodeIndex,
  dragCpInfo,
  dragMode,
  screenDragOffset,
  selectedNodeIndex,
  onSelectNode,
  onInsertNode,
  onDeleteNode,
  onToggleNodeType,
}) => {
  const [internalSelectedIdx, setInternalSelectedIdx] = useState<number | null>(null);
  const activeNodes = screenNodes || nodes || [];
  const selectedNodeIdx = selectedNodeIndex !== undefined ? selectedNodeIndex : internalSelectedIdx;
  const activeDragNodeIndex =
    dragNodeIndex !== undefined && dragNodeIndex !== null
      ? dragNodeIndex
      : dragMode === 'path-node'
      ? selectedNodeIdx
      : null;

  const handleSelectNode = (idx: number) => {
    setInternalSelectedIdx(idx);
    onSelectNode?.(idx);
  };

  if (!activeNodes || activeNodes.length === 0) return null;

  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-25 overflow-visible">
        {/* 控制臂与控制点连线 */}
        {activeNodes.map(node => {
          if (!node.controlPoints || node.controlPoints.length === 0) return null;
          const nodeScreen = svgToScreen(node.x, node.y);
          if (activeDragNodeIndex === node.index) {
            nodeScreen.x += screenDragOffset.x;
            nodeScreen.y += screenDragOffset.y;
          }

          return (
            <g key={`cp-lines-${node.index}`}>
              {node.controlPoints.map(cp => {
                const cpScreen = svgToScreen(cp.x, cp.y);
                if (
                  dragCpInfo &&
                  dragCpInfo.nodeIndex === node.index &&
                  dragCpInfo.cpIndex === cp.index
                ) {
                  cpScreen.x += screenDragOffset.x;
                  cpScreen.y += screenDragOffset.y;
                }

                return (
                  <line
                    key={`line-cp-${node.index}-${cp.index}`}
                    x1={nodeScreen.x}
                    y1={nodeScreen.y}
                    x2={cpScreen.x}
                    y2={cpScreen.y}
                    stroke="#c084fc"
                    strokeWidth={1.2}
                    strokeDasharray="3 2"
                    opacity={0.8}
                  />
                );
              })}
            </g>
          );
        })}

        {/* 贝塞尔控制点手柄 (圆环/圆点) */}
        {activeNodes.map(node => {
          if (!node.controlPoints || node.controlPoints.length === 0) return null;
          return node.controlPoints.map(cp => {
            const cpScreen = svgToScreen(cp.x, cp.y);
            if (
              dragCpInfo &&
              dragCpInfo.nodeIndex === node.index &&
              dragCpInfo.cpIndex === cp.index
            ) {
              cpScreen.x += screenDragOffset.x;
              cpScreen.y += screenDragOffset.y;
            }

            return (
              <circle
                key={`cp-${node.index}-${cp.index}`}
                cx={cpScreen.x}
                cy={cpScreen.y}
                r={5.5}
                fill="#a855f7"
                stroke="#ffffff"
                strokeWidth={1.5}
                data-path-handle="cp"
                data-node-idx={node.index}
                data-cp-idx={cp.index}
                className="cursor-pointer hover:scale-130 transition-transform pointer-events-auto filter drop-shadow(0 0 4px rgba(168,85,247,0.8))"
              />
            );
          });
        })}

        {/* 顶点主节点手柄 (Corner: 菱形/方形, Smooth: 圆形) */}
        {activeNodes.map(node => {
          const screen = svgToScreen(node.x, node.y);
          if (activeDragNodeIndex === node.index) {
            screen.x += screenDragOffset.x;
            screen.y += screenDragOffset.y;
          }

          const isSelected = selectedNodeIdx === node.index;
          const isCorner = node.type === 'corner' || node.command === 'M' || node.command === 'L';

          if (isCorner) {
            // 菱形手柄
            const s = isSelected ? 6.5 : 5.5;
            return (
              <polygon
                key={`node-${node.index}`}
                points={`${screen.x},${screen.y - s} ${screen.x + s},${screen.y} ${screen.x},${screen.y + s} ${screen.x - s},${screen.y}`}
                fill={isSelected ? '#f59e0b' : '#3b82f6'}
                stroke="#ffffff"
                strokeWidth={1.5}
                data-path-handle="node"
                data-node-idx={node.index}
                onClick={e => {
                  e.stopPropagation();
                  handleSelectNode(node.index);
                }}
                className="cursor-move hover:scale-130 transition-transform pointer-events-auto filter drop-shadow(0 0 4px rgba(59,130,246,0.8))"
              />
            );
          }

          // 平滑圆形手柄
          return (
            <circle
              key={`node-${node.index}`}
              cx={screen.x}
              cy={screen.y}
              r={isSelected ? 6.5 : 5.5}
              fill={isSelected ? '#f59e0b' : '#06b6d4'}
              stroke="#ffffff"
              strokeWidth={1.5}
              data-path-handle="node"
              data-node-idx={node.index}
              onClick={e => {
                e.stopPropagation();
                handleSelectNode(node.index);
              }}
              className="cursor-move hover:scale-130 transition-transform pointer-events-auto filter drop-shadow(0 0 4px rgba(6,182,212,0.8))"
            />
          );
        })}
      </svg>

      {/* 相邻节点中点快捷加点按钮 (+) */}
      {onInsertNode &&
        activeNodes.map((node, i) => {
          if (i >= activeNodes.length - 1) return null;
          const next = activeNodes[i + 1];
          const midSvgX = (node.x + next.x) / 2;
          const midSvgY = (node.y + next.y) / 2;
          const midScreen = svgToScreen(midSvgX, midSvgY);

          return (
            <div
              key={`add-node-${i}`}
              className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 z-26 opacity-40 hover:opacity-100 transition-opacity"
              style={{ left: midScreen.x, top: midScreen.y }}
            >
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onInsertNode(i);
                }}
                title="在此线段中点插入新节点 (Inkscape 双击/中点加点)"
                className="w-4.5 h-4.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center text-[11px] font-bold shadow-md cursor-pointer hover:scale-120 transition-transform border border-white/60"
              >
                +
              </button>
            </div>
          );
        })}

      {/* 选中节点浮动操作条 */}
      {selectedNodeIdx !== null && activeNodes[selectedNodeIdx] && (
        <div
          className="absolute z-27 -translate-x-1/2 -translate-y-full mb-2 pointer-events-auto select-none"
          style={{
            left: svgToScreen(activeNodes[selectedNodeIdx].x, activeNodes[selectedNodeIdx].y).x,
            top: svgToScreen(activeNodes[selectedNodeIdx].x, activeNodes[selectedNodeIdx].y).y - 8,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              color: 'var(--ov-text)',
              borderColor: 'var(--ov-border)',
            }}
            className="px-1.5 py-0.5 rounded shadow-lg border backdrop-blur-md flex items-center gap-1 text-[10px] font-mono whitespace-nowrap"
          >
            <span className="text-amber-400 font-bold">Node #{selectedNodeIdx}</span>
            <span className="text-slate-500">
              ({Math.round(activeNodes[selectedNodeIdx].x)}, {Math.round(activeNodes[selectedNodeIdx].y)})
            </span>

            {onToggleNodeType && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onToggleNodeType(selectedNodeIdx);
                }}
                className="px-1 py-0.2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[9px] cursor-pointer"
                title="切换平滑/尖锐节点"
              >
                {activeNodes[selectedNodeIdx].type === 'corner' ? '转为平滑' : '转为尖角'}
              </button>
            )}

            {onDeleteNode && activeNodes.length > 2 && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteNode(selectedNodeIdx);
                  handleSelectNode(-1);
                }}
                className="px-1 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[9px] cursor-pointer"
                title="删除此节点"
              >
                删除
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
