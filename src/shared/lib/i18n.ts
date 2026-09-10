/**
 * OmniView 国际化多语言支持系统 (i18n)
 * 支持中英文双语切换、浏览器/VS Code 语言自适应与本地持久化
 */

export type Locale = 'zh-CN' | 'en-US';

export const LOCALE_STORAGE_KEY = 'omniview:workbench:locale:v1';

export const TRANSLATIONS = {
  'zh-CN': {
    // Toolbar buttons & tooltips
    outline: '大纲',
    outlineTooltip: '显示/隐藏侧边目录大纲',
    searchPlaceholder: '搜索文档 (Enter / Shift+Enter)',
    prevMatch: '上一个匹配项',
    nextMatch: '下一个匹配项',
    sectionsCount: '节',
    currentReading: '正文浏览',
    theme: '主题',
    themeTooltip: '切换阅读主题',
    fontSize: '字号',
    fontSizeTooltip: '调整正文字号',
    density: '排版',
    densityTooltip: '切换排版紧凑度与间距',
    width: '宽度',
    widthNarrow: '专注窄版 (720px)',
    widthStandard: '黄金标准 (880px)',
    widthWide: '全景宽屏 (1180px)',
    widthFull: '自适应铺满 (Fluid)',
    widthTooltip: '切换正文内容版宽 (720px / 880px / 1180px / 自适应)',
    focusMode: '专注模式',
    focusModeOn: '专注',
    focusModeOff: '退出专注',
    focusModeTooltip: '专注模式 (纯净居中，隐藏目录大纲)',
    autoScroll: '自动滚屏',
    autoScrollRunning: '自动滚屏中',
    autoScrollTooltip: '开启/暂停平滑自动滚屏 (点击循环切换 1x / 2x / 停止)',
    zoomIn: '放大页面',
    zoomOut: '缩小页面',
    zoomReset: '还原 100%',
    copyMarkdown: '复制 Markdown 源码',
    copied: '已复制',
    exportPdf: '导出 PDF / 打印',
    moreActions: '更多操作',
    backToTop: '回到顶部',
    language: '界面语言',
    languageTooltip: '切换多语言 (Language)',

    // Dropdown / menu items
    copyCurrentSection: '复制当前章节内容',
    copyRichText: '复制为富文本 (HTML)',
    exportHtml: '导出为单文件 HTML',
    exportWord: '导出为 Word 文档 (.doc)',
    exportWordHint: '正在准备 Word 文档与高清图表...',
    exportWordSuccess: 'Word 文档导出成功',
    openInEditor: '在 VS Code 中打开源码',
    openSource: '打开源码',
    autoRefresh: '预览已实时同步',
    reloadPreview: '重新加载预览',
    characters: '字符',
    words: '词',
    chapters: '章节',

    // Outline
    outlineHeading: '文档大纲',
    filterH2: '仅显示 H1-H2 标题',
    filterH3: '显示 H1-H3 标题',
    filterAll: '显示全部 H1-H6 标题',
    noHeadings: '没有匹配的章节标题',
    outlinePosition: '大纲显示位置',
    outlinePosLeft: '靠左固定',
    outlinePosRight: '靠右固定',
    outlinePosFloating: '浮动面板',
    outlinePosLeftTooltip: '大纲停靠在正文左侧',
    outlinePosRightTooltip: '大纲停靠在正文右侧',
    outlinePosFloatingTooltip: '大纲以浮动面板悬浮显示',
    outlineResizeTooltip: '拖动调整大纲宽度，双击恢复默认宽度 (260px)',
    scrollSync: '双向滚动同步',
    scrollSyncTooltip: '开启/关闭 Markdown 源码与预览双向滚动同步 (双击段落反向定位光标)',
    doubleClickToLocate: '双击段落反向定位到源码对应行',

    // Diagrams & code
    linesCode: '行代码',
    collapsed: '已折叠',
    collapseCode: '折叠代码块',
    expandCode: '展开代码块',
    copyCode: '复制代码到剪贴板',
    mermaidTitle: 'Mermaid.js 动态图表',
    plantUmlTitle: 'PlantUML 架构矢量图',
    svgCodeBlock: 'SVG 矢量图驱动 (代码块)',
    svgLocalFile: '本地 SVG 矢量文件',
    preview: '预览',
    code: '源码',
    previewTooltip: '切换可视化矢量预览',
    codeTooltip: '切换查看与编辑源码',
    applyAndRender: '应用并渲染',
    applyUpdate: '应用更新',
    downloadSvg: '下载 SVG 矢量文件',
    fullScreen: '全屏/灯箱放大查看',
    closeFullScreen: '关闭全屏 (Esc)',
    highResImage: '高清原图',
    bgDark: '深色背景',
    bgGrid: '网格标尺背景',
    bgLight: '浅色背景',
    editDiagramSource: '编辑源码 (修改后点击右上角应用渲染)',
    renderingDiagram: '正在编译渲染矢量图...',
    enableOkf: '开启 OKF 概念卡片渲染',
    disableOkf: '关闭 OKF 概念卡片渲染',
    okfRenderingTitle: 'Google OKF 概念卡片渲染',
    okfRenderingDesc: '自动解析 Markdown Frontmatter 结构化元数据、Tags 标签栏与知识图谱关系',

    // Loading / status
    loadingDocument: '正在加载文档…',
    readingTime: '预计阅读时间',
    minutes: '分钟',
    wordsCount: '词/字',
    searchMatches: '{cur} / {total} 匹配',
    noMatches: '无匹配',
    zoomLabel: '缩放',

    // CodeViewer
    linesCodeCount: '行代码',
    editSource: '编辑源码',
    saveChanges: '保存修改',
    saved: '已保存',
    unsavedChanges: '未保存',
    viewReadonly: '只读高亮',
    realtimeSync: '实时同步渲染',
    saveShortcutTooltip: '保存修改 (Ctrl+S / ⌘S)',
    copyCode2: '复制代码',
    undo: '撤回',
    redo: '重做',
    undoTooltip: '撤销上一步编辑 (Ctrl+Z / ⌘Z)',
    redoTooltip: '重做下一步编辑 (Ctrl+Y / ⌘⇧Z)',

    // CsvViewer
    csvGrid: '智能数据网格 (CSV)',
    csvTotalRows: '共 {n} 行',
    csvMatched: '匹配 {n}',
    csvSearch: '全局搜索数据…',
    csvNoData: '无符合条件的数据',
    csvExport: '导出 CSV',

    // Markdown Table Enhancements
    tableColsRows: '{cols} 列 × {rows} 行',
    tableSearchPlaceholder: '搜索表格内容...',
    tableSearchMatches: '匹配 {cur} / {total} 行',
    tableSortAsc: '点击降序排列',
    tableSortDesc: '恢复默认排序',
    tableSortNone: '点击升序排列',
    tableCopyMarkdown: '复制 Markdown 表格',
    tableCopyCsv: '复制 CSV',
    tableExportCsv: '导出 CSV 文件',
    tableDensityCompact: '紧凑间距',
    tableDensityStandard: '标准间距',
    tableShowRowNumbers: '显示行号',
    tableHideRowNumbers: '隐藏行号',
    tableViewModeTable: '表格视图',
    tableViewModeChart: '图表视图',
    tableChartXAxis: 'X 轴维度',
    tableChartYAxis: 'Y 轴数值',
    tableChartBar: '柱状图',
    tableChartLine: '折线图',
    tableFullscreen: '全屏放大表格',
    tablePin: '固定常驻工具栏',
    tableUnpin: '自动隐藏模式 (鼠标移入显示)',

    // PlantUML viewer status
    linesUtf8: '行 · UTF-8',

    // Stability & Error Boundary & Diagnostics
    errorBoundaryTitle: '组件渲染发生异常',
    errorBoundaryDesc: '该区块渲染遇到问题，文档其他内容已受保护并正常可用。',
    errorRetry: '重试渲染',
    errorCopyDetails: '复制错误报告',
    errorCopied: '已复制错误报告',
    errorStack: '详细错误调用栈',
    imageNotFound: '本地图片资源未找到',
    imageNotFoundHint: '请检查相对路径拼写或文件是否存在于工作区',
    mermaidSyntaxError: 'Mermaid 图表语法错误',
    mermaidFixHint: '点击右上角“源码”模式可直接在线编辑修正',
    documentReloaded: '文档已自动更新',
    diagramRenderFailed: '图表渲染失败',
    lineRange: '第 {start}-{end} 行',
    errorLine: '第 {line} 行',
    errorReason: '原因',
    possibleCauses: '可能原因',
    fixSuggestions: '修复建议',
    applyQuickFix: '一键应用修复',
    openSourceAtLine: '打开源码第 {line} 行',
    viewSource: '查看源码',
    reRender: '重新渲染',
    copyErrorReport: '复制错误报告',
    previewRestored: '预览已恢复，请将修复代码贴回源码保存',
    copyFixedCode: '复制修复后代码',

    // Lightbox & Math
    rotate: '顺时针旋转 90°',
    resetZoom: '重置缩放 (1:1)',
    copyImage: '复制内容',
    downloadImage: '下载图片',
    mathFormula: 'KaTeX 数学公式',
    editMathSource: '编辑 LaTeX 公式源码 (实时编译)',
    copyMathCode: '复制 LaTeX 源码',
    mathRenderFailed: '数学公式解析失败',
    checkMathSyntax: '请检查 LaTeX / KaTeX 公式语法',

    // Graphviz
    graphvizTitle: 'Graphviz 结构图',
    graphvizCodeBlock: 'Graphviz / DOT 矢量图',
    graphvizRenderFailed: 'Graphviz 渲染失败',
    checkDotSyntax: '请检查 DOT 语法或布局引擎配置',
    copyDotCode: '复制 DOT 源码',
    renderingGraphviz: '正在编译渲染 Graphviz 图表...',
    layoutEngine: '布局引擎',
    engineDot: 'DOT (分层有向图)',
    engineNeato: 'Neato (弹簧模型)',
    engineFdp: 'FDP (力导向图)',
    engineCirco: 'Circo (环形布局)',
    engineTwopi: 'Twopi (放射状布局)',

    // Markmap & View Modes
    viewModePreview: '预览',
    viewModeSplit: '分屏',
    viewModeSource: '源码',
    viewModeMindmap: '思维导图',
    viewModePreviewTooltip: '预览模式：查看富文本与即时渲染图表',
    viewModeSplitTooltip: '分屏模式：左侧源码编辑，右侧同步渲染',
    viewModeSourceTooltip: '源码模式：查看与编辑原始 Markdown 文件',
    viewModeMindmapTooltip: '思维导图模式：整篇文档大纲全景树图与动态交互 (Markmap)',
    mindmap: '思维导图',
    mindmapTooltip: '切换思维导图全景视图 (Markmap)',
    mindmapPanorama: '全景思维导图',
    mindmapFit: '适应画布',
    mindmapExpandAll: '展开全部',
    mindmapCollapseAll: '收起次级',
    mindmapExportSvg: '导出 SVG',
    mindmapExportPng: '导出 PNG',
    mindmapSearch: '搜索导图节点...',
    mindmapNodes: '节点',
    mindmapDepth: '层深度',
    mindmapNoMatches: '未找到匹配节点',
    switchToDocView: '返回文档模式',
  },
  'en-US': {
    // Toolbar buttons & tooltips
    outline: 'Outline',
    outlineTooltip: 'Toggle outline sidebar',
    searchPlaceholder: 'Search document (Enter / Shift+Enter)',
    prevMatch: 'Previous match',
    nextMatch: 'Next match',
    sectionsCount: 'sections',
    currentReading: 'Reading',
    theme: 'Theme',
    themeTooltip: 'Switch reading theme',
    fontSize: 'Font Size',
    fontSizeTooltip: 'Adjust font size',
    density: 'Density',
    densityTooltip: 'Adjust layout density & spacing',
    width: 'Width',
    widthNarrow: 'Focus (720px)',
    widthStandard: 'Standard (880px)',
    widthWide: 'Wide (1180px)',
    widthFull: 'Fluid (Max)',
    widthTooltip: 'Cycle content width (720px / 880px / 1180px / Fluid)',
    focusMode: 'Focus',
    focusModeOn: 'Focus',
    focusModeOff: 'Exit Focus',
    focusModeTooltip: 'Focus mode (distraction-free, hides outline)',
    autoScroll: 'Auto Scroll',
    autoScrollRunning: 'Auto scrolling',
    autoScrollTooltip: 'Toggle auto scroll (cycle 1x / 2x / Off)',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Reset 100%',
    copyMarkdown: 'Copy Markdown',
    copied: 'Copied',
    exportPdf: 'Export PDF / Print',
    moreActions: 'More actions',
    backToTop: 'Back to top',
    language: 'Language',
    languageTooltip: 'Switch language',

    // Dropdown / menu items
    copyCurrentSection: 'Copy current section',
    copyRichText: 'Copy as rich text (HTML)',
    exportHtml: 'Export as single-file HTML',
    exportWord: 'Export as Word Document (.doc)',
    exportWordHint: 'Preparing Word document and high-res diagrams...',
    exportWordSuccess: 'Word document exported successfully',
    openInEditor: 'Open in VS Code editor',
    openSource: 'Open Source',
    autoRefresh: 'Preview auto-synced',
    reloadPreview: 'Reload preview',
    characters: 'chars',
    words: 'words',
    chapters: 'sections',

    // Outline
    outlineHeading: 'Document Outline',
    filterH2: 'Show H1-H2 only',
    filterH3: 'Show H1-H3',
    filterAll: 'Show all H1-H6',
    noHeadings: 'No matching headings found',
    outlinePosition: 'Outline Position',
    outlinePosLeft: 'Dock Left',
    outlinePosRight: 'Dock Right',
    outlinePosFloating: 'Floating Panel',
    outlinePosLeftTooltip: 'Dock outline on the left',
    outlinePosRightTooltip: 'Dock outline on the right',
    outlinePosFloatingTooltip: 'Show outline as a floating panel',
    outlineResizeTooltip: 'Drag to resize outline width, double-click to reset (260px)',
    scrollSync: 'Scroll Sync',
    scrollSyncTooltip: 'Toggle bidirectional scroll sync between editor and preview (double-click paragraph to reveal source)',
    doubleClickToLocate: 'Double-click to reveal line in source editor',

    // Diagrams & code
    linesCode: 'lines of code',
    collapsed: 'collapsed',
    collapseCode: 'Collapse code block',
    expandCode: 'Expand code block',
    copyCode: 'Copy code to clipboard',
    mermaidTitle: 'Mermaid.js Diagram',
    plantUmlTitle: 'PlantUML Architecture Diagram',
    svgCodeBlock: 'SVG Vector Driver (Code Block)',
    svgLocalFile: 'Local SVG File',
    preview: 'Visual',
    code: 'Source',
    previewTooltip: 'Switch to visual rendering preview',
    codeTooltip: 'Switch to view & edit source',
    applyAndRender: 'Apply & Render',
    applyUpdate: 'Apply Update',
    downloadSvg: 'Download SVG file',
    fullScreen: 'Fullscreen / Lightbox zoom',
    closeFullScreen: 'Close Fullscreen (Esc)',
    highResImage: 'HD Vector',
    bgDark: 'Dark Background',
    bgGrid: 'Grid Ruler Background',
    bgLight: 'Light Background',
    editDiagramSource: 'Edit diagram source (click Apply & Render after editing)',
    renderingDiagram: 'Compiling and rendering vector diagram...',
    enableOkf: 'Enable OKF Concept Card',
    disableOkf: 'Disable OKF Concept Card',
    okfRenderingTitle: 'Google OKF Concept Rendering',
    okfRenderingDesc: 'Automatically parse Markdown Frontmatter metadata, tags pills, and concept relations',

    // Loading / status
    loadingDocument: 'Loading document…',
    readingTime: 'Est. reading time',
    minutes: 'min',
    wordsCount: 'words',
    searchMatches: '{cur} / {total} matches',
    noMatches: 'No matches',
    zoomLabel: 'Zoom',

    // CodeViewer
    linesCodeCount: 'lines of code',
    editSource: 'Edit source',
    saveChanges: 'Save changes',
    saved: 'Saved',
    unsavedChanges: 'Unsaved',
    viewReadonly: 'View mode',
    realtimeSync: 'Real-time sync',
    saveShortcutTooltip: 'Save changes (Ctrl+S / ⌘S)',
    copyCode2: 'Copy code',
    undo: 'Undo',
    redo: 'Redo',
    undoTooltip: 'Undo modification (Ctrl+Z / ⌘Z)',
    redoTooltip: 'Redo modification (Ctrl+Y / ⌘⇧Z)',

    // CsvViewer
    csvGrid: 'Smart Data Grid (CSV)',
    csvTotalRows: '{n} rows total',
    csvMatched: '{n} matched',
    csvSearch: 'Search data…',
    csvNoData: 'No matching data',
    csvExport: 'Export CSV',

    // Markdown Table Enhancements
    tableColsRows: '{cols} cols × {rows} rows',
    tableSearchPlaceholder: 'Search table content...',
    tableSearchMatches: '{cur} of {total} rows matched',
    tableSortAsc: 'Click to sort descending',
    tableSortDesc: 'Click to reset sorting',
    tableSortNone: 'Click to sort ascending',
    tableCopyMarkdown: 'Copy Markdown table',
    tableCopyCsv: 'Copy CSV',
    tableExportCsv: 'Export CSV file',
    tableDensityCompact: 'Compact spacing',
    tableDensityStandard: 'Standard spacing',
    tableShowRowNumbers: 'Show row numbers',
    tableHideRowNumbers: 'Hide row numbers',
    tableViewModeTable: 'Table view',
    tableViewModeChart: 'Chart view',
    tableChartXAxis: 'X-Axis Dimension',
    tableChartYAxis: 'Y-Axis Value',
    tableChartBar: 'Bar Chart',
    tableChartLine: 'Line Chart',
    tableFullscreen: 'Fullscreen Table',
    tablePin: 'Pin toolbar',
    tableUnpin: 'Auto-hide toolbar on hover',

    // PlantUML viewer status
    linesUtf8: 'lines · UTF-8',

    // Stability & Error Boundary & Diagnostics
    errorBoundaryTitle: 'Component Render Error',
    errorBoundaryDesc: 'An error occurred while rendering this section. The rest of the document remains safe and functional.',
    errorRetry: 'Retry Render',
    errorCopyDetails: 'Copy Error Report',
    errorCopied: 'Error Report Copied',
    errorStack: 'Detailed Error Stack',
    imageNotFound: 'Local Image Asset Not Found',
    imageNotFoundHint: 'Please check the relative path or make sure the file exists in the workspace',
    mermaidSyntaxError: 'Mermaid Diagram Syntax Error',
    mermaidFixHint: 'Click "Source" in the top right to edit and fix the diagram',
    documentReloaded: 'Document updated automatically',
    diagramRenderFailed: 'Diagram Render Failed',
    lineRange: 'Lines {start}-{end}',
    errorLine: 'Line {line}',
    errorReason: 'Reason',
    possibleCauses: 'Possible Causes',
    fixSuggestions: 'Fix Suggestions',
    applyQuickFix: 'Apply Quick Fix',
    openSourceAtLine: 'Open Source at Line {line}',
    viewSource: 'View Source',
    reRender: 'Re-render',
    copyErrorReport: 'Copy Error Report',
    previewRestored: 'Preview restored. Remember to save changes to source file.',
    copyFixedCode: 'Copy Fixed Code',

    // Lightbox & Math
    rotate: 'Rotate Clockwise 90°',
    resetZoom: 'Reset Zoom (1:1)',
    copyImage: 'Copy Content',
    downloadImage: 'Download Image',
    mathFormula: 'KaTeX Math Formula',
    editMathSource: 'Edit LaTeX source (live compile)',
    copyMathCode: 'Copy LaTeX Source',
    mathRenderFailed: 'Math Formula Render Failed',
    checkMathSyntax: 'Please check LaTeX / KaTeX formula syntax',

    // Graphviz
    graphvizTitle: 'Graphviz Diagram',
    graphvizCodeBlock: 'Graphviz / DOT Vector Diagram',
    graphvizRenderFailed: 'Graphviz Render Failed',
    checkDotSyntax: 'Please check DOT syntax or layout engine configuration',
    copyDotCode: 'Copy DOT Source',
    renderingGraphviz: 'Compiling and rendering Graphviz diagram...',
    layoutEngine: 'Layout Engine',
    engineDot: 'DOT (Hierarchical Directed)',
    engineNeato: 'Neato (Spring Model)',
    engineFdp: 'FDP (Force-Directed)',
    engineCirco: 'Circo (Circular)',
    engineTwopi: 'Twopi (Radial)',

    // Markmap & View Modes
    viewModePreview: 'Preview',
    viewModeSplit: 'Split',
    viewModeSource: 'Source',
    viewModeMindmap: 'Mindmap',
    viewModePreviewTooltip: 'Preview mode: Rich text & live diagram rendering',
    viewModeSplitTooltip: 'Split mode: Source code on left, live render on right',
    viewModeSourceTooltip: 'Source mode: View & edit raw Markdown content',
    viewModeMindmapTooltip: 'Mindmap mode: Interactive full-document mindmap tree (Markmap)',
    mindmap: 'Mindmap',
    mindmapTooltip: 'Toggle Mindmap Panorama View (Markmap)',
    mindmapPanorama: 'Mindmap Panorama',
    mindmapFit: 'Fit Viewport',
    mindmapExpandAll: 'Expand All',
    mindmapCollapseAll: 'Collapse All',
    mindmapExportSvg: 'Export SVG',
    mindmapExportPng: 'Export PNG',
    mindmapSearch: 'Search mindmap nodes...',
    mindmapNodes: 'nodes',
    mindmapDepth: 'levels',
    mindmapNoMatches: 'No matching nodes',
    switchToDocView: 'Back to Document',
  },
};

export type TranslationKey = keyof typeof TRANSLATIONS['zh-CN'];

/**
 * 获取当前持久化的语言设置（默认检测环境语言）
 */
export function getStoredLocale(): Locale {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'zh-CN';
  }
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    if (saved === 'zh-CN' || saved === 'en-US') {
      return saved;
    }
    const navLang = navigator.language || '';
    if (navLang.toLowerCase().startsWith('zh')) {
      return 'zh-CN';
    }
    return 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

/**
 * 保存语言偏好
 */
export function saveStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (err) {
    console.warn('Failed to save locale preference', err);
  }
}

/**
 * 翻译助手 (支持 string 或 undefined，若传非有效 Locale 兜底到 zh-CN)
 */
export function t(key: TranslationKey, locale?: string): string {
  const effectiveLocale: Locale = (locale === 'en-US') ? 'en-US' : 'zh-CN';
  const dict = TRANSLATIONS[effectiveLocale] || TRANSLATIONS['zh-CN'];
  return dict[key] || TRANSLATIONS['zh-CN'][key] || key;
}
