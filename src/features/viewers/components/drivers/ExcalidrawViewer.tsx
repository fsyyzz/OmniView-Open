/**
 * OmniView Excalidraw 手绘白板工作室组件 (Phase 2 完整双向交互与白板系统)
 * 支持：
 * 1. 完整画布双向交互式编辑 (Canvas Studio) - 支持手绘图元、矩形、椭圆、箭头、线条、文本、画笔、橡皮擦等全量工具
 * 2. 双向分屏联动 (Split) - 左侧 JSON 源码即时编辑 / 右侧交互白板实时响应
 * 3. 高保真只读演示 (Preview) - 矢量 SVG 纯净展示，支持平移拖拽与缩放
 * 4. JSON 源码编辑 (Source Code) - 全屏源码编辑与一键语法美化
 * 5. 辅助网格 (Grid)、禅模式 (Zen Mode)、只读锁定 (Lock) 与视口自动居中 (Fit Content)
 * 6. 多维度高品质导出：.svg 矢量、.png 2x 视网膜图、.excalidraw 原生工程文件及剪贴板互通
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Download,
  Share2,
  ChevronDown,
  Columns,
  Eye,
  FileCode,
  AlertCircle,
  Sparkles,
  Grid,
  Loader2,
  PenTool,
  Lock,
  Unlock,
  Focus,
  LayoutTemplate,
  Play,
  Layers,
  GitFork,
  MoreHorizontal,
} from 'lucide-react';
import { Locale } from '../../../../shared/lib/i18n';
import { ThemeId } from '../../../../shared/types';
import {
  parseExcalidrawJson,
  downloadBlob,
  embedExcalidrawPayloadInSvg,
  autoCreateFrames,
  convertMermaidToExcalidraw,
  getExcalidrawLibraryUrl,
  parseExcalidrawLibJson,
  exportStencilsAsExcalidrawLibBlob,
} from './excalidraw/excalidrawEngine';
import {
  ExcalidrawTemplate,
  EXCALIDRAW_STENCILS,
  ExcalidrawStencil,
  getAllPresetLibraryItems,
  stencilsToLibraryItems,
} from './excalidraw/excalidrawTemplates';
import { RenderErrorBoundary } from '../common/RenderErrorBoundary';
import { useExcalidrawCanvas, ExcalidrawViewMode } from './excalidraw/useExcalidrawCanvas';
import {
  ExcalidrawTemplatesModal,
  ExcalidrawMermaidModal,
  ExcalidrawStencilsDrawer,
  StencilsTabId,
} from './excalidraw/excalidrawModals';
import { ExcalidrawSlideHud } from './excalidraw/ExcalidrawSlideHud';

const ExcalidrawCanvas = React.lazy(() =>
  import('./excalidraw/ExcalidrawCanvas').then((m) => ({ default: m.ExcalidrawCanvas }))
);

export interface ExcalidrawViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  onContentChange?: (content: string) => void;
}

export const ExcalidrawViewer: React.FC<ExcalidrawViewerProps> = ({
  content,
  fileName = 'drawing.excalidraw',
  locale = 'zh-CN',
  isDarkTheme = false,
  onContentChange,
}) => {
  const isZh = locale === 'zh-CN';

  // 编辑态 JSON 文本
  const [sourceText, setSourceText] = useState<string>(content);
  // 模式：交互白板 (canvas) / 双向分屏 (split) / 只读演示 (preview) / 源码编辑 (code)
  const [viewMode, setViewMode] = useState<ExcalidrawViewMode>('canvas');

  // 画布工具选项
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);

  // Excalidraw Imperative API 引用
  const excalidrawApiRef = useRef<any>(null);

  // 复制与导出反馈
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mermaid 代码转译手绘模态框状态
  const [showMermaidModal, setShowMermaidModal] = useState<boolean>(false);
  const [mermaidCode, setMermaidCode] = useState<string>(
    'flowchart TD\n  A[用户终端 App] --> B[API Gateway 网关]\n  B --> C[Order 微服务]\n  B --> D[Payment 微服务]\n  C --> E[(MySQL 数据库)]\n  D --> F[Redis 缓存]'
  );
  const [mermaidError, setMermaidError] = useState<string | null>(null);

  // 架构物料与素材资产中心状态
  const [showStencilsDrawer, setShowStencilsDrawer] = useState<boolean>(false);
  const [stencilsTab, setStencilsTab] = useState<StencilsTabId>('stencils');
  const [stencilSearch, setStencilSearch] = useState<string>('');
  const [selectedStencilCategory, setSelectedStencilCategory] = useState<string>('all');
  const [copiedLibUrl, setCopiedLibUrl] = useState<boolean>(false);
  const [libraryToast, setLibraryToast] = useState<string | null>(null);

  // 外部导入 URL 与 JSON 状态
  const [importUrl, setImportUrl] = useState<string>('');
  const [isImportingUrl, setIsImportingUrl] = useState<boolean>(false);
  const [importUrlError, setImportUrlError] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importJsonError, setImportJsonError] = useState<string | null>(null);
  const [customStencilName, setCustomStencilName] = useState<string>('');
  const [showSaveCustomInput, setShowSaveCustomInput] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customStencils, setCustomStencils] = useState<ExcalidrawStencil[]>(() => {
    try {
      const saved = localStorage.getItem('omniview_excalidraw_stencils');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 同步外部传入的 content（例如打开不同文件或外部撤销恢复）
  useEffect(() => {
    setSourceText(content);
  }, [content]);

  // 解析 JSON 结构
  const parsedData = useMemo(() => {
    return parseExcalidrawJson(sourceText);
  }, [sourceText]);

  const canvas = useExcalidrawCanvas({
    sourceText,
    setSourceText,
    isDarkTheme,
    viewMode,
    onContentChange,
    parsedData,
    excalidrawApiRef,
  });

  const {
    frames,
    renderedSvg,
    isLoadingSvg,
    renderError,
    scale,
    setScale,
    position,
    setPosition,
    isPanning,
    containerRef,
    navigateToFrame,
    isSlideMode,
    setIsSlideMode,
    currentFrameIndex,
    handleCanvasDocChange,
    handleSourceChange,
    handlePrettifyJson,
    handleCenterView,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
  } = canvas;

  // 一键按图元分组自动生成演示画框
  const handleAutoCreateFrames = () => {
    if (!parsedData.isValid) return;
    const newElements = autoCreateFrames(parsedData.elements);
    const newDoc = {
      type: 'excalidraw',
      version: 2,
      source: 'https://omniview.dev',
      elements: newElements,
      appState: parsedData.appState,
      files: parsedData.files,
    };
    const jsonStr = JSON.stringify(newDoc, null, 2);
    setSourceText(jsonStr);
    onContentChange?.(jsonStr);
    excalidrawApiRef.current?.updateScene({ elements: newElements });
    setTimeout(() => {
      navigateToFrame(0);
    }, 150);
  };

  // Mermaid 代码转译导入
  const handleImportMermaid = () => {
    try {
      setMermaidError(null);
      const { elements, appState } = convertMermaidToExcalidraw(mermaidCode);
      if (elements.length === 0) {
        setMermaidError(isZh ? '未能从代码中解析出有效节点，请检查 Mermaid 语法' : 'No valid nodes parsed');
        return;
      }
      const newDoc = {
        type: 'excalidraw',
        version: 2,
        source: 'https://omniview.dev',
        elements,
        appState: {
          ...parsedData.appState,
          ...appState,
        },
        files: parsedData.files,
      };
      const jsonStr = JSON.stringify(newDoc, null, 2);
      setSourceText(jsonStr);
      onContentChange?.(jsonStr);
      excalidrawApiRef.current?.updateScene({ elements, appState: newDoc.appState });
      setShowMermaidModal(false);
      setTimeout(() => {
        excalidrawApiRef.current?.scrollToContent();
      }, 100);
    } catch (err: any) {
      setMermaidError(err?.message || 'Mermaid 转换失败');
    }
  };

  // 插入架构物料至画布
  const handleInsertStencil = (stencil: ExcalidrawStencil) => {
    if (!stencil || !stencil.elements) return;
    const existing = parsedData.elements || [];
    const offsetX = 240 + Math.random() * 50;
    const offsetY = 180 + Math.random() * 50;
    const stamp = Date.now();
    const newEls = stencil.elements.map((el, i) => ({
      ...el,
      id: `stencil-${stamp}-${i}`,
      x: (el.x || 0) + offsetX,
      y: (el.y || 0) + offsetY,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
    }));
    const combined = [...existing, ...newEls];
    const newDoc = {
      type: 'excalidraw',
      version: 2,
      source: 'https://omniview.dev',
      elements: combined,
      appState: parsedData.appState,
      files: parsedData.files,
    };
    const jsonStr = JSON.stringify(newDoc, null, 2);
    setSourceText(jsonStr);
    onContentChange?.(jsonStr);
    excalidrawApiRef.current?.updateScene({ elements: combined });
    setShowStencilsDrawer(false);
  };

  // 动态生成 Excalidraw 官方社区素材库 URL（自动附带 OmniView 宿主回跳参数与 Token 标识）
  const officialLibraryUrl = useMemo(() => {
    return getExcalidrawLibraryUrl({
      theme: isDarkTheme ? 'dark' : 'light',
      token: 'M7h14NC7js4VCZ5yQsVUR',
    });
  }, [isDarkTheme]);

  const showLibraryToast = (msg: string) => {
    setLibraryToast(msg);
    setTimeout(() => setLibraryToast(null), 3500);
  };

  const handleCopyOfficialLibraryUrl = async () => {
    try {
      await navigator.clipboard.writeText(officialLibraryUrl);
      setCopiedLibUrl(true);
      setTimeout(() => setCopiedLibUrl(false), 2500);
      showLibraryToast(isZh ? '素材库完整链接已复制到剪贴板！' : 'Library URL copied!');
    } catch {
      // fallback
    }
  };

  // 收藏选中图元为自定义物料
  const handleSaveSelectedAsStencil = () => {
    const selected = excalidrawApiRef.current?.getSelectedElements?.() || [];
    if (!selected || selected.length === 0) {
      showLibraryToast(isZh ? '请先在画布中框选要收藏为物料的图元' : 'Please select elements on canvas first');
      return;
    }
    setShowSaveCustomInput(true);
  };

  const handleConfirmSaveCustomStencil = () => {
    const selected = excalidrawApiRef.current?.getSelectedElements?.() || [];
    if (!selected || selected.length === 0) return;
    const name = customStencilName.trim() || (isZh ? '自定义微服务组件' : 'Custom Component');
    const minX = Math.min(...selected.map((el: any) => el.x || 0));
    const minY = Math.min(...selected.map((el: any) => el.y || 0));
    const normalized = selected.map((el: any) => ({
      ...el,
      x: (el.x || 0) - minX,
      y: (el.y || 0) - minY,
    }));
    const newStencil: ExcalidrawStencil = {
      id: `custom-${Date.now()}`,
      name,
      nameEn: name,
      category: 'custom',
      color: '#3b82f6',
      description: isZh ? '工作区本地自定义物料' : 'Workspace custom stencil',
      elements: normalized,
    };
    const updated = [...customStencils, newStencil];
    setCustomStencils(updated);
    try {
      localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
    } catch {}
    setCustomStencilName('');
    setShowSaveCustomInput(false);
    showLibraryToast(isZh ? `已将「${name}」收藏至本地物料库！` : `Saved ${name}!`);
  };

  const handleRemoveCustomStencil = (id: string) => {
    const updated = customStencils.filter((s) => s.id !== id);
    setCustomStencils(updated);
    try {
      localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
    } catch {}
    showLibraryToast(isZh ? '已删除物料' : 'Removed stencil');
  };

  // 将物料直接加入白板素材库
  const handleAddStencilToExcalidrawLibrary = async (stencil: ExcalidrawStencil) => {
    if (!excalidrawApiRef.current) {
      showLibraryToast(isZh ? '请先切换到交互白板模式' : 'Switch to Canvas mode first');
      return;
    }
    try {
      const items = stencilsToLibraryItems([stencil]);
      await excalidrawApiRef.current.updateLibrary({
        libraryItems: items,
        merge: true,
        openLibraryMenu: true,
        defaultStatus: 'published',
      });
      showLibraryToast(isZh ? `已将「${stencil.name}」加入白板素材库！` : `Added ${stencil.name} to library!`);
    } catch (err: any) {
      showLibraryToast(err?.message || (isZh ? '加入失败' : 'Failed to add'));
    }
  };

  // 一键将全套预置素材包同步至白板
  const handleInstallAllPresetToCanvas = async () => {
    if (!excalidrawApiRef.current) {
      showLibraryToast(isZh ? '请先切换到交互白板模式' : 'Switch to Canvas mode first');
      return;
    }
    try {
      const presetItems = getAllPresetLibraryItems();
      await excalidrawApiRef.current.updateLibrary({
        libraryItems: presetItems,
        merge: true,
        openLibraryMenu: true,
        defaultStatus: 'published',
      });
      showLibraryToast(
        isZh
          ? `已将 ${presetItems.length} 个预置全套物料包同步至白板素材库！`
          : `Synced ${presetItems.length} stencils to library!`
      );
    } catch (err: any) {
      showLibraryToast(err?.message || (isZh ? '同步失败' : 'Sync failed'));
    }
  };

  // 本地文件导入 (.excalidrawlib / .json)
  const handleImportLibFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = parseExcalidrawLibJson(text);
      if (!res.isValid || res.libraryItems.length === 0) {
        showLibraryToast(res.errorMessage || (isZh ? '未能识别有效素材库格式' : 'Failed to parse library file'));
        return;
      }
      if (excalidrawApiRef.current) {
        await excalidrawApiRef.current.updateLibrary({
          libraryItems: res.libraryItems,
          merge: true,
          openLibraryMenu: true,
          defaultStatus: 'published',
        });
      }
      const newStencils: ExcalidrawStencil[] = res.libraryItems.map((item, idx) => ({
        id: `imported-${Date.now()}-${idx}`,
        name: item.name || file.name.replace(/\.[^/.]+$/, '') + ` #${idx + 1}`,
        nameEn: item.name || `Imported #${idx + 1}`,
        category: 'custom',
        color: '#06b6d4',
        description: isZh ? `从文件 ${file.name} 导入` : `Imported from ${file.name}`,
        elements: item.elements || [],
      }));
      const updated = [...customStencils, ...newStencils];
      setCustomStencils(updated);
      try {
        localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
      } catch {}
      showLibraryToast(isZh ? `成功导入 ${res.libraryItems.length} 个素材！` : `Imported ${res.libraryItems.length} items!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      showLibraryToast(err?.message || (isZh ? '导入发生异常' : 'Import error'));
    }
  };

  // 网络 URL 导入
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    setIsImportingUrl(true);
    setImportUrlError(null);
    try {
      const resp = await fetch(importUrl.trim());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const res = parseExcalidrawLibJson(text);
      if (!res.isValid || res.libraryItems.length === 0) {
        setImportUrlError(res.errorMessage || (isZh ? '未能识别有效素材数据' : 'Invalid library content'));
        return;
      }
      if (excalidrawApiRef.current) {
        await excalidrawApiRef.current.updateLibrary({
          libraryItems: res.libraryItems,
          merge: true,
          openLibraryMenu: true,
          defaultStatus: 'published',
        });
      }
      const newStencils: ExcalidrawStencil[] = res.libraryItems.map((item, idx) => ({
        id: `url-imported-${Date.now()}-${idx}`,
        name: item.name || `网络素材 #${idx + 1}`,
        nameEn: item.name || `Network Stencil #${idx + 1}`,
        category: 'custom',
        color: '#8b5cf6',
        description: isZh ? `从网络地址导入` : `Imported from URL`,
        elements: item.elements || [],
      }));
      const updated = [...customStencils, ...newStencils];
      setCustomStencils(updated);
      try {
        localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
      } catch {}
      showLibraryToast(isZh ? `网络素材导入成功 (${res.libraryItems.length} 项)` : `Imported ${res.libraryItems.length} items`);
      setImportUrl('');
    } catch (err: any) {
      setImportUrlError(err?.message || (isZh ? '网络拉取失败，请检查跨域或 URL 有效性' : 'Fetch failed'));
    } finally {
      setIsImportingUrl(false);
    }
  };

  // 粘贴 JSON 源码导入
  const handleImportFromJsonText = async () => {
    if (!importJsonText.trim()) return;
    setImportJsonError(null);
    try {
      const res = parseExcalidrawLibJson(importJsonText.trim());
      if (!res.isValid || res.libraryItems.length === 0) {
        setImportJsonError(res.errorMessage || (isZh ? '无效的 Excalidraw 格式' : 'Invalid JSON format'));
        return;
      }
      if (excalidrawApiRef.current) {
        await excalidrawApiRef.current.updateLibrary({
          libraryItems: res.libraryItems,
          merge: true,
          openLibraryMenu: true,
          defaultStatus: 'published',
        });
      }
      const newStencils: ExcalidrawStencil[] = res.libraryItems.map((item, idx) => ({
        id: `json-imported-${Date.now()}-${idx}`,
        name: item.name || `JSON 素材 #${idx + 1}`,
        nameEn: item.name || `JSON Stencil #${idx + 1}`,
        category: 'custom',
        color: '#10b981',
        description: isZh ? '从 JSON 源码导入' : 'Imported from JSON',
        elements: item.elements || [],
      }));
      const updated = [...customStencils, ...newStencils];
      setCustomStencils(updated);
      try {
        localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
      } catch {}
      showLibraryToast(isZh ? `成功解析并导入 ${res.libraryItems.length} 个素材！` : `Imported ${res.libraryItems.length} items!`);
      setImportJsonText('');
    } catch (err: any) {
      setImportJsonError(err?.message || 'JSON 语法错误');
    }
  };

  // 导出全量素材库为 .excalidrawlib
  const handleExportAllStencils = () => {
    const all = [...EXCALIDRAW_STENCILS, ...customStencils];
    const blob = exportStencilsAsExcalidrawLibBlob(all);
    downloadBlob(blob, `omniview-materials-${Date.now()}.excalidrawlib`);
    showLibraryToast(isZh ? '素材库导出成功 (.excalidrawlib)' : 'Exported .excalidrawlib');
  };

  // 监听点击外部关闭导出菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showExportMenu]);

  // 切换模式时自动触发画布刷新以校准宽高尺寸
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        excalidrawApiRef.current?.refresh();
      } catch {
        // ignore
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [viewMode]);

  // 应用预置模板
  const handleApplyTemplate = (template: ExcalidrawTemplate) => {
    const jsonStr = JSON.stringify(template.data, null, 2);
    setSourceText(jsonStr);
    onContentChange?.(jsonStr);
    setShowTemplatesModal(false);
  };

  // 复制反馈辅助
  const triggerCopyFeedback = async (label: string, action: () => Promise<void> | void) => {
    try {
      await action();
      setCopiedAction(label);
      setTimeout(() => setCopiedAction(null), 1800);
      setShowExportMenu(false);
    } catch (e) {
      console.error(e);
    }
  };

  // 导出操作
  const handleExportSelfContainedSvgFile = () => {
    if (!renderedSvg) return;
    const embedded = embedExcalidrawPayloadInSvg(renderedSvg, parsedData);
    const blob = new Blob([embedded], { type: 'image/svg+xml;charset=utf-8' });
    const name = fileName.replace(/\.(excalidraw|json|svg)$/i, '') + '.excalidraw.svg';
    downloadBlob(blob, name);
    setShowExportMenu(false);
  };

  const handleExportSvgFile = () => {
    if (!renderedSvg) return;
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const name = fileName.replace(/\.(excalidraw|json)$/i, '') + '.svg';
    downloadBlob(blob, name);
    setShowExportMenu(false);
  };

  const handleExportPngFile = () => {
    if (!renderedSvg) return;
    const img = new Image();
    const svgBlob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvasEl = document.createElement('canvas');
      canvasEl.width = (img.naturalWidth || 1200) * 2;
      canvasEl.height = (img.naturalHeight || 800) * 2;
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvasEl.toBlob((blob) => {
          if (blob) {
            const name = fileName.replace(/\.(excalidraw|json)$/i, '') + '.png';
            downloadBlob(blob, name);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setShowExportMenu(false);
  };

  const handleExportExcalidrawFile = () => {
    const blob = new Blob([sourceText], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, fileName.endsWith('.excalidraw') ? fileName : `${fileName}.excalidraw`);
    setShowExportMenu(false);
  };

  const handleCopySvgXml = async () => {
    if (!renderedSvg) return;
    await navigator.clipboard.writeText(renderedSvg);
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(sourceText);
  };

  // 视口容器与工具栏宽度响应式监听 (解决 VS Code 分屏/侧边栏等小尺寸场景下的自适应折叠)
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(1000);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolbarRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setToolbarWidth(entry.contentRect.width);
      }
    });
    ro.observe(toolbarRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showOverflowMenu]);

  // 尺寸断点
  const showModeLabels = toolbarWidth >= 860;
  const showBadge = toolbarWidth >= 700;
  const showStats = toolbarWidth >= 960;
  const showExtraCanvasTools = toolbarWidth >= 680;
  const showSlideFull = toolbarWidth >= 880;
  const showSlideBtn = toolbarWidth >= 620;
  const showMermaidBtn = toolbarWidth >= 740;
  const showMaterialsBtn = toolbarWidth >= 800;
  const showTemplatesBtn = toolbarWidth >= 620;
  const showExportLabel = toolbarWidth >= 520;
  const showOverflowBtn = toolbarWidth < 800;

  return (
    <div
      id="excalidraw-viewer-container"
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="h-full w-full flex flex-col select-none overflow-hidden"
    >
      {/* 顶部工具栏 */}
      <div
        ref={toolbarRef}
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex-shrink-0 h-11 px-2.5 sm:px-3 border-b flex items-center justify-between gap-1.5 sm:gap-2 z-20 min-w-0"
      >
        {/* 左侧：文件名、白板标签与模式切换 */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-xs shrink-0" style={{ color: 'var(--ov-text)' }}>
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className={`truncate ${toolbarWidth < 500 ? 'max-w-[70px]' : 'max-w-[130px] sm:max-w-xs'}`}>{fileName}</span>
            {showBadge && (
              <span
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border inline-block"
              >
                Excalidraw 2.0
              </span>
            )}
          </div>

          <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-4 w-px mx-0.5 sm:mx-1 hidden xs:block" />

          {/* 模式切换 (白板工作室 / 双向分屏 / 只读演示 / JSON 源码) */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center p-0.5 rounded-lg border shrink-0"
          >
            <button
              onClick={() => setViewMode('canvas')}
              style={{
                backgroundColor: viewMode === 'canvas' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'canvas' ? 'var(--ov-text-on-accent, #ffffff)' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? '全屏交互白板工作室' : 'Full Whiteboard Canvas'}
            >
              <PenTool className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '交互白板' : 'Canvas'}</span>}
            </button>
            <button
              onClick={() => setViewMode('split')}
              style={{
                backgroundColor: viewMode === 'split' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'split' ? 'var(--ov-text-on-accent, #ffffff)' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? '双向分屏模式 (左侧 JSON 源码 / 右侧即时白板)' : 'Bidirectional Split View'}
            >
              <Columns className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '双向分屏' : 'Split'}</span>}
            </button>
            <button
              onClick={() => setViewMode('preview')}
              style={{
                backgroundColor: viewMode === 'preview' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'preview' ? 'var(--ov-text-on-accent, #ffffff)' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? '只读矢量展示与平移缩放' : 'Read-only Presentation'}
            >
              <Eye className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '只读演示' : 'Preview'}</span>}
            </button>
            <button
              onClick={() => setViewMode('code')}
              style={{
                backgroundColor: viewMode === 'code' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'code' ? 'var(--ov-text-on-accent, #ffffff)' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? 'JSON 源码编辑模式' : 'JSON Source Code'}
            >
              <FileCode className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '源码' : 'Source'}</span>}
            </button>
          </div>

          {/* 图元统计 */}
          {showStats && (
            <div className="flex items-center gap-2 text-[11px] font-mono ml-1.5 shrink-0" style={{ color: 'var(--ov-text-secondary)' }}>
              <span>{isZh ? '图元:' : 'Elements:'} <strong className="text-amber-400 font-normal">{parsedData?.elements?.length ?? 0}</strong></span>
              {parsedData?.files && Object.keys(parsedData.files).length > 0 && (
                <span>· {isZh ? '资源:' : 'Files:'} <strong className="text-cyan-400 font-normal">{Object.keys(parsedData.files).length}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* 右侧：画布快捷工具与导出菜单 */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* 白板通用功能：居中、网格、禅模式、锁定 */}
          {viewMode !== 'code' && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCenterView}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '视口自适应居中全部图元' : 'Fit to Content'}
                aria-label="居中视口"
              >
                <Focus className="w-3.5 h-3.5" />
              </button>

              {showExtraCanvasTools && (
                <>
                  <button
                    onClick={() => setShowGrid(!showGrid)}
                    style={{
                      backgroundColor: showGrid ? 'rgba(217, 119, 6, 0.2)' : 'var(--ov-surface)',
                      borderColor: showGrid ? 'var(--ov-accent, #d97706)' : 'var(--ov-border)',
                      color: showGrid ? 'var(--ov-accent, #fbbf24)' : 'var(--ov-text-secondary)',
                    }}
                    className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
                    title={isZh ? '开启/关闭绘图网格' : 'Toggle Grid'}
                    aria-label="网格模式"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsZenMode(!isZenMode)}
                    style={{
                      backgroundColor: isZenMode ? 'rgba(217, 119, 6, 0.2)' : 'var(--ov-surface)',
                      borderColor: isZenMode ? 'var(--ov-accent, #d97706)' : 'var(--ov-border)',
                      color: isZenMode ? 'var(--ov-accent, #fbbf24)' : 'var(--ov-text-secondary)',
                    }}
                    className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
                    title={isZh ? '专注/禅模式 (隐藏冗余界面)' : 'Zen Mode'}
                    aria-label="禅模式"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsViewOnly(!isViewOnly)}
                    style={{
                      backgroundColor: isViewOnly ? 'color-mix(in srgb, var(--ov-accent) 20%, transparent)' : 'var(--ov-surface)',
                      borderColor: isViewOnly ? 'var(--ov-accent)' : 'var(--ov-border)',
                      color: isViewOnly ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                    }}
                    className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
                    title={isZh ? (isViewOnly ? '已只读锁定 (点击解锁编辑)' : '点击锁定为只读') : (isViewOnly ? 'Locked (Click to edit)' : 'Click to lock')}
                    aria-label="只读锁定"
                  >
                    {isViewOnly ? <Lock className="w-3.5 h-3.5 text-blue-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          )}

          {/* 处于预览模式下的专属缩放控制器 */}
          {viewMode === 'preview' && (
            <div className="flex items-center gap-1 border-l pl-1 sm:pl-1.5" style={{ borderColor: 'var(--ov-border)' }}>
              <button
                onClick={() => setScale((s) => Math.max(0.2, Number((s - 0.1).toFixed(2))))}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '缩小' : 'Zoom Out'}
                aria-label="缩小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              {toolbarWidth >= 500 && (
                <span
                  onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
                  className="font-mono text-amber-400 min-w-[36px] text-center font-semibold cursor-pointer hover:underline text-[11px]"
                  title="点击重置 100%"
                >
                  {Math.round(scale * 100)}%
                </span>
              )}
              <button
                onClick={() => setScale((s) => Math.min(4, Number((s + 0.1).toFixed(2))))}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '放大' : 'Zoom In'}
                aria-label="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '重置视角' : 'Reset View'}
                aria-label="重置视角"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 处于源码模式下的格式化按钮 */}
          {viewMode === 'code' && (
            <button
              onClick={handlePrettifyJson}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded border text-xs transition hover:border-[var(--ov-accent)]"
              title="格式化 JSON 源码"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {toolbarWidth >= 600 && <span>{isZh ? '美化 JSON' : 'Prettify'}</span>}
            </button>
          )}

          {/* 幻灯片演播导览模式 (Prezi 式 Frame 运镜) */}
          {showSlideBtn && (
            <button
              onClick={() => {
                const next = !isSlideMode;
                setIsSlideMode(next);
                if (next && frames.length > 0) {
                  navigateToFrame(0);
                }
              }}
              style={{
                backgroundColor: isSlideMode ? 'color-mix(in srgb, var(--ov-accent) 20%, transparent)' : 'var(--ov-surface)',
                borderColor: isSlideMode ? 'color-mix(in srgb, var(--ov-accent) 50%, transparent)' : 'var(--ov-border)',
                color: isSlideMode ? 'var(--ov-accent)' : 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${showSlideFull ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition hover:border-[var(--ov-accent)]`}
              title={isZh ? '启动 Prezi 式 Frame 画框运镜导览演播' : 'Slide Presentation Mode'}
              aria-label="幻灯片演播"
            >
              <Play className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
              {showSlideFull && <span>{isZh ? '演播' : 'Slides'}</span>}
              {frames.length > 0 && (
                <span className="px-1 py-0.2 text-[10px] rounded font-mono" style={{ backgroundColor: 'color-mix(in srgb, var(--ov-accent) 20%, transparent)', color: 'var(--ov-accent)' }}>
                  {frames.length}
                </span>
              )}
            </button>
          )}

          {/* Mermaid 转译导入按钮 */}
          {showMermaidBtn && (
            <button
              onClick={() => setShowMermaidModal(true)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${toolbarWidth >= 860 ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition hover:border-emerald-500 hover:text-emerald-400`}
              title={isZh ? 'Mermaid 代码一键转手绘白板图' : 'Import Mermaid'}
              aria-label="导入 Mermaid"
            >
              <GitFork className="w-3.5 h-3.5 text-emerald-400" />
              {toolbarWidth >= 860 && <span>Mermaid</span>}
            </button>
          )}

          {/* 素材与物料中心按钮 */}
          {showMaterialsBtn && (
            <button
              onClick={() => setShowStencilsDrawer(true)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${toolbarWidth >= 900 ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition group hover:border-cyan-500`}
              title={isZh ? '素材与物料中心 (包含 Excalidraw 官方社区素材库、预置物料包与离线导入)' : 'Materials & Stencils Hub'}
              aria-label="素材中心"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 transition" />
              {toolbarWidth >= 900 && <span>{isZh ? '素材中心' : 'Materials'}</span>}
              <span
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
                className="text-[10px] px-1 py-0.2 rounded font-mono border"
              >
                {EXCALIDRAW_STENCILS.length + customStencils.length}
              </span>
            </button>
          )}

          {/* 预置模板库按钮 */}
          {showTemplatesBtn && (
            <button
              onClick={() => setShowTemplatesModal(true)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${toolbarWidth >= 860 ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition hover:border-amber-500 hover:text-amber-400`}
              title={isZh ? '选择架构图/流程图/思维导图预置模板' : 'Whiteboard Starter Templates'}
              aria-label="预置模板"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
              {toolbarWidth >= 860 && <span>{isZh ? '预置模板' : 'Templates'}</span>}
            </button>
          )}

          {/* 统一导出与复制菜单 */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`flex items-center gap-1.5 ${showExportLabel ? 'px-2.5 sm:px-3' : 'p-1.5'} py-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-md transition shadow-sm font-medium text-xs cursor-pointer`}
              title="导出手绘白板图与文件"
              aria-label="导出"
            >
              {copiedAction ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
              {showExportLabel && (
                <span>
                  {copiedAction ? `${isZh ? '已复制' : 'Copied'}: ${copiedAction}` : (isZh ? '导出 / 分享' : 'Export')}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showExportMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1.5 w-60 border rounded-lg shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 backdrop-blur"
              >
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider border-b" style={{ color: 'var(--ov-text-secondary)', borderColor: 'var(--ov-border)' }}>
                  {isZh ? '图形与文件导出' : 'File Export'}
                </div>
                <button
                  onClick={handleExportSelfContainedSvgFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left group"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-1.5">
                      <span>{isZh ? '导出为 .excalidraw.svg' : 'Export .excalidraw.svg'}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {isZh ? '自包含' : 'Polyglot'}
                      </span>
                    </div>
                    <div className="text-[10px] leading-tight" style={{ color: 'var(--ov-text-secondary)' }}>
                      {isZh ? '矢量图内嵌工程数据，支持拖入再编辑' : 'Self-contained editable SVG'}
                    </div>
                  </div>
                </button>
                <button
                  onClick={handleExportSvgFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .SVG 矢量图' : 'Export as .SVG'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '标准 SVG 矢量图形文件' : 'Standard vector format'}</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPngFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .PNG 高清位图' : 'Export as .PNG'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '2x 视网膜清晰度' : 'Retina raster image'}</div>
                  </div>
                </button>
                <button
                  onClick={handleExportExcalidrawFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Download className="w-4 h-4 text-orange-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .excalidraw 原生文件' : 'Export .excalidraw file'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '直接兼容官方 Web 客户端' : 'Compatible with excalidraw.com'}</div>
                  </div>
                </button>

                <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ov-text-secondary)' }}>
                  {isZh ? '快速复制至剪贴板' : 'Clipboard'}
                </div>
                <button
                  onClick={() => triggerCopyFeedback('SVG XML', handleCopySvgXml)}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '复制 SVG 代码' : 'Copy SVG XML'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '用于插入网页或 Markdown' : 'Paste into HTML/Markdown'}</div>
                  </div>
                </button>
                <button
                  onClick={() => triggerCopyFeedback('JSON', handleCopyJson)}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Copy className="w-4 h-4 text-blue-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '复制 Excalidraw JSON' : 'Copy Document JSON'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '完整图元数据树' : 'Raw elements data'}</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 小尺寸折叠溢出更多菜单 (...) */}
          {showOverflowBtn && (
            <div className="relative" ref={overflowMenuRef}>
              <button
                onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                style={{
                  backgroundColor: showOverflowMenu ? 'var(--ov-surface-header)' : 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1.5 rounded border transition hover:border-[var(--ov-accent)]"
                title={isZh ? '更多工具与扩展功能' : 'More Whiteboard Tools'}
                aria-label="更多工具"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showOverflowMenu && (
                <div
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                  className="absolute right-0 mt-1.5 w-52 border rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 backdrop-blur"
                >
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ color: 'var(--ov-text-secondary)', borderColor: 'var(--ov-border)' }}>
                    {isZh ? '快捷操作与扩展工具' : 'Extended Tools'}
                  </div>

                  {!showSlideBtn && (
                    <button
                      onClick={() => {
                        const next = !isSlideMode;
                        setIsSlideMode(next);
                        if (next && frames.length > 0) navigateToFrame(0);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <Play className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isZh ? '幻灯片演播导览' : 'Slide Presentation'}</span>
                    </button>
                  )}

                  {!showTemplatesBtn && (
                    <button
                      onClick={() => {
                        setShowTemplatesModal(true);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isZh ? '预置模板库' : 'Starter Templates'}</span>
                    </button>
                  )}

                  {!showMermaidBtn && (
                    <button
                      onClick={() => {
                        setShowMermaidModal(true);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <GitFork className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isZh ? 'Mermaid 转手绘图' : 'Import Mermaid'}</span>
                    </button>
                  )}

                  {!showMaterialsBtn && (
                    <button
                      onClick={() => {
                        setShowStencilsDrawer(true);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isZh ? '素材物料中心' : 'Materials & Stencils'}</span>
                    </button>
                  )}

                  {!showExtraCanvasTools && viewMode !== 'code' && (
                    <>
                      <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />
                      <button
                        onClick={() => {
                          setShowGrid(!showGrid);
                          setShowOverflowMenu(false);
                        }}
                        style={{ color: 'var(--ov-text)' }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                      >
                        <Grid className="w-3.5 h-3.5 text-amber-400" />
                        <span>{showGrid ? (isZh ? '隐藏网格' : 'Hide Grid') : (isZh ? '开启网格' : 'Show Grid')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsZenMode(!isZenMode);
                          setShowOverflowMenu(false);
                        }}
                        style={{ color: 'var(--ov-text)' }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isZenMode ? (isZh ? '退出禅模式' : 'Exit Zen') : (isZh ? '进入禅模式' : 'Zen Mode')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsViewOnly(!isViewOnly);
                          setShowOverflowMenu(false);
                        }}
                        style={{ color: 'var(--ov-text)' }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                      >
                        {isViewOnly ? <Lock className="w-3.5 h-3.5 text-blue-400" /> : <Unlock className="w-3.5 h-3.5" />}
                        <span>{isViewOnly ? (isZh ? '解除只读锁定' : 'Unlock') : (isZh ? '只读锁定' : 'Lock')}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 主体交互区域 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧：JSON 源码编辑器（分屏或源码全屏模式） */}
        {(viewMode === 'split' || viewMode === 'code') && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderRightColor: 'var(--ov-border)',
            }}
            className={`flex flex-col border-r min-h-0 ${
              viewMode === 'split' ? 'w-full md:w-2/5 lg:w-1/3' : 'w-full'
            }`}
          >
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderBottomColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="flex-shrink-0 px-3 py-1.5 border-b flex items-center justify-between text-[11px] font-mono"
            >
              <span className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Excalidraw JSON 数据源</span>
              </span>
              <span>{sourceText?.length ?? 0} 字符</span>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <textarea
                value={sourceText}
                onChange={(e) => handleSourceChange(e.target.value)}
                placeholder="在此粘贴或编辑 Excalidraw JSON 结构..."
                spellCheck={false}
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="w-full h-full font-mono text-xs p-3 rounded-lg border outline-none focus:border-amber-500/60 resize-none leading-relaxed transition shadow-inner"
              />
            </div>
            {!parsedData.isValid && (
              <div className="px-3 py-2 bg-red-950/80 border-t border-red-800 text-[11px] text-red-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                <span className="truncate">{parsedData.errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* 交互白板主画布（白板工作室模式与分屏模式） */}
        {(viewMode === 'canvas' || viewMode === 'split') && (
          <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-slate-900">
            <RenderErrorBoundary
              blockName="Excalidraw Whiteboard Canvas"
              fallback={
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-300 gap-3">
                  <div className="text-amber-400 font-semibold text-sm">手绘白板画布初始化容错回退</div>
                  <div className="text-xs text-slate-400 max-w-md text-center">
                    当前图元在白板引擎交互模式下遇到异常，您仍可使用顶部的“只读演示”、“分屏”或“源码”模式查看与编辑完整数据。
                  </div>
                  <button
                    onClick={() => setViewMode('preview')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition"
                  >
                    切换到 SVG 矢量只读演示
                  </button>
                </div>
              }
            >
              <React.Suspense
                fallback={
                  <div className="flex-1 min-h-[400px] flex items-center justify-center text-slate-400 text-xs">
                    加载白板引擎...
                  </div>
                }
              >
                <ExcalidrawCanvas
                  key={fileName}
                  initialParsedData={parsedData}
                  isDarkTheme={isDarkTheme}
                  locale={locale}
                  showGrid={showGrid}
                  isZenMode={isZenMode}
                  isViewOnly={isViewOnly}
                  onDocChange={handleCanvasDocChange}
                  onApiReady={(api) => {
                    excalidrawApiRef.current = api;
                  }}
                  onLibraryLoaded={(count) => {
                    showLibraryToast(
                      isZh
                        ? `已将 ${count} 个外部素材成功载入白板！`
                        : `Loaded ${count} library items into canvas!`
                    );
                  }}
                />
              </React.Suspense>
            </RenderErrorBoundary>
          </div>
        )}

        {/* 只读演示画布（只读展示模式） */}
        {viewMode === 'preview' && (
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={`flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing bg-[var(--ov-surface)] ${
              showGrid ? (isDarkTheme ? 'ov-svg-grid-dark' : 'ov-svg-grid-light') : ''
            }`}
            style={{ touchAction: 'none' }}
          >
            {isLoadingSvg && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-amber-300 shadow-lg backdrop-blur-sm animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>正在编译手绘图元...</span>
              </div>
            )}

            {renderError ? (
              <div className="max-w-md p-5 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 shadow-2xl backdrop-blur-sm flex flex-col gap-2.5">
                <div className="flex items-center gap-2 font-semibold text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>Excalidraw 格式解析异常</span>
                </div>
                <div className="font-mono text-xs text-red-300/80 break-words leading-relaxed">
                  {renderError}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  提示：请切换至源码或分屏模式检查 JSON 语法。
                </div>
              </div>
            ) : (
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.08s ease-out',
                }}
                className="select-none flex items-center justify-center shadow-xl rounded-lg p-2"
                dangerouslySetInnerHTML={{ __html: renderedSvg }}
              />
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 font-mono pointer-events-none backdrop-blur-sm">
              <span>滚轮 / 拖拽平移</span>
              <span>·</span>
              <span>Ctrl + 滚轮缩放</span>
              <span>·</span>
              <span>缩放: {Math.round(scale * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 预置模板弹窗 */}
      {showTemplatesModal && (
        <ExcalidrawTemplatesModal
          isZh={isZh}
          onClose={() => setShowTemplatesModal(false)}
          onApplyTemplate={handleApplyTemplate}
        />
      )}

      {/* Prezi 式 Frame 运镜幻灯片演播 HUD */}
      {isSlideMode && (
        <ExcalidrawSlideHud
          isZh={isZh}
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          onNavigateToFrame={navigateToFrame}
          onOverview={() => excalidrawApiRef.current?.scrollToContent()}
          onAutoCreateFrames={handleAutoCreateFrames}
          onExit={() => setIsSlideMode(false)}
        />
      )}

      {/* Mermaid 代码一键转译模态框 */}
      {showMermaidModal && (
        <ExcalidrawMermaidModal
          isZh={isZh}
          mermaidCode={mermaidCode}
          onMermaidCodeChange={setMermaidCode}
          mermaidError={mermaidError}
          onClose={() => setShowMermaidModal(false)}
          onImport={handleImportMermaid}
        />
      )}

      {/* 素材与架构物料资产中心抽屉 */}
      {showStencilsDrawer && (
        <ExcalidrawStencilsDrawer
          isZh={isZh}
          customStencils={customStencils}
          onRemoveCustomStencil={handleRemoveCustomStencil}
          onInsertStencil={handleInsertStencil}
          onAddStencilToExcalidrawLibrary={handleAddStencilToExcalidrawLibrary}
          stencilsTab={stencilsTab}
          onStencilsTabChange={setStencilsTab}
          stencilSearch={stencilSearch}
          onStencilSearchChange={setStencilSearch}
          selectedStencilCategory={selectedStencilCategory}
          onSelectStencilCategory={setSelectedStencilCategory}
          officialLibraryUrl={officialLibraryUrl}
          copiedLibUrl={copiedLibUrl}
          onCopyOfficialLibraryUrl={handleCopyOfficialLibraryUrl}
          onInstallAllPresetToCanvas={handleInstallAllPresetToCanvas}
          onExportAllStencils={handleExportAllStencils}
          showSaveCustomInput={showSaveCustomInput}
          customStencilName={customStencilName}
          onCustomStencilNameChange={setCustomStencilName}
          onSaveSelectedAsStencil={handleSaveSelectedAsStencil}
          onConfirmSaveCustomStencil={handleConfirmSaveCustomStencil}
          onCancelSaveCustomStencil={() => setShowSaveCustomInput(false)}
          fileInputRef={fileInputRef}
          onImportLibFile={handleImportLibFile}
          importUrl={importUrl}
          onImportUrlChange={setImportUrl}
          isImportingUrl={isImportingUrl}
          importUrlError={importUrlError}
          onImportFromUrl={handleImportFromUrl}
          importJsonText={importJsonText}
          onImportJsonTextChange={setImportJsonText}
          importJsonError={importJsonError}
          onImportFromJsonText={handleImportFromJsonText}
          onClose={() => setShowStencilsDrawer(false)}
        />
      )}

      {/* 浮动素材库 Toast 提示 */}
      {libraryToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-slate-900/95 text-slate-100 text-xs border border-cyan-500/50 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{libraryToast}</span>
        </div>
      )}
    </div>
  );
};
