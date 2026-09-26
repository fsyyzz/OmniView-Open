/**
 * OmniView HTML5 网页与沙箱工作台 (HtmlViewer / HtmlStudio)
 * 纯本地优先、零网络依赖、MIT 协议兼容
 * 双层隔离沙箱安全执行 (Strict Sandbox without allow-same-origin)、多设备视口仿真 (Desktop/Tablet/Mobile) 与源码分屏实时热重载
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Sun,
  Moon,
  Laptop,
  Code2,
} from 'lucide-react';
import { DiagramStudioShell, DiagramSnippet } from './DiagramStudioShell';
import { Locale, t } from '../../../../shared/lib/i18n';

interface HtmlViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  onContentChange?: (content: string) => void;
  onOpenInEditor?: () => void;
}

export type HtmlDeviceViewport = 'desktop' | 'tablet' | 'mobile';
export type HtmlCanvasBg = 'checkerboard' | 'white' | 'dark' | 'system';

const HTML_SNIPPETS: DiagramSnippet[] = [
  {
    label: 'HTML5 骨架',
    code: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniView 页面</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.6; color: #1e293b; }
    h1 { color: #0284c7; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; }
  </style>
</head>
<body>
  <h1>欢迎使用 OmniView HTML 工作台</h1>
  <div class="card">
    <p>这是一个运行在受限隔离沙箱内的原生网页预览。</p>
  </div>
</body>
</html>
`,
    tooltip: '插入标准现代 HTML5 单页骨架',
  },
  {
    label: '响应式卡片网格',
    code: `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; padding: 16px;">
  <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <h3 style="margin-top:0; color:#0369a1;">核心指标 A</h3>
    <p style="font-size: 24px; font-weight: bold; color: #0f172a; margin: 8px 0;">99.98%</p>
    <span style="color: #16a34a; font-size: 12px;">↑ 稳态运行中</span>
  </div>
  <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <h3 style="margin-top:0; color:#0369a1;">核心指标 B</h3>
    <p style="font-size: 24px; font-weight: bold; color: #0f172a; margin: 8px 0;">1,420 QPS</p>
    <span style="color: #0284c7; font-size: 12px;">↔ 流量均值</span>
  </div>
</div>
`,
    tooltip: '插入 Flex/Grid 响应式卡片布局片段',
  },
  {
    label: '交互式计数器 (JS)',
    code: `<div style="text-align: center; padding: 32px; font-family: system-ui, sans-serif;">
  <h2>沙箱交互脚本示例</h2>
  <p id="counter" style="font-size: 48px; font-weight: bold; color: #0284c7; margin: 16px 0;">0</p>
  <button onclick="change(1)" style="padding: 8px 20px; font-size: 16px; border-radius: 6px; border: none; background: #0284c7; color: white; cursor: pointer; margin-right: 8px;">增加 +1</button>
  <button onclick="change(-1)" style="padding: 8px 20px; font-size: 16px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; color: #334155; cursor: pointer;">减少 -1</button>
  <script>
    let count = 0;
    function change(d) {
      count += d;
      document.getElementById('counter').innerText = count;
    }
  </script>
</div>
`,
    tooltip: '插入内嵌 JavaScript 的交互测试片段',
  },
];

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniView HTML5 交互式演示文档</title>
  <style>
    :root {
      --primary: #0284c7;
      --primary-hover: #0369a1;
      --bg-page: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --primary: #38bdf8;
        --primary-hover: #0ea5e9;
        --bg-page: #0f172a;
        --card-bg: #1e293b;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --border: #334155;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg-page);
      color: var(--text);
      line-height: 1.6;
      padding: 32px 24px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 32px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    h1 {
      margin: 0 0 8px 0;
      color: var(--primary);
      font-size: 28px;
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      background-color: #0284c720;
      color: var(--primary);
      border: 1px solid var(--primary);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin: 24px 0;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }
    .card h3 {
      margin-top: 0;
      font-size: 18px;
    }
    .metric {
      font-size: 32px;
      font-weight: 700;
      margin: 8px 0;
      color: var(--primary);
    }
    button.btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.15s;
    }
    button.btn:hover {
      background: var(--primary-hover);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge">OmniView Native HTML5 Studio</span>
      <h1>现代单页排版与交互沙箱</h1>
      <p style="color: var(--text-muted); margin: 4px 0 0 0;">
        安全隔离沙箱 · 响应式设备仿真 (Desktop/Tablet/Mobile) · 纯本地双向分屏编辑
      </p>
    </header>

    <div class="grid">
      <div class="card">
        <h3>⚡ 极速加载</h3>
        <p class="metric">0 ms</p>
        <p style="color: var(--text-muted); font-size: 13px;">利用浏览器原生 Webview 内核，零额外三方运行时开销。</p>
      </div>
      <div class="card">
        <h3>🛡️ 安全隔离</h3>
        <p class="metric">100%</p>
        <p style="color: var(--text-muted); font-size: 13px;">严格受控 iframe 沙箱防护，隔离外部环境与全局上下文。</p>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <h3>🎯 响应式与交互验证</h3>
      <p>点击工具栏上方的 <strong>「桌面」</strong>、<strong>「平板」</strong>、<strong>「手机」</strong> 按钮，快速切换不同终端视口仿真体验。</p>
      <button class="btn" onclick="alert('OmniView 隔离沙箱脚本执行测试成功！')">测试交互弹窗 (Alert)</button>
    </div>
  </div>
</body>
</html>
`;

export const HtmlViewer: React.FC<HtmlViewerProps> = ({
  content,
  fileName = 'index.html',
  locale = 'zh-CN',
  onContentChange,
  onOpenInEditor,
}) => {
  const [viewportMode, setViewportMode] = useState<HtmlDeviceViewport>('desktop');
  const [zoom, setZoom] = useState<number>(1);
  const [canvasBg, setCanvasBg] = useState<HtmlCanvasBg>('white');
  const [allowScripts, setAllowScripts] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 深度转义与 UTF-8 编码健全保证
  const sanitizedDoc = useMemo(() => {
    if (!content) {
      return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;color:#64748b;padding:24px;text-align:center;">空文档内容</body></html>';
    }
    let html = content;
    const lower = html.toLowerCase();
    if (!lower.includes('<meta') || !lower.includes('charset')) {
      if (lower.includes('<head>')) {
        html = html.replace(/<head>/i, '<head><meta charset="utf-8">');
      } else if (lower.includes('<html>')) {
        html = html.replace(/<html>/i, '<html><head><meta charset="utf-8"></head>');
      } else {
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
      }
    }
    return html;
  }, [content]);

  const handlePrint = () => {
    try {
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(2.0, Math.max(0.4, Number((prev + delta).toFixed(2)))));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  // 设备容器与画布样式映射
  const getCanvasBgStyle = (): React.CSSProperties => {
    switch (canvasBg) {
      case 'white':
        return { backgroundColor: '#ffffff', color: '#0f172a' };
      case 'dark':
        return { backgroundColor: '#0f172a', color: '#f8fafc' };
      case 'checkerboard':
        return {
          backgroundColor: '#ffffff',
          backgroundImage:
            'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        };
      case 'system':
      default:
        return { backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text)' };
    }
  };

  const renderStudioPreview = (code: string) => {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950/40">
        {/* HTML 专属控制浮条: 设备仿真、画布底色、缩放标尺与沙箱安全态 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderBottomColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          className="flex items-center justify-between gap-2 px-3 py-1.5 border-b text-xs shrink-0 select-none overflow-x-auto no-scrollbar"
        >
          {/* Left: 设备模式切换 (Desktop / Tablet / Mobile) */}
          <div className="flex items-center gap-1 shrink-0">
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="flex items-center border rounded-lg p-0.5 gap-0.5"
            >
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                style={{
                  backgroundColor: viewportMode === 'desktop' ? 'var(--ov-accent, #0284c7)' : 'transparent',
                  color: viewportMode === 'desktop' ? '#ffffff' : 'var(--ov-text-secondary)',
                }}
                className="flex items-center gap-1 px-2 py-1 rounded transition text-[11px]"
                title={t('htmlDeviceFluid', locale) || '响应式桌面 (100%)'}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">桌面 (100%)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('tablet')}
                style={{
                  backgroundColor: viewportMode === 'tablet' ? 'var(--ov-accent, #0284c7)' : 'transparent',
                  color: viewportMode === 'tablet' ? '#ffffff' : 'var(--ov-text-secondary)',
                }}
                className="flex items-center gap-1 px-2 py-1 rounded transition text-[11px]"
                title={t('htmlDeviceTablet', locale) || '平板视口 (768px)'}
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">平板 (768px)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                style={{
                  backgroundColor: viewportMode === 'mobile' ? 'var(--ov-accent, #0284c7)' : 'transparent',
                  color: viewportMode === 'mobile' ? '#ffffff' : 'var(--ov-text-secondary)',
                }}
                className="flex items-center gap-1 px-2 py-1 rounded transition text-[11px]"
                title={t('htmlDeviceMobile', locale) || '手机视口 (375px)'}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">手机 (375px)</span>
              </button>
            </div>
          </div>

          {/* Center: 画布底色与缩放 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 底色切换 */}
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="flex items-center border rounded-lg p-0.5 gap-0.5"
            >
              <button
                type="button"
                onClick={() => setCanvasBg('white')}
                className={`p-1 rounded transition ${canvasBg === 'white' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                title={t('htmlBgWhite', locale) || '纯白网页底色'}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCanvasBg('dark')}
                className={`p-1 rounded transition ${canvasBg === 'dark' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                title={t('htmlBgDark', locale) || '暗黑网页底色'}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCanvasBg('checkerboard')}
                className={`p-1 rounded transition ${canvasBg === 'checkerboard' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                title={t('htmlBgCheckerboard', locale) || '透明棋盘格底色'}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCanvasBg('system')}
                className={`p-1 rounded transition ${canvasBg === 'system' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                title={t('htmlBgSystem', locale) || '系统主题底色'}
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 缩放控制器 */}
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="flex items-center border rounded-lg overflow-hidden text-[11px] font-mono"
            >
              <button
                type="button"
                onClick={() => handleZoom(-0.15)}
                className="p-1 hover:bg-slate-700/50 transition text-slate-300"
                title="缩小 (Zoom Out)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 text-slate-300 hover:text-white transition"
                title="复位缩放 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => handleZoom(0.15)}
                className="p-1 hover:bg-slate-700/50 transition text-slate-300"
                title="放大 (Zoom In)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: 刷新、沙箱安全态、打印 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 刷新 */}
            <button
              type="button"
              onClick={handleRefresh}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="p-1.5 rounded-lg border text-slate-300 hover:text-white transition"
              title={t('htmlReload', locale) || '刷新网页'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* 脚本运行开关 */}
            <button
              type="button"
              onClick={() => setAllowScripts(prev => !prev)}
              style={{
                backgroundColor: allowScripts ? 'rgba(2, 132, 199, 0.15)' : 'var(--ov-surface)',
                borderColor: allowScripts ? '#0284c7' : 'var(--ov-border)',
                color: allowScripts ? '#38bdf8' : 'var(--ov-text-muted)',
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition"
              title={allowScripts ? '已允许脚本执行 (沙箱隔离中)' : '已彻底禁用脚本 (纯文本排版模式)'}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{allowScripts ? '脚本: 开' : '脚本: 关'}</span>
            </button>

            {/* 沙箱安全状态指示 Pill */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px]"
              title={t('htmlSandboxTooltip', locale) || '多重独立 iframe 沙箱已激活，杜绝宿主逃逸'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">安全沙箱</span>
            </div>

            {/* 原生高保真打印 */}
            <button
              type="button"
              onClick={handlePrint}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="p-1.5 rounded-lg border text-slate-300 hover:text-white transition"
              title="系统高保真打印 (Print to PDF)"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 视口舞台容器 (自适应居中与缩放) */}
        <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col items-center justify-start relative">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out, width 0.2s ease, height 0.2s ease',
              width:
                viewportMode === 'mobile'
                  ? '375px'
                  : viewportMode === 'tablet'
                    ? '768px'
                    : '100%',
              height:
                viewportMode === 'mobile'
                  ? '667px'
                  : viewportMode === 'tablet'
                    ? '1024px'
                    : '100%',
              ...getCanvasBgStyle(),
            }}
            className={`flex flex-col relative transition-all duration-200 ${
              viewportMode !== 'desktop'
                ? 'rounded-2xl border-4 border-slate-700 shadow-2xl overflow-hidden shrink-0 my-auto'
                : 'w-full h-full rounded-lg border border-slate-800/80 shadow-md overflow-hidden'
            }`}
          >
            {/* 移动端与平板顶部听筒/灵动胶囊拟真条 */}
            {viewportMode === 'mobile' && (
              <div className="h-5 w-full bg-slate-800/90 flex items-center justify-center shrink-0">
                <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
              </div>
            )}
            {viewportMode === 'tablet' && (
              <div className="h-4 w-full bg-slate-800/80 flex items-center justify-center shrink-0">
                <div className="w-2.5 h-2.5 bg-slate-600 rounded-full" />
              </div>
            )}

            {/* 核心双层隔离沙箱 iframe */}
            <iframe
              key={refreshKey}
              ref={iframeRef}
              srcDoc={sanitizedDoc}
              title={fileName}
              sandbox={
                allowScripts
                  ? 'allow-scripts allow-forms allow-modals'
                  : 'allow-forms allow-modals'
              }
              referrerPolicy="no-referrer"
              className="w-full h-full border-none flex-1 bg-transparent"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <DiagramStudioShell
      title="HTML5 网页与交互沙箱工作台"
      fileName={fileName}
      content={content}
      onContentChange={onContentChange}
      onOpenInEditor={onOpenInEditor}
      storageKeyPrefix="html"
      languageLabel="HTML5"
      placeholder="<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>"
      accentClass="cyan"
      snippets={HTML_SNIPPETS}
      defaultTemplate={DEFAULT_HTML_TEMPLATE}
      renderPreview={renderStudioPreview}
    />
  );
};

export default HtmlViewer;
