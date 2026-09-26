/**
 * OmniView Dockerfile 专属多维可视化工作台 (Dockerfile Viewer)
 * 支持多阶段构建流水线 (Pipeline DAG)、指令层级卡片、最佳实践体检与三态模式切换 (预览/分屏/源码)
 * 100% 依托 --ov-* 语义设计令牌，像素级自适应 VS Code 原生/系统深浅色主题
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Layers,
  Box,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  ArrowRight,
  Terminal,
  Code2,
  Search,
  Eye,
  Split,
} from 'lucide-react';
import type { ThemeId, ViewMode, FileItem } from '../../../../shared/types';
import type { Locale } from '../../../../shared/lib/i18n';
import { parseDockerfile, type DockerStage, type DockerInstruction } from '../../lib/parsers/dockerfileParser';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { CodeViewer } from './CodeViewer';

type SubViewMode = 'pipeline' | 'layers' | 'diagnostics';

export interface DockerfileViewerProps {
  file?: Partial<FileItem>;
  content?: string;
  fileName?: string;
  extension?: string;
  mode?: ViewMode;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
  onContentChange?: (newContent: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
  onOpenInEditor?: () => void;
}

export const DockerfileViewer: React.FC<DockerfileViewerProps> = ({
  file,
  content,
  fileName,
  extension,
  mode = 'preview',
  theme,
  locale = 'zh-CN',
  onContentChange,
  onOpenSourceAtLine,
}) => {
  const [currentMode, setCurrentMode] = useState<ViewMode>(mode);
  const [subView, setSubView] = useState<SubViewMode>('pipeline');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  useEffect(() => {
    if (mode) setCurrentMode(mode);
  }, [mode]);

  const effectiveContent = file?.content ?? content ?? '';
  const effectiveFileName = file?.name ?? fileName ?? 'Dockerfile';
  const effectiveExtension = file?.extension ?? extension ?? 'dockerfile';

  const parsed = useMemo(() => parseDockerfile(effectiveContent), [effectiveContent]);

  const activeStage = useMemo(() => {
    if (!selectedStageId) return parsed.stages[0] || null;
    return parsed.stages.find((s) => s.id === selectedStageId) || parsed.stages[0] || null;
  }, [parsed.stages, selectedStageId]);

  const [toolbarRef, toolbarWidth] = useContainerWidth<HTMLDivElement>(600);

  // 容器响应式断点定义 (阶梯自适应收敛策略，杜绝文字与图标折行/截断)
  const isWide = toolbarWidth >= 680;
  const showSubViewActiveText = toolbarWidth >= 420;
  const showSubViewAllText = isWide;
  const showModeActiveText = toolbarWidth >= 460;
  const showModeAllText = isWide;
  const showStatsSummary = toolbarWidth >= 600;

  // 纯源码编辑模式
  if (currentMode === 'source') {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden" style={{ background: 'var(--ov-bg)' }}>
        {/* 顶部自适应切换条 */}
        <div
          ref={toolbarRef}
          className="h-10 px-3 border-b flex items-center justify-between shrink-0 text-xs select-none whitespace-nowrap flex-nowrap min-w-0"
          style={{
            background: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
        >
          <div className="flex items-center gap-2 font-mono min-w-0 mr-2 overflow-hidden shrink">
            <span className="font-semibold truncate max-w-[120px] sm:max-w-[200px]" title={effectiveFileName}>
              {effectiveFileName}
            </span>
            <span
              className="text-[10px] uppercase px-1.5 py-0.5 rounded border shrink-0"
              style={{
                background: 'var(--ov-code-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
            >
              Dockerfile Source
            </span>
          </div>

          <div
            className="flex items-center p-0.5 rounded-lg border shadow-xs shrink-0"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentMode('preview')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer hover:bg-[var(--ov-surface-hover)] shrink-0"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="图形化渲染视图"
              aria-label="渲染视图"
            >
              <Eye size={13} className="shrink-0" />
              {showModeAllText && <span>渲染视图</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('split')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer hover:bg-[var(--ov-surface-hover)] shrink-0"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="并排分屏协同"
              aria-label="并排分屏"
            >
              <Split size={13} className="shrink-0" />
              {showModeAllText && <span>并排分屏</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('source')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold shadow-xs bg-[var(--ov-accent)] text-white shrink-0"
              title="纯源码编辑模式"
              aria-label="源码模式"
            >
              <Code2 size={13} className="shrink-0" />
              {(showModeAllText || showModeActiveText) && <span>源码模式</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <CodeViewer
            content={effectiveContent}
            extension={effectiveExtension}
            fileName={effectiveFileName}
            locale={locale}
            theme={theme}
            onContentChange={onContentChange}
          />
        </div>
      </div>
    );
  }

  const renderVisualContent = () => (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden select-none transition-colors"
      style={{
        background: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
    >
      {/* 顶部工具栏 (依托容器宽度动态自适应文字与图标，杜绝挤爆折行) */}
      <div
        ref={toolbarRef}
        className="h-10 px-3 border-b flex items-center justify-between shrink-0 text-xs transition-colors select-none whitespace-nowrap flex-nowrap min-w-0"
        style={{
          background: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 mr-2 overflow-hidden shrink">
          <div className="w-6 h-6 rounded bg-blue-500/15 text-blue-500 border border-blue-500/30 flex items-center justify-center font-bold shrink-0">
            <Box size={14} className="shrink-0" />
          </div>
          <span className="font-semibold tracking-wide truncate max-w-[110px] sm:max-w-[180px]" title="Dockerfile 构建流水线">
            Dockerfile 流水线
          </span>
          {showStatsSummary && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono border truncate shrink-0"
              style={{
                background: 'var(--ov-code-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
            >
              {parsed.stages.length} 阶段 · {parsed.allInstructions.filter((i) => i.type !== 'COMMENT').length} 指令
            </span>
          )}
        </div>

        {/* 视口子功能切换器 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="flex items-center p-0.5 rounded-lg border shadow-xs shrink-0"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setSubView('pipeline')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'pipeline' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'pipeline' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="多阶段构建流水线 DAG"
              aria-label="构建流水线"
            >
              <Layers size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'pipeline')) && <span>流水线</span>}
            </button>

            <button
              type="button"
              onClick={() => setSubView('layers')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'layers' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'layers' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="指令分层透视"
              aria-label="指令分层透视"
            >
              <Terminal size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'layers')) && <span>指令明细</span>}
            </button>

            <button
              type="button"
              onClick={() => setSubView('diagnostics')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'diagnostics' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'diagnostics' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title={`最佳实践体检 (${parsed.diagnostics.length})`}
              aria-label="最佳实践体检"
            >
              <ShieldAlert size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'diagnostics')) && (
                <span>体检{parsed.diagnostics.length > 0 ? ` (${parsed.diagnostics.length})` : ''}</span>
              )}
            </button>
          </div>

          {/* 模式切换器 */}
          <div
            className="flex items-center p-0.5 rounded-lg border shadow-xs shrink-0"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentMode('preview')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: currentMode === 'preview' ? 'var(--ov-accent)' : 'transparent',
                color: currentMode === 'preview' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="图形化渲染视图"
              aria-label="渲染视图"
            >
              <Eye size={13} className="shrink-0" />
              {(showModeAllText || (showModeActiveText && currentMode === 'preview')) && <span>渲染</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('split')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: currentMode === 'split' ? 'var(--ov-accent)' : 'transparent',
                color: currentMode === 'split' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="并排分屏协同"
              aria-label="并排分屏"
            >
              <Split size={13} className="shrink-0" />
              {(showModeAllText || (showModeActiveText && currentMode === 'split')) && <span>分屏</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('source')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer hover:bg-[var(--ov-surface-hover)] shrink-0"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="纯源码编辑模式"
              aria-label="源码模式"
            >
              <Code2 size={13} className="shrink-0" />
              {showModeAllText && <span>源码</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 视图内容区 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* SUBVIEW 1: 多阶段构建流水线 DAG */}
        {subView === 'pipeline' && (
          <div className="space-y-6">
            <div className="text-xs flex items-center justify-between" style={{ color: 'var(--ov-text-secondary)' }}>
              <span>阶段流转依赖图谱 (Stage Dependencies & COPY Pipelines)</span>
              <span className="text-[11px]" style={{ color: 'var(--ov-text-muted)' }}>
                点击阶段卡片可在下方查看详细指令明细
              </span>
            </div>

            {/* 水平流水线图 */}
            <div
              className="flex flex-wrap items-center gap-3 p-4 rounded-xl border overflow-x-auto shadow-xs"
              style={{
                background: 'var(--ov-bg-elevated)',
                borderColor: 'var(--ov-border)',
              }}
            >
              {parsed.stages.map((stage, idx) => {
                const isSelected = activeStage?.id === stage.id;
                return (
                  <React.Fragment key={stage.id}>
                    <div
                      onClick={() => setSelectedStageId(stage.id)}
                      className={`cursor-pointer p-3.5 rounded-xl border transition min-w-[200px] flex-1 max-w-[280px] ${
                        isSelected
                          ? 'border-[var(--ov-accent)] ring-1 ring-[var(--ov-accent)] shadow-sm'
                          : 'hover:bg-[var(--ov-surface-hover)]'
                      }`}
                      style={{
                        background: isSelected ? 'var(--ov-surface-hover)' : 'var(--ov-surface)',
                        borderColor: isSelected ? 'var(--ov-accent)' : 'var(--ov-border)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 border border-blue-500/30 font-medium">
                          Stage {idx + 1}
                        </span>
                        {stage.isFinalStage ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-semibold border border-emerald-500/30">
                            ★ 终态生产镜像
                          </span>
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--ov-text-muted)' }}>
                            构建中继层
                          </span>
                        )}
                      </div>

                      <div className="font-semibold text-sm truncate mb-1" style={{ color: 'var(--ov-text)' }}>
                        {stage.name}
                      </div>

                      <div className="text-xs font-mono truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                        FROM {stage.baseImage}:{stage.baseTag}
                      </div>

                      <div
                        className="mt-2.5 pt-2 border-t text-[11px] flex items-center justify-between"
                        style={{
                          borderColor: 'var(--ov-border)',
                          color: 'var(--ov-text-muted)',
                        }}
                      >
                        <span>{stage.instructions.length} 层指令</span>
                        {stage.dependencies.length > 0 && (
                          <span className="text-sky-500 font-medium truncate">
                            依赖: {stage.dependencies.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {idx < parsed.stages.length - 1 && (
                      <div className="flex items-center shrink-0" style={{ color: 'var(--ov-text-muted)' }}>
                        <ArrowRight size={18} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* 选中阶段的指令层明细 */}
            {activeStage && (
              <div
                className="p-4 rounded-xl border space-y-3 shadow-xs"
                style={{
                  background: 'var(--ov-bg-elevated)',
                  borderColor: 'var(--ov-border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-xs flex items-center gap-2" style={{ color: 'var(--ov-text)' }}>
                    <span className="w-2 h-2 rounded-full bg-[var(--ov-accent)]" />
                    <span>阶段 [{activeStage.name}] 指令明细流 (第 {activeStage.startLine} ~ {activeStage.endLine} 行)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSourceAtLine?.(activeStage.startLine)}
                    className="text-xs font-medium text-[var(--ov-accent)] hover:underline transition cursor-pointer"
                  >
                    在源码中定位 →
                  </button>
                </div>

                <div className="space-y-1.5">
                  {activeStage.instructions.map((inst, i) => (
                    <div
                      key={i}
                      onClick={() => onOpenSourceAtLine?.(inst.line)}
                      className="cursor-pointer flex items-center justify-between p-2 rounded-lg border text-xs transition hover:bg-[var(--ov-surface-hover)]"
                      style={{
                        background: 'var(--ov-surface)',
                        borderColor: 'var(--ov-border)',
                      }}
                      title="点击跳转源码行"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="font-mono w-8 text-right shrink-0" style={{ color: 'var(--ov-text-muted)' }}>
                          L{inst.line}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 ${
                            inst.type === 'FROM'
                              ? 'bg-purple-500/15 text-purple-500 border border-purple-500/30'
                              : inst.type === 'RUN'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : inst.type === 'COPY' || inst.type === 'ADD'
                              ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30'
                              : inst.type === 'EXPOSE'
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              : 'bg-[var(--ov-code-bg)] text-[var(--ov-text-secondary)] border border-[var(--ov-border)]'
                          }`}
                        >
                          {inst.type}
                        </span>
                        <span className="font-mono truncate" style={{ color: 'var(--ov-text)' }}>
                          {inst.args}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBVIEW 2: 指令分层透视 (Layer Breakdown) */}
        {subView === 'layers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-2.5 text-[var(--ov-text-muted)]" />
                <input
                  type="text"
                  placeholder="搜索指令类型或关键字..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs transition border focus:outline-hidden"
                  style={{
                    background: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                />
              </div>
              <div className="text-xs" style={{ color: 'var(--ov-text-secondary)' }}>
                暴露端口: {parsed.exposedPorts.length > 0 ? parsed.exposedPorts.join(', ') : '无'} · 环境变量: {parsed.envVars.length} 个
              </div>
            </div>

            <div className="space-y-2">
              {parsed.allInstructions
                .filter((inst) => !searchFilter || inst.raw.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((inst, i) => (
                  <div
                    key={i}
                    onClick={() => onOpenSourceAtLine?.(inst.line)}
                    className="cursor-pointer p-2.5 rounded-lg border flex items-center justify-between text-xs transition hover:bg-[var(--ov-surface-hover)]"
                    style={{
                      background: 'var(--ov-bg-elevated)',
                      borderColor: 'var(--ov-border)',
                    }}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="font-mono w-8 text-right shrink-0" style={{ color: 'var(--ov-text-muted)' }}>
                        L{inst.line}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-500/15 text-blue-500 border border-blue-500/30 shrink-0">
                        {inst.type}
                      </span>
                      <span className="font-mono truncate" style={{ color: 'var(--ov-text)' }}>
                        {inst.args || inst.raw}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono shrink-0 uppercase tracking-wider" style={{ color: 'var(--ov-text-muted)' }}>
                      {inst.category}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* SUBVIEW 3: 最佳实践体检与安全检查 */}
        {subView === 'diagnostics' && (
          <div className="space-y-3">
            {parsed.diagnostics.length === 0 ? (
              <div
                className="p-8 text-center rounded-xl border space-y-2"
                style={{
                  background: 'var(--ov-bg-elevated)',
                  borderColor: 'var(--ov-border)',
                }}
              >
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                <div className="font-medium text-sm" style={{ color: 'var(--ov-text)' }}>
                  太棒了！未发现高风险构建隐患
                </div>
                <div className="text-xs" style={{ color: 'var(--ov-text-muted)' }}>
                  当前 Dockerfile 符合基础镜像版本锁定、非 root 安全与指令层级规范。
                </div>
              </div>
            ) : (
              parsed.diagnostics.map((diag, i) => (
                <div
                  key={i}
                  onClick={() => diag.line && onOpenSourceAtLine?.(diag.line)}
                  className={`p-3.5 rounded-xl border space-y-1.5 cursor-pointer transition ${
                    diag.level === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                      : diag.level === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-xs">
                    <div className="flex items-center gap-2">
                      {diag.level === 'error' ? (
                        <ShieldAlert size={14} className="text-rose-500" />
                      ) : diag.level === 'warning' ? (
                        <AlertTriangle size={14} className="text-amber-500" />
                      ) : (
                        <Info size={14} className="text-blue-500" />
                      )}
                      <span>{diag.message}</span>
                    </div>
                    {diag.line && <span className="font-mono text-[10px] opacity-80">行号: L{diag.line}</span>}
                  </div>
                  {diag.suggestion && (
                    <div className="text-[11px] opacity-90 pl-5 leading-relaxed">
                      💡 优化建议: {diag.suggestion}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  // 分屏协同模式 (Split View)
  if (currentMode === 'split') {
    return (
      <div className="w-full h-full flex overflow-hidden">
        <div
          className="w-1/2 h-full border-r overflow-hidden flex flex-col"
          style={{ borderColor: 'var(--ov-border)' }}
        >
          {renderVisualContent()}
        </div>
        <div className="w-1/2 h-full overflow-hidden flex flex-col">
          <CodeViewer
            content={effectiveContent}
            extension={effectiveExtension}
            fileName={effectiveFileName}
            locale={locale}
            theme={theme}
            onContentChange={onContentChange}
          />
        </div>
      </div>
    );
  }

  // 纯预览模式 (Preview View)
  return renderVisualContent();
};

DockerfileViewer.displayName = 'DockerfileViewer';
