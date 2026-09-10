/**
 * OmniView 工作台全局设置管理模态框 (Workbench Settings Modal)
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Palette,
  Layout,
  Code2,
  Database,
  RotateCcw,
  Download,
  Upload,
  Check,
  AlertTriangle,
  Server,
  Type,
  Maximize2,
  FileText,
  Sliders,
  Globe,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  WorkbenchSettings,
  RENDER_THEMES,
  DENSITY_PRESETS,
  ThemeId,
  DensityMode,
  ContentWidthMode,
  ViewMode,
  OutlinePosition,
} from '../../../shared/types';
import {
  loadStoredSettings,
  saveStoredSettings,
  resetStoredSettings,
  exportSettingsJson,
  importSettingsJson,
  getStorageStats,
} from '../../../shared/lib/settingsStorage';
import { resetStoredFiles } from '../../../shared/lib/fileStorage';
import { Locale, getStoredLocale, saveStoredLocale, t } from '../../../shared/lib/i18n';
import { PLANTUML_SERVER_PRESETS, setPlantUmlServerBase } from '../../../shared/lib/plantuml';
import {
  isVsCodeEnvironment,
  getVsCodeThemeInfo,
  THIRD_PARTY_THEMES,
  applySimulatedTheme,
} from '../../../shared/lib/nativeTheme';

interface WorkbenchSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WorkbenchSettings;
  onSettingsChange: (newSettings: WorkbenchSettings) => void;
  onResetWorkspace?: () => void;
}

type TabKey = 'appearance' | 'editor' | 'diagrams' | 'storage';

export const WorkbenchSettingsModal: React.FC<WorkbenchSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onResetWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('appearance');
  const [localSettings, setLocalSettings] = useState<WorkbenchSettings>(settings);
  const [storageStats, setStorageStats] = useState(() => getStorageStats());
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [themeInfo, setThemeInfo] = useState(() => getVsCodeThemeInfo());
  const [activeSimulatedTheme, setActiveSimulatedTheme] = useState<string>('one-dark-pro');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      setStorageStats(getStorageStats());
      setStatusMessage(null);
      setThemeInfo(getVsCodeThemeInfo());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof WorkbenchSettings>(key: K, value: WorkbenchSettings[K]) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    saveStoredSettings({ [key]: value });
    onSettingsChange(updated);

    if (key === 'plantUmlServerUrl' && typeof value === 'string') {
      setPlantUmlServerBase(value);
    }

    if (key === 'locale' && (value === 'zh-CN' || value === 'en-US')) {
      saveStoredLocale(value);
    }
  };

  const handleExport = () => {
    try {
      const json = exportSettingsJson();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omniview-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: '配置已成功导出为 JSON 文件' });
    } catch {
      setStatusMessage({ type: 'error', text: '导出配置失败' });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importSettingsJson(content);
      if (res.success) {
        const refreshed = loadStoredSettings();
        setLocalSettings(refreshed);
        onSettingsChange(refreshed);
        setStorageStats(getStorageStats());
        setStatusMessage({ type: 'success', text: '配置导入成功并已应用' });
      } else {
        setStatusMessage({ type: 'error', text: res.error || '导入配置文件失败' });
      }
    };
    reader.readAsText(file);
  };

  const handleResetAll = () => {
    if (window.confirm('确定要重置所有配置项为初始默认值吗？演示文件也将被还原。')) {
      const defaultSettings = resetStoredSettings();
      resetStoredFiles();
      setLocalSettings(defaultSettings);
      onSettingsChange(defaultSettings);
      setStorageStats(getStorageStats());
      onResetWorkspace?.();
      setStatusMessage({ type: 'success', text: '已成功恢复全部出厂设置与演示文件' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50 duration-150">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="h-13 px-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">工作台偏好与持久化配置中心</h2>
              <p className="text-[11px] text-slate-400">所有选项均实时持久化存储于本地环境</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            title="关闭设置"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 border-b border-slate-800 bg-slate-950/30 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'appearance'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>外观与排版</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'editor'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>视图与分屏</span>
          </button>

          <button
            onClick={() => setActiveTab('diagrams')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'diagrams'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>图表引擎服务</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'storage'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>存储与备份</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {statusMessage && (
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* TAB 1: 外观与排版 */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              {/* 主题选择 */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">色彩渲染主题</label>
                <div className="grid grid-cols-3 gap-2">
                  {RENDER_THEMES.map((th) => {
                    const active = localSettings.theme === th.id;
                    return (
                      <button
                        key={th.id}
                        onClick={() => updateSetting('theme', th.id)}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
                          active
                            ? 'border-blue-500 bg-blue-600/15 text-white font-medium shadow-xs'
                            : 'border-slate-800 bg-slate-850 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-slate-700 shadow-xs"
                          style={{ backgroundColor: th.colorDot }}
                        />
                        <div className="truncate">
                          <div className="text-xs truncate">{th.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{th.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VS Code 原生主题动态注入卡片 */}
              <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>VS Code 原生主题动态注入 (Native Theme Injection)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    themeInfo.isVsCode
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}>
                    {themeInfo.isVsCode ? '● VS Code 宿主直连' : '○ Webview 仿真模式'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {themeInfo.isVsCode
                    ? '已深度绑定 VS Code 内置 CSS 变量（--vscode-editor-*、--vscode-sideBar-* 等），支持与 One Dark Pro、Dracula、Tokyo Night 等任意第三方主题 100% 像素级无缝融合。'
                    : '已就绪原生 CSS 变量注入机制。在浏览器独立预览下，您可通过下方仿真器一键注入知名第三方主题的内置变量，验证像素级融合效果：'}
                </p>

                {/* 活跃变量指示器 */}
                <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2 rounded-md border border-slate-800 text-[10px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: themeInfo.editorBackground }}
                    />
                    <span className="text-slate-400 truncate">背景: {themeInfo.editorBackground}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: themeInfo.editorForeground }}
                    />
                    <span className="text-slate-400 truncate">前景色: {themeInfo.editorForeground}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: themeInfo.buttonBackground }}
                    />
                    <span className="text-slate-400 truncate">按钮: {themeInfo.buttonBackground}</span>
                  </div>
                </div>

                {/* 第三方主题模拟注入切换器 */}
                <div>
                  <div className="text-[10px] text-slate-400 mb-1.5 font-medium flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-500" />
                    <span>第三方主题模拟注入 (选择后生效并切换为 system 主题):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {THIRD_PARTY_THEMES.map((themePreset) => {
                      const isActiveSim = activeSimulatedTheme === themePreset.id;
                      return (
                        <button
                          key={themePreset.id}
                          onClick={() => {
                            applySimulatedTheme(themePreset.id);
                            setActiveSimulatedTheme(themePreset.id);
                            updateSetting('theme', 'system');
                            setThemeInfo(getVsCodeThemeInfo());
                          }}
                          className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 border transition ${
                            isActiveSim
                              ? 'bg-blue-600/30 text-white border-blue-500 font-medium shadow-xs'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full border border-white/20"
                            style={{ backgroundColor: themePreset.variables['--vscode-editor-background'] }}
                          />
                          <span>{themePreset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 语言偏好与排版密度 */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">界面语言 (Language)</label>
                  <select
                    value={localSettings.locale || 'zh-CN'}
                    onChange={(e) => updateSetting('locale', e.target.value as 'zh-CN' | 'en-US')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="zh-CN">🇨🇳 简体中文 (Chinese Simplified)</option>
                    <option value="en-US">🇺🇸 English (US)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">信息排版密度</label>
                  <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    {DENSITY_PRESETS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => updateSetting('density', d.id)}
                        className={`flex-1 py-1 rounded text-center transition ${
                          localSettings.density === d.id
                            ? 'bg-blue-600 text-white font-medium shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 正文宽度与基准字号 */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">文档正文阅读宽度</label>
                  <select
                    value={localSettings.contentWidth || 'standard'}
                    onChange={(e) => updateSetting('contentWidth', e.target.value as ContentWidthMode)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="narrow">窄幅居中 (Narrow · 720px)</option>
                    <option value="standard">标准适中 (Standard · 960px)</option>
                    <option value="wide">宽屏视野 (Wide · 1280px)</option>
                    <option value="full">全幅铺展 (Full · 100%)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">
                    基准正文字号: <span className="text-blue-400 font-mono">{localSettings.fontSize || 15}px</span>
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={22}
                    step={1}
                    value={localSettings.fontSize || 15}
                    onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                    <span>12px 紧凑</span>
                    <span>15px 推荐</span>
                    <span>22px 舒适</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 视图与分屏 */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              {/* 默认视图模式 */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">默认文档打开视图</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'preview', label: '预览优先', desc: '富文本与矢量图' },
                    { id: 'split', label: '分屏协作', desc: '边写边渲染' },
                    { id: 'source', label: '源码纯编', desc: '专注纯代码' },
                    { id: 'mindmap', label: '全景导图', desc: '矢量树形视口' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => updateSetting('viewMode', m.id as ViewMode)}
                      className={`p-2 rounded-lg border text-left transition ${
                        localSettings.viewMode === m.id
                          ? 'border-blue-500 bg-blue-600/15 text-white font-medium shadow-xs'
                          : 'border-slate-800 bg-slate-850 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-medium text-xs">{m.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 分屏右侧默认展现与分屏默认比例 */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">分屏模式右侧优先展示</label>
                  <select
                    value={localSettings.splitRightMode || 'preview'}
                    onChange={(e) => updateSetting('splitRightMode', e.target.value as 'preview' | 'mindmap')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="preview">📖 实时富文本与图表预览 (Preview)</option>
                    <option value="mindmap">🌿 交互式 Markmap 导图 (Mindmap)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">
                    默认分屏比例 (代码占比): <span className="text-blue-400 font-mono">{localSettings.splitRatio || 50}%</span>
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    step={5}
                    value={localSettings.splitRatio || 50}
                    onChange={(e) => updateSetting('splitRatio', Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                    <span>30% 紧凑</span>
                    <span>50% 对等</span>
                    <span>70% 源码主导</span>
                  </div>
                </div>
              </div>

              {/* 开关选项 */}
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">默认展开大纲目录抽屉 (Outline)</div>
                    <div className="text-[10px] text-slate-400">打开 Markdown 文档时自动唤起右侧章节导航</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.outlineOpen ?? true}
                    onChange={(e) => updateSetting('outlineOpen', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <div className="p-2 rounded-lg bg-slate-850 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200">文档大纲停靠位置 (Outline Position)</div>
                      <div className="text-[10px] text-slate-400">支持靠左侧边栏、靠右侧边栏或悬浮微型浮窗</div>
                    </div>
                    <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                      {[
                        { id: 'left', label: '靠左' },
                        { id: 'right', label: '靠右' },
                        { id: 'floating', label: '悬浮' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => updateSetting('outlinePosition', pos.id as OutlinePosition)}
                          className={`px-2.5 py-1 rounded text-xs transition ${
                            (localSettings.outlinePosition || 'right') === pos.id
                              ? 'bg-blue-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">代码与文档自动换行 (Word Wrap)</div>
                    <div className="text-[10px] text-slate-400">源码视图与编辑框依据可视宽度软折行</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.wordWrap ?? true}
                    onChange={(e) => updateSetting('wordWrap', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">显示代码行号 (Line Numbers)</div>
                    <div className="text-[10px] text-slate-400">在各源码编辑器与诊断报告中标识行号定位</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.showLineNumbers ?? true}
                    onChange={(e) => updateSetting('showLineNumbers', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">Google OKF 概念元数据卡片渲染</div>
                    <div className="text-[10px] text-slate-400">自动解析 Markdown Frontmatter 元数据、Tags 标签栏及知识图谱关系</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.enableOkfRendering ?? true}
                    onChange={(e) => updateSetting('enableOkfRendering', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">Markdown 源码与预览双向同步 (Scroll Sync)</div>
                    <div className="text-[10px] text-slate-400">分屏模式下编辑器滚动实时同步预览位置；双击段落反向精确定位光标行</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.scrollSync ?? true}
                    onChange={(e) => updateSetting('scrollSync', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: 图表引擎服务 */}
          {activeTab === 'diagrams' && (
            <div className="space-y-4">
              <div>
                <label className="font-semibold text-slate-200 block mb-1">PlantUML 渲染服务器端点</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  支持切换公网官方服务器或本地 Docker/企业自建内网私有渲染节点
                </p>
                <div className="space-y-2">
                  {PLANTUML_SERVER_PRESETS.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                        localSettings.plantUmlServerUrl === p.url || (!p.url && !['https://www.plantuml.com/plantuml', 'http://localhost:8080'].includes(localSettings.plantUmlServerUrl || ''))
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-slate-800 bg-slate-850 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-blue-400" />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.url && <div className="text-[10px] text-slate-500 font-mono">{p.url}</div>}
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="plantuml_server"
                        checked={localSettings.plantUmlServerUrl === p.url || (!p.url && !['https://www.plantuml.com/plantuml', 'http://localhost:8080'].includes(localSettings.plantUmlServerUrl || ''))}
                        onChange={() => {
                          if (p.url) updateSetting('plantUmlServerUrl', p.url);
                        }}
                        className="accent-blue-600"
                      />
                    </label>
                  ))}

                  <div className="pt-2">
                    <label className="text-[11px] text-slate-400 block mb-1">自定义服务端点 URL：</label>
                    <input
                      type="url"
                      value={localSettings.plantUmlServerUrl || ''}
                      onChange={(e) => updateSetting('plantUmlServerUrl', e.target.value)}
                      placeholder="https://your-private-plantuml.internal/plantuml"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="font-semibold text-slate-200 block mb-1">思维导图分屏偏好</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">大纲源码占比：</span>
                  <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    {[30, 42, 50, 70].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => updateSetting('mindmapSplitRatio', ratio)}
                        className={`px-2.5 py-1 rounded text-xs transition ${
                          (localSettings.mindmapSplitRatio || 42) === ratio
                            ? 'bg-cyan-600 text-white font-medium shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ratio}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 存储与备份 */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              {/* 存储统计卡片 */}
              <div className="p-3.5 bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">本地存储占用统计 (LocalStorage)</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">
                    {storageStats.usedKb} KB <span className="text-xs font-normal text-slate-500">/ 约 5MB 配额</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    ✓ 共已持久化 {storageStats.itemCount} 项 OmniView 状态与文件缓存
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
              </div>

              {/* 备份与恢复 */}
              <div className="space-y-2 pt-2">
                <div className="font-semibold text-slate-200">配置备份与迁移</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleExport}
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 transition"
                  >
                    <Download className="w-4 h-4 text-blue-400" />
                    <div className="text-left">
                      <div className="font-medium">导出设置备份</div>
                      <div className="text-[10px] text-slate-500">下载完整 .json 配置文件</div>
                    </div>
                  </button>

                  <label className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <div className="text-left">
                      <div className="font-medium">导入设置还原</div>
                      <div className="text-[10px] text-slate-500">从已有 .json 恢复</div>
                    </div>
                    <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                  </label>
                </div>
              </div>

              {/* 恢复出厂设置 */}
              <div className="pt-3 border-t border-slate-800">
                <div className="font-semibold text-rose-300 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>危险区域：重置与恢复出厂</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  重置后，主题、排版、分屏、服务器端点等全部配置将恢复为标准预设，工作区将重置为标准示范文档集。
                </p>
                <button
                  onClick={handleResetAll}
                  className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>恢复出厂设置并还原演示工作区</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="text-[10px] text-slate-500 font-mono">
            Key: <span className="text-slate-400">omniview:workbench:settings:v2</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
