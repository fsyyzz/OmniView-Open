/**
 * PlantUML 架构建模与可视化交互工具箱 (PlantUmlModelingToolbar)
 * 支持点击一键插入与 HTML5 原生拖拽 (Drag & Drop) 直拖至编辑器任意行
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Database,
  Server,
  ArrowRight,
  Sparkles,
  Cloud,
  Layers,
  GitBranch,
  FolderPlus,
  StickyNote,
  Palette,
  ChevronDown,
  Box,
  HardDrive,
  Cpu,
  Shield,
  Clock,
  Repeat,
  Share2,
  GripHorizontal,
} from 'lucide-react';
import {
  PLANTUML_TOOLBOX_ELEMENTS,
  PLANTUML_CONNECTORS,
  PLANTUML_SPRITES,
  PLANTUML_COLOR_TAGS,
  PlantUmlElementItem,
  PlantUmlConnectorItem,
  PlantUmlSpriteItem,
} from './plantUmlData';

interface PlantUmlModelingToolbarProps {
  onInsertCode: (code: string) => void;
  activeDiagramType?: string;
}

export const PlantUmlModelingToolbar: React.FC<PlantUmlModelingToolbarProps> = ({
  onInsertCode,
  activeDiagramType = 'uml',
}) => {
  const [activeDropdown, setActiveDropdown] = useState<'elements' | 'connectors' | 'sprites' | 'colors' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleDropdown = (menu: 'elements' | 'connectors' | 'sprites' | 'colors') => {
    setActiveDropdown(prev => (prev === menu ? null : menu));
  };

  // Drag start helper to transfer code payload
  const handleDragStart = (e: React.DragEvent, snippet: string, label: string) => {
    e.dataTransfer.setData('text/plain', snippet);
    e.dataTransfer.setData('application/x-plantuml-snippet', snippet);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        backgroundColor: 'var(--ov-surface-header)',
        borderBottomColor: 'var(--ov-border)',
      }}
      className="flex items-center gap-1.5 px-2.5 py-1 border-b text-xs shrink-0 flex-wrap relative select-none"
    >
      <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono flex items-center gap-1 shrink-0">
        <Sparkles className="w-3 h-3 text-[var(--ov-accent)]" />
        建模工具箱:
      </span>

      {/* 1. UML 图元选择器 (支持拖拽 & 点击) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleDropdown('elements')}
          style={{
            backgroundColor: activeDropdown === 'elements' ? 'var(--ov-accent-bg, rgba(99,102,241,0.15))' : 'var(--ov-surface)',
            borderColor: activeDropdown === 'elements' ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: activeDropdown === 'elements' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-pointer"
          title="点击展开，或直接将内部图元拖入代码区指定位置"
        >
          <Box className="w-3 h-3 text-cyan-400" />
          <span>图元 ({PLANTUML_TOOLBOX_ELEMENTS.length})</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-70" />
        </button>

        {activeDropdown === 'elements' && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
              boxShadow: 'var(--ov-shadow)',
            }}
            className="absolute left-0 top-full mt-1 w-68 border rounded-xl p-2 z-50 text-xs space-y-1 max-h-72 overflow-y-auto no-scrollbar"
          >
            <div
              style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
              className="text-[10px] font-mono px-2 py-0.5 border-b flex justify-between items-center"
            >
              <span>UML 核心图元定义 (可直接拖拽)</span>
              <span className="text-[var(--ov-accent)]">Drag / Click</span>
            </div>
            {PLANTUML_TOOLBOX_ELEMENTS.map((el, i) => (
              <div
                key={i}
                draggable
                onDragStart={e => handleDragStart(e, el.code, el.name)}
                onClick={() => {
                  onInsertCode(el.code);
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] group cursor-grab active:cursor-grabbing border border-transparent hover:border-[var(--ov-accent)]/30"
                title={`点击插入，或按住直接拖到代码编辑器中对应位置\n${el.code.trim()}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-cyan-400 font-mono text-xs shrink-0">{el.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-[11px] group-hover:text-[var(--ov-accent)] transition-colors truncate">{el.name}</div>
                    <div style={{ color: 'var(--ov-text-muted)' }} className="text-[9px] font-mono truncate">{el.syntax}</div>
                  </div>
                </div>
                <GripHorizontal className="w-3.5 h-3.5 text-[var(--ov-text-muted)] opacity-40 group-hover:opacity-100 shrink-0 ml-1" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. 交互连线与关系生成器 (支持拖拽 & 点击) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleDropdown('connectors')}
          style={{
            backgroundColor: activeDropdown === 'connectors' ? 'var(--ov-accent-bg, rgba(99,102,241,0.15))' : 'var(--ov-surface)',
            borderColor: activeDropdown === 'connectors' ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: activeDropdown === 'connectors' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-pointer"
          title="点击展开，或直接拖拽连接符至源码行"
        >
          <ArrowRight className="w-3 h-3 text-emerald-400" />
          <span>连接符 ({PLANTUML_CONNECTORS.length})</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-70" />
        </button>

        {activeDropdown === 'connectors' && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
              boxShadow: 'var(--ov-shadow)',
            }}
            className="absolute left-0 top-full mt-1 w-68 border rounded-xl p-2 z-50 text-xs space-y-1 max-h-72 overflow-y-auto no-scrollbar"
          >
            <div
              style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
              className="text-[10px] font-mono px-2 py-0.5 border-b flex justify-between items-center"
            >
              <span>UML 关系与连接符 (可直接拖拽)</span>
              <span className="text-emerald-400">Drag / Click</span>
            </div>
            {PLANTUML_CONNECTORS.map((con, i) => (
              <div
                key={i}
                draggable
                onDragStart={e => handleDragStart(e, con.code, con.name)}
                onClick={() => {
                  onInsertCode(con.code);
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] group cursor-grab active:cursor-grabbing border border-transparent hover:border-emerald-500/30"
                title={`点击插入，或按住直接拖到代码编辑器中对应位置\n${con.code.trim()}`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-[11px] flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                    <span className="font-mono text-emerald-300 font-bold">{con.symbol}</span>
                    <span className="truncate">{con.name}</span>
                  </div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[9px] truncate">{con.desc}</div>
                </div>
                <GripHorizontal className="w-3.5 h-3.5 text-[var(--ov-text-muted)] opacity-40 group-hover:opacity-100 shrink-0 ml-1" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. 云架构与开源 Sprite 图标库 (支持拖拽 & 点击) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleDropdown('sprites')}
          style={{
            backgroundColor: activeDropdown === 'sprites' ? 'var(--ov-accent-bg, rgba(99,102,241,0.15))' : 'var(--ov-surface)',
            borderColor: activeDropdown === 'sprites' ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: activeDropdown === 'sprites' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-pointer"
          title="插入/拖拽 AWS / GCP / Azure / K8s / Linux 官方 Sprite 图标"
        >
          <Cloud className="w-3 h-3 text-sky-400" />
          <span>架构图标 ({PLANTUML_SPRITES.length})</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-70" />
        </button>

        {activeDropdown === 'sprites' && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
              boxShadow: 'var(--ov-shadow)',
            }}
            className="absolute left-0 top-full mt-1 w-68 border rounded-xl p-2 z-50 text-xs space-y-1 max-h-72 overflow-y-auto no-scrollbar"
          >
            <div
              style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
              className="text-[10px] font-mono px-2 py-0.5 border-b flex justify-between items-center"
            >
              <span>PlantUML Stdlib 架构图标 (可拖拽)</span>
              <span className="text-sky-400">Sprite Lib</span>
            </div>
            {PLANTUML_SPRITES.map((sp, i) => (
              <div
                key={i}
                draggable
                onDragStart={e => handleDragStart(e, sp.code, sp.name)}
                onClick={() => {
                  onInsertCode(sp.code);
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] group cursor-grab active:cursor-grabbing border border-transparent hover:border-sky-500/30"
                title={`点击插入，或按住直接拖到代码编辑器中对应位置\n${sp.code.trim()}`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-[11px] group-hover:text-sky-400 transition-colors truncate">{sp.name}</div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[9px] font-mono truncate">{sp.category} • {sp.iconTag}</div>
                </div>
                <GripHorizontal className="w-3.5 h-3.5 text-[var(--ov-text-muted)] opacity-40 group-hover:opacity-100 shrink-0 ml-1" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 节点色板与高亮标注 (支持拖拽 & 点击) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleDropdown('colors')}
          style={{
            backgroundColor: activeDropdown === 'colors' ? 'var(--ov-accent-bg, rgba(99,102,241,0.15))' : 'var(--ov-surface)',
            borderColor: activeDropdown === 'colors' ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: activeDropdown === 'colors' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-pointer"
          title="插入/拖拽节点高亮颜色标注 (如 #LightSkyBlue, #LightGreen)"
        >
          <Palette className="w-3 h-3 text-pink-400" />
          <span>色板</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-70" />
        </button>

        {activeDropdown === 'colors' && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
              boxShadow: 'var(--ov-shadow)',
            }}
            className="absolute left-0 top-full mt-1 w-60 border rounded-xl p-2 z-50 text-xs space-y-1"
          >
            <div
              style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
              className="text-[10px] font-mono px-2 py-0.5 border-b flex justify-between items-center"
            >
              <span>节点高亮配色 (可拖拽)</span>
              <span className="text-pink-400 text-[9px]">Drag Color</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {PLANTUML_COLOR_TAGS.map((col, i) => {
                const colorSnippet = col.hex ? ` ${col.hex} ` : ` ${col.tag} `;
                return (
                  <div
                    key={i}
                    draggable
                    onDragStart={e => handleDragStart(e, colorSnippet, col.name)}
                    onClick={() => {
                      onInsertCode(colorSnippet);
                      setActiveDropdown(null);
                    }}
                    className="flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-mono transition border border-[var(--ov-border)] hover:border-[var(--ov-accent)] cursor-grab active:cursor-grabbing"
                    title={`点击插入或拖拽颜色代码: ${colorSnippet}`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: col.sampleColor }}
                      />
                      <span className="truncate">{col.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-3 w-[1px] mx-0.5" />

      {/* 快捷常用逻辑控制块 (支持拖拽 & 点击) */}
      <div
        draggable
        onDragStart={e => handleDragStart(e, 'autonumber\n', '序号')}
        onClick={() => onInsertCode('autonumber\n')}
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
        }}
        className="px-1.5 py-0.5 rounded text-[10px] font-mono border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-grab active:cursor-grabbing flex items-center gap-1"
        title="点击插入，或按住直接拖入代码编辑器中指定行"
      >
        <span>+ 序号 (autonumber)</span>
      </div>

      <div
        draggable
        onDragStart={e => handleDragStart(e, 'box "微服务隔离区" #LightSkyBlue\n  participant SvcA\n  participant SvcB\nend box\n', '分组框')}
        onClick={() => onInsertCode('box "微服务隔离区" #LightSkyBlue\n  participant SvcA\n  participant SvcB\nend box\n')}
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
        }}
        className="px-1.5 py-0.5 rounded text-[10px] font-mono border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-grab active:cursor-grabbing flex items-center gap-1"
        title="点击插入，或按住直接拖入代码编辑器中指定行"
      >
        <span>+ 分组框 (box)</span>
      </div>
    </div>
  );
};
