/**
 * OmniView Markdown 全景思维导图驱动 (Markmap Form A)
 * 支持整篇文档大纲树形交互、动态展开折叠、节点搜索定位、高清 SVG/PNG 矢量导出
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap, IMarkmapOptions } from 'markmap-view';

type IPureNode = ReturnType<Transformer['transform']>['root'];
type INode = Parameters<NonNullable<IMarkmapOptions['color']>>[0];
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Download,
  FileImage,
  ChevronDown,
  Layers,
  FoldHorizontal,
  UnfoldHorizontal,
  ArrowLeft,
  X,
  Check,
} from 'lucide-react';
import { ThemeId, DensityMode } from '../../../../shared/types';
import { Locale, t } from '../../../../shared/lib/i18n';

interface MarkmapViewerProps {
  content: string;
  fileName?: string;
  isDarkTheme?: boolean;
  theme?: ThemeId;
  density?: DensityMode;
  locale?: Locale;
  onOpenSourceAtLine?: (line: number) => void;
  onSwitchToDocumentView?: () => void;
}

const DARK_PALETTE = [
  '#38bdf8', // sky-400
  '#818cf8', // indigo-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
  '#fbbf24', // amber-400
  '#a78bfa', // violet-400
  '#2dd4bf', // teal-400
  '#f87171', // rose-400
];

const LIGHT_PALETTE = [
  '#0284c7', // sky-600
  '#4f46e5', // indigo-600
  '#059669', // emerald-600
  '#db2777', // pink-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0d9488', // teal-600
  '#dc2626', // rose-600
];

function calculateTreeMetrics(node?: IPureNode | null): { totalNodes: number; maxDepth: number } {
  if (!node) return { totalNodes: 0, maxDepth: 0 };
  let total = 1;
  let maxDepth = 1;

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const childMetrics = calculateTreeMetrics(child);
      total += childMetrics.totalNodes;
      maxDepth = Math.max(maxDepth, childMetrics.maxDepth + 1);
    }
  }
  return { totalNodes: total, maxDepth };
}

function setNodeFoldRecursively(node: IPureNode, maxDepth: number, currentDepth = 0): void {
  if (!node) return;
  const hasChildren = Boolean(node.children && node.children.length > 0);
  if (hasChildren) {
    const shouldFold = currentDepth >= maxDepth;
    node.payload = {
      ...node.payload,
      fold: shouldFold ? 1 : 0,
    };
    for (const child of node.children) {
      setNodeFoldRecursively(child, maxDepth, currentDepth + 1);
    }
  }
}

function searchAndExpandMatches(
  node: IPureNode,
  query: string,
  parentAncestors: IPureNode[] = []
): { matchedNodes: IPureNode[]; count: number } {
  if (!node || !query) return { matchedNodes: [], count: 0 };
  const matches: IPureNode[] = [];
  const cleanContent = (node.content || '').replace(/<[^>]+>/g, '').toLowerCase();

  const isMatched = cleanContent.includes(query.toLowerCase());
  if (isMatched) {
    matches.push(node);
    // Unfold all ancestors so match is visible
    for (const ancestor of parentAncestors) {
      ancestor.payload = { ...ancestor.payload, fold: 0 };
    }
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const sub = searchAndExpandMatches(child, query, [...parentAncestors, node]);
      matches.push(...sub.matchedNodes);
    }
  }

  return { matchedNodes: matches, count: matches.length };
}

export const MarkmapViewer: React.FC<MarkmapViewerProps> = ({
  content,
  fileName = 'document.md',
  isDarkTheme = true,
  theme = 'dark',
  locale = 'zh-CN',
  onOpenSourceAtLine,
  onSwitchToDocumentView,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const currentRootRef = useRef<IPureNode | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const transformer = useMemo(() => new Transformer(), []);

  // Compute AST root & metrics
  const { rootNode, metrics } = useMemo(() => {
    if (!content || !content.trim()) {
      return { rootNode: null, metrics: { totalNodes: 0, maxDepth: 0 } };
    }
    try {
      const { root } = transformer.transform(content);
      const m = calculateTreeMetrics(root);
      return { rootNode: root, metrics: m };
    } catch (err) {
      console.error('Markmap transformation error:', err);
      return { rootNode: null, metrics: { totalNodes: 0, maxDepth: 0 } };
    }
  }, [content, transformer]);

  // Color palette selection
  const activePalette = isDarkTheme ? DARK_PALETTE : LIGHT_PALETTE;

  const colorFunction = useCallback(
    (node: INode) => {
      if (node.state && typeof node.state.path === 'string') {
        const parts = node.state.path.split('.');
        const branchIndex = parseInt(parts[1] || '0', 10);
        const idx = isNaN(branchIndex) ? 0 : branchIndex;
        return activePalette[Math.abs(idx) % activePalette.length];
      }
      return activePalette[0];
    },
    [activePalette]
  );

  // Close export menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [exportMenuOpen]);

  // Initialize or re-render Markmap
  useEffect(() => {
    if (!svgRef.current || !rootNode) return;

    // Clone rootNode to avoid mutating original AST
    const rootClone = JSON.parse(JSON.stringify(rootNode)) as IPureNode;
    currentRootRef.current = rootClone;

    const options: Partial<IMarkmapOptions> = {
      autoFit: true,
      duration: 350,
      color: colorFunction,
      maxWidth: 420,
      spacingHorizontal: 80,
      spacingVertical: 12,
      paddingX: 12,
      initialExpandLevel: 3,
    };

    if (!markmapRef.current) {
      try {
        markmapRef.current = Markmap.create(svgRef.current, options, rootClone);
      } catch (err) {
        console.error('Failed to create Markmap instance:', err);
      }
    } else {
      markmapRef.current.setOptions(options);
      markmapRef.current.setData(rootClone).then(() => {
        markmapRef.current?.fit();
      });
    }

    return () => {
      // Keep instance intact across renders, destroy on final unmount
    };
  }, [rootNode, colorFunction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (markmapRef.current) {
        try {
          markmapRef.current.destroy();
        } catch {
          // ignore
        }
        markmapRef.current = null;
      }
    };
  }, []);

  // ResizeObserver for responsive auto-fit on window resize or split-pane adjustment
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeTimer: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (markmapRef.current) {
          markmapRef.current.fit();
        }
      }, 150);
    });

    observer.observe(container);
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []);

  // Handle Search in Mindmap
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!currentRootRef.current || !markmapRef.current) return;

      if (!query.trim()) {
        setMatchCount(null);
        return;
      }

      const { matchedNodes, count } = searchAndExpandMatches(currentRootRef.current, query);
      setMatchCount(count);

      if (count > 0) {
        markmapRef.current.setData(currentRootRef.current).then(() => {
          if (matchedNodes.length > 0) {
            markmapRef.current?.ensureVisible(matchedNodes[0] as unknown as INode);
          }
        });
      }
    },
    []
  );

  // Zoom controls
  const handleZoomIn = () => {
    if (markmapRef.current) {
      markmapRef.current.rescale(1.25);
    }
  };

  const handleZoomOut = () => {
    if (markmapRef.current) {
      markmapRef.current.rescale(0.8);
    }
  };

  const handleFit = () => {
    if (markmapRef.current) {
      markmapRef.current.fit();
    }
  };

  // Expand All
  const handleExpandAll = () => {
    if (!currentRootRef.current || !markmapRef.current) return;
    setNodeFoldRecursively(currentRootRef.current, 999, 0);
    markmapRef.current.setData(currentRootRef.current).then(() => {
      markmapRef.current?.fit();
    });
  };

  // Collapse All to Level 1
  const handleCollapseAll = () => {
    if (!currentRootRef.current || !markmapRef.current) return;
    setNodeFoldRecursively(currentRootRef.current, 1, 0);
    markmapRef.current.setData(currentRootRef.current).then(() => {
      markmapRef.current?.fit();
    });
  };

  // Export SVG
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Add background rect
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', isDarkTheme ? '#0f172a' : '#ffffff');
    svgClone.insertBefore(bgRect, svgClone.firstChild);

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}-mindmap.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  // Export PNG (High-Res 2x)
  const handleExportPng = () => {
    if (!svgRef.current) return;
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const rect = svgRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 1280);
    const height = Math.max(rect.height, 800);

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const dpr = 2; // Retina sharpness
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.fillStyle = isDarkTheme ? '#0b0f19' : '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(pngBlob => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${fileName.replace(/\.[^/.]+$/, '')}-mindmap.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = url;
    setExportMenuOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`h-full w-full flex flex-col overflow-hidden select-none relative ${
        isDarkTheme ? 'markmap-dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
      data-theme={theme}
    >
      {/* Top Interactive Header */}
      <div
        className={`h-11 px-3 border-b flex items-center justify-between shrink-0 z-10 backdrop-blur transition-colors ${
          isDarkTheme
            ? 'bg-slate-900/90 border-slate-800 text-slate-200'
            : 'bg-white/90 border-slate-200 text-slate-800'
        }`}
      >
        {/* Left: Brand Badge & Node Metrics */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onSwitchToDocumentView && (
            <button
              onClick={onSwitchToDocumentView}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition mr-1 font-medium"
              title={t('switchToDocView', locale)}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('switchToDocView', locale)}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold text-xs shrink-0">
            <Network className="w-3.5 h-3.5" />
            <span>{t('mindmapPanorama', locale)}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono opacity-70">
            <span>
              {metrics.totalNodes} {t('mindmapNodes', locale)}
            </span>
            <span>•</span>
            <span>
              {metrics.maxDepth} {t('mindmapDepth', locale)}
            </span>
          </div>

          {/* Quick Search Input */}
          <div className="relative flex items-center ml-2">
            <Search className="w-3 h-3 absolute left-2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder={t('mindmapSearch', locale)}
              className={`h-7 pl-7 pr-6 text-xs rounded-md border transition outline-none w-36 sm:w-48 ${
                isDarkTheme
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500'
                  : 'bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {matchCount !== null && (
              <span className="ml-1.5 text-[10px] font-mono text-indigo-400 font-medium">
                {matchCount > 0 ? `${matchCount} 匹配` : t('mindmapNoMatches', locale)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions & Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Fold / Unfold buttons */}
          <div className="flex items-center bg-slate-800/50 rounded border border-slate-750 p-0.5">
            <button
              onClick={handleExpandAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title={t('mindmapExpandAll', locale)}
            >
              <UnfoldHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden lg:inline">{t('mindmapExpandAll', locale)}</span>
            </button>
            <button
              onClick={handleCollapseAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title={t('mindmapCollapseAll', locale)}
            >
              <FoldHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden lg:inline">{t('mindmapCollapseAll', locale)}</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800/50 rounded border border-slate-750 p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="px-1.5 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition text-xs font-mono font-medium"
              title={t('mindmapFit', locale)}
            >
              <Maximize2 className="w-3.5 h-3.5 inline mr-1" />
              <span className="hidden sm:inline">{t('mindmapFit', locale)}</span>
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition"
              title="导出思维导图"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">导出</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {exportMenuOpen && (
              <div
                className={`absolute right-0 mt-1 w-44 rounded-lg shadow-xl border p-1 z-30 text-xs backdrop-blur ${
                  isDarkTheme
                    ? 'bg-slate-900/95 border-slate-800 text-slate-200'
                    : 'bg-white/95 border-slate-200 text-slate-800'
                }`}
              >
                <button
                  onClick={handleExportSvg}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-indigo-600/20 hover:text-indigo-400 text-left transition"
                >
                  <Network className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('mindmapExportSvg', locale)} (.svg)</span>
                </button>
                <button
                  onClick={handleExportPng}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-indigo-600/20 hover:text-indigo-400 text-left transition"
                >
                  <FileImage className="w-3.5 h-3.5 text-pink-400" />
                  <span>{t('mindmapExportPng', locale)} (.png 2x)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="flex-1 min-h-0 w-full relative overflow-hidden">
        {rootNode ? (
          <svg
            ref={svgRef}
            className="w-full h-full block cursor-grab active:cursor-grabbing"
            style={{
              // Inject custom CSS variables matching theme
              // @ts-expect-error CSS custom variable
              '--markmap-text-color': isDarkTheme ? '#f1f5f9' : '#0f172a',
              '--markmap-circle-open-bg': isDarkTheme ? '#1e293b' : '#ffffff',
              '--markmap-code-bg': isDarkTheme ? '#1e293b' : '#f1f5f9',
              '--markmap-code-color': isDarkTheme ? '#38bdf8' : '#0284c7',
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Network className="w-8 h-8 opacity-40 text-indigo-400" />
            <p className="text-sm">暂无有效的 Markdown 结构可解析为导图</p>
          </div>
        )}

        {/* Floating watermark hint */}
        <div className="absolute bottom-2 right-3 pointer-events-none opacity-40 text-[10px] font-mono text-slate-400">
          Markmap Engine • 滚轮缩放 / 拖拽平移 / 点击圆圈展开
        </div>
      </div>
    </div>
  );
};
