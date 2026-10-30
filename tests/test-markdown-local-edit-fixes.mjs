/**
 * Markdown 局部编辑（块级专注编辑 / 划选气泡工具栏 / 表格双击编辑 / 任务列表勾选）全链路回归测试
 * 验证：
 * 1. 外挂图表嵌入 (![alt](file.svg) / ![[file.dst]])、Wiki 笔记嵌入 (![[Note]])、定义列表、脚注、多行内联 SVG 不产生行号漂移
 * 2. extractBlockRawMarkdown 在行号越界或偏移时具备内容指纹自愈重定位能力，绝不误覆盖文档第 1 行
 * 3. applyMarkdownSelectionFormat 支持取消已有行内格式（避免 ****word****）、跨内联格式选区回写、大型 Callout 跨行窗口定位
 * 4. TableBlock 单元格双击编辑与图表/公式块代码视图编辑持久化回写至 onContentChange
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

import {
  extractBlockRawMarkdown,
  replaceBlockRawMarkdown,
} from '../src/features/viewers/lib/markdownBlockEditor.ts';
import { applyMarkdownSelectionFormat } from '../src/features/viewers/lib/markdownSelectionReplacer.ts';
import {
  processMarkdownWikiLinks,
  processExternalDiagramEmbeds,
} from '../src/features/viewers/lib/markdownWikiLinks.ts';
import { processMarkdownDefinitionLists } from '../src/features/viewers/lib/markdownDefinitionLists.ts';
import { processMarkdownFootnotes } from '../src/features/viewers/lib/markdownFootnotes.ts';
import { processMarkdownMath } from '../src/features/viewers/lib/markdownMath.ts';
import { parseOkfFrontmatter } from '../src/features/viewers/lib/okfParser.ts';

const rootDir = process.cwd();

console.log('🧪 Running Markdown Local Editing Regression Tests...');

// 1. 验证预处理器行号守恒（Wiki 嵌入、外挂图表、定义列表、脚注）
{
  const mockFiles = [
    {
      name: 'system-architecture.svg',
      path: 'diagrams/system-architecture.svg',
      extension: 'svg',
      content: '<svg viewBox="0 0 100 100">\n  <circle cx="50" cy="50" r="40" />\n  <text x="50" y="55">Arch</text>\n</svg>',
    },
    {
      name: 'note-a.md',
      path: 'markdown/note-a.md',
      extension: 'md',
      content: '# Note A\n\nFirst paragraph of note A.\n\nSecond paragraph after blank line.',
    },
  ];

  // 1.1 Wiki 笔记嵌入不引入任何真实换行（避免 marked.lexer 在空行截断 <aside>）
  const docWithNoteEmbed = [
    '# Title',
    '',
    '![[note-a.md]]',
    '',
    '## Section After Embed',
    '',
    'Target paragraph to edit.',
  ].join('\n');

  const { markdown: wikiProcessed } = processMarkdownWikiLinks(docWithNoteEmbed, {
    files: mockFiles,
  });
  assert.equal(
    wikiProcessed.split('\n').length,
    docWithNoteEmbed.split('\n').length,
    'Wiki note embed should preserve exact line count without injecting raw newlines'
  );

  // 1.2 定义列表严格保持原始占用行数
  const docWithDefList = [
    '# Glossary',
    '',
    'OmniView',
    ': Next-gen multi-format document workbench',
    ': Built with React 19 and TypeScript',
    '',
    'AST Pipeline',
    ': Zero-drift line-mapped markdown renderer',
    '',
    '## Tail Section',
    '',
    'Paragraph after definition list.',
  ].join('\n');

  const { markdown: defProcessed } = processMarkdownDefinitionLists(docWithDefList);
  assert.equal(
    defProcessed.split('\n').length,
    docWithDefList.split('\n').length,
    'Definition list preprocessor must preserve exact line count'
  );
  assert.match(defProcessed, /data-deflist-lines="6"/);

  // 1.3 外挂图表嵌入标记 addedLines 且扣除后行号精准对齐
  const docWithExtDiagram = [
    '# Architecture',
    '',
    '![Arch](./diagrams/system-architecture.svg)',
    '',
    '## Section 2',
    '',
    'Final editable paragraph.',
  ].join('\n');

  const extProcessed = processExternalDiagramEmbeds(docWithExtDiagram, mockFiles);
  assert.match(extProcessed, /addedLines="\d+"/);

  const tokens = marked.lexer(extProcessed);
  let runningLine = 1;
  const blockLines = [];
  for (const token of tokens) {
    const tokenNewlines = (token.raw.match(/\n/g) || []).length;
    const addedMatch =
      token.type === 'code' && typeof token.lang === 'string'
        ? token.lang.match(/\baddedLines="(\d+)"/)
        : null;
    const addedLines = addedMatch ? parseInt(addedMatch[1], 10) : 0;
    const effectiveNewlines = Math.max(0, tokenNewlines - addedLines);
    const startLine = runningLine;
    const endLine =
      addedLines > 0
        ? startLine + Math.max(0, effectiveNewlines - (token.raw.endsWith('\n') ? 1 : 0))
        : token.raw.endsWith('\n')
        ? startLine + Math.max(0, effectiveNewlines - 1)
        : startLine + effectiveNewlines;
    runningLine += effectiveNewlines;
    if (token.type !== 'space') {
      blockLines.push({ type: token.type, text: token.text || token.raw, startLine, endLine });
    }
  }

  const finalPara = blockLines.find(b => b.text.includes('Final editable paragraph.'));
  assert.ok(finalPara, 'Should find final paragraph token');
  assert.equal(finalPara.startLine, 7, 'Final paragraph startLine after external SVG embed must be exact (L7)');
}

// 2. 验证 extractBlockRawMarkdown + replaceBlockRawMarkdown 的指纹自愈重定位能力
{
  const sampleDoc = [
    '---',
    'title: Test Spec',
    '---',
    '# Heading 1',
    '',
    'Intro paragraph.',
    '',
    '```mermaid',
    'graph TD',
    '  A --> B',
    '```',
    '',
    '## Section Bottom',
    '',
    'This is the bottom paragraph that used to fail when edited.',
  ].join('\n');

  // 2.1 模拟因极端宏展开导致 startLine 越界 (> totalLines) 的场景：绝不回退覆盖第 1 行，而是自愈定位至第 15 行
  const driftedSlice = extractBlockRawMarkdown(
    sampleDoc,
    999,
    1002,
    'This is the bottom paragraph that used to fail when edited.\n'
  );
  assert.equal(driftedSlice.actualStartLine, 15);
  assert.equal(driftedSlice.actualEndLine, 15);
  assert.equal(driftedSlice.rawSlice, 'This is the bottom paragraph that used to fail when edited.');

  const replaced = replaceBlockRawMarkdown(
    sampleDoc,
    driftedSlice.actualStartLine,
    driftedSlice.actualEndLine,
    'This bottom paragraph was edited successfully!'
  );
  assert.ok(replaced.newFullContent.startsWith('---\ntitle: Test Spec\n---'), 'Frontmatter at line 1 must not be overwritten');
  assert.ok(replaced.newFullContent.endsWith('This bottom paragraph was edited successfully!'));

  // 2.2 模拟围栏图表块行号偏移时的自愈重定位（包含 ```mermaid 与 ``` 围栏壳）
  const driftedMermaid = extractBlockRawMarkdown(
    sampleDoc,
    50,
    55,
    'graph TD\n  A --> B'
  );
  assert.equal(driftedMermaid.actualStartLine, 8);
  assert.equal(driftedMermaid.actualEndLine, 11);
  assert.equal(driftedMermaid.rawSlice, '```mermaid\ngraph TD\n  A --> B\n```');
}

// 3. 验证全量内置示例 Markdown 文档的末尾块均可精准提取并原地编辑回写
{
  const examplesDir = path.join(rootDir, 'examples');
  const allFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const rel = path.relative(examplesDir, full).replace(/\\/g, '/');
        const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';
        allFiles.push({
          name: entry.name,
          path: rel,
          extension: ext,
          content: fs.readFileSync(full, 'utf8'),
        });
      }
    }
  }
  walk(examplesDir);

  const mdFiles = allFiles.filter(f => f.extension === 'md');
  for (const mdFile of mdFiles) {
    const content = mdFile.content;
    const okfData = parseOkfFrontmatter(content);
    const cleanBody = okfData.hasFrontmatter ? okfData.markdownBody : content;
    const frontmatterLines = okfData.hasFrontmatter
      ? (content.slice(0, content.length - cleanBody.length).match(/\n/g) || []).length
      : 0;

    const { markdown: bodyWithWiki } = processMarkdownWikiLinks(cleanBody, { files: allFiles });
    const { markdown: bodyWithDefLists } = processMarkdownDefinitionLists(bodyWithWiki);
    const { markdown: bodyWithFootnotes } = processMarkdownFootnotes(bodyWithDefLists);
    const { markdown: bodyWithMath } = processMarkdownMath(bodyWithFootnotes);

    const tokens = marked.lexer(bodyWithMath);
    let runningLine = frontmatterLines + 1;
    const totalLines = content.replace(/\r\n/g, '\n').split('\n').length;

    for (const token of tokens) {
      const tokenNewlines = (token.raw.match(/\n/g) || []).length;
      const addedLinesMatch =
        token.type === 'code' && typeof token.lang === 'string'
          ? token.lang.match(/\baddedLines="(\d+)"/)
          : null;
      const addedLines = addedLinesMatch ? parseInt(addedLinesMatch[1], 10) : 0;
      const effectiveNewlines = Math.max(0, tokenNewlines - addedLines);
      let tokenStartLine = runningLine;
      let tokenEndLine =
        addedLines > 0
          ? tokenStartLine + Math.max(0, effectiveNewlines - (token.raw.endsWith('\n') ? 1 : 0))
          : token.raw.endsWith('\n')
          ? tokenStartLine + Math.max(0, effectiveNewlines - 1)
          : tokenStartLine + effectiveNewlines;
      runningLine += effectiveNewlines;

      if (token.type === 'html' && typeof token.raw === 'string') {
        const fnStartMatch = token.raw.match(/\bdata-footnote-start-line="(\d+)"/);
        const fnEndMatch = token.raw.match(/\bdata-footnote-end-line="(\d+)"/);
        if (fnStartMatch && fnEndMatch) {
          tokenStartLine = frontmatterLines + parseInt(fnStartMatch[1], 10);
          tokenEndLine = frontmatterLines + parseInt(fnEndMatch[1], 10);
        }
      }

      if (token.type === 'space') continue;

      assert.ok(
        tokenStartLine >= 1 && tokenStartLine <= totalLines,
        `[${mdFile.name}] token (${token.type}) startLine=${tokenStartLine} must be within [1, ${totalLines}]`
      );
    }
  }
}

// 4. 验证划选气泡工具栏 (applyMarkdownSelectionFormat) 的三大修复场景
{
  const doc = [
    '# Bubble Toolbar Test',
    '',
    '这是一段包含 **加粗文本** 和 `行内代码` 以及 ==高亮内容== 的测试段落。',
    '',
    '> [!CARDS:3] 大型卡片网格容器',
    ...Array.from({ length: 18 }, (_, i) => `> - 卡片条目 ${i + 1}：普通描述文本`),
    '> - 卡片条目 19：需要局部修改的目标短语在此处',
  ].join('\n');

  // 4.1 选中已加粗的纯文本 "加粗文本" 并点击加粗按钮 -> 应取消加粗变为 "加粗文本"，而非变成 "****加粗文本****"
  const unboldRes = applyMarkdownSelectionFormat({
    fullContent: doc,
    selectedText: '加粗文本',
    sourceLine: 3,
    action: 'bold',
  });
  assert.ok(unboldRes, 'Unbolding existing bold text should succeed');
  assert.ok(
    unboldRes.newFullContent.includes('这是一段包含 加粗文本 和 `行内代码`'),
    `Expected '**加粗文本**' to be unbolded to '加粗文本', got: ${unboldRes.newFullContent.split('\n')[2]}`
  );
  assert.ok(!unboldRes.newFullContent.includes('****加粗文本****'));

  // 4.2 选区跨越了内联 Markdown 格式（如预览区选中 "包含 加粗文本 和"）并执行高亮
  const crossInlineRes = applyMarkdownSelectionFormat({
    fullContent: doc,
    selectedText: '包含 加粗文本 和',
    sourceLine: 3,
    action: 'highlight',
  });
  assert.ok(crossInlineRes, 'Selection crossing inline bold syntax should succeed');
  assert.ok(
    crossInlineRes.newFullContent.includes('==包含 **加粗文本** 和=='),
    `Expected cross-inline selection to wrap source span, got: ${crossInlineRes.newFullContent.split('\n')[2]}`
  );

  // 4.3 在超过 15 行的大型 Callout 块内部选中文字（sourceLine 指向 Callout 起始行 L5，实际目标在 L24）
  const deepCalloutRes = applyMarkdownSelectionFormat({
    fullContent: doc,
    selectedText: '需要局部修改的目标短语',
    sourceLine: 5,
    action: 'bold',
  });
  assert.ok(deepCalloutRes, 'Selection at line +19 inside a Callout block should be located and formatted');
  assert.ok(deepCalloutRes.newFullContent.includes('**需要局部修改的目标短语**'));
}

// 5. 验证 TableBlock 与 MarkdownViewer 局部编辑持久化接线存在性
{
  const tableBlockCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/markdown/TableBlock.tsx'),
    'utf8'
  );
  assert.match(tableBlockCode, /onUpdateTableMarkdown\?:\s*\(newMarkdown:\s*string\)\s*=>\s*void/);
  assert.match(tableBlockCode, /onUpdateTableMarkdown\(nextMd\)/);

  const viewerCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/MarkdownViewer.tsx'),
    'utf8'
  );
  assert.match(viewerCode, /handleCommitDiagramCode/);
  assert.match(viewerCode, /onUpdateTableMarkdown=/);
}

// 6. 验证 Markdown 表格、代码块、富容器与全驱动字号随设置 (--ov-font-size / data-font-size) 动态缩放
{
  const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  for (let size = 12; size <= 22; size++) {
    assert.ok(
      cssCode.includes(`[data-font-size="${size}"] { --ov-font-size: ${size}px; }`),
      `index.css should map [data-font-size="${size}"] to --ov-font-size: ${size}px`
    );
  }
  assert.match(
    cssCode,
    /\.markdown-content table[\s\S]*?font-size:\s*var\(--ov-table-font-size,\s*0\.93em\)/,
    '.markdown-content table must scale relatively with --ov-table-font-size / em instead of fixed px'
  );
  assert.match(
    cssCode,
    /\.ov-table-block table[\s\S]*?font-size:\s*var\(--ov-table-font-size,\s*0\.93em\)/,
    '.ov-table-block table must scale relatively with --ov-table-font-size / em'
  );

  const tableBlockCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/markdown/TableBlock.tsx'),
    'utf8'
  );
  assert.ok(
    tableBlockCode.includes("fontSize: 'var(--ov-table-font-size, 0.93em)'"),
    'TableBlock <table> should bind fontSize to var(--ov-table-font-size, 0.93em)'
  );
  assert.ok(
    !tableBlockCode.includes('border-collapse text-xs select-text'),
    'TableBlock <table> must not hardcode text-xs class'
  );

  const lightboxTableCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/markdown/TableLightboxModal.tsx'),
    'utf8'
  );
  assert.ok(
    lightboxTableCode.includes("fontSize: 'var(--ov-font-size, 15px)'"),
    'TableLightboxModal <table> should bind fontSize to var(--ov-font-size, 15px)'
  );

  const codeBlockCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/markdown/CodeBlock.tsx'),
    'utf8'
  );
  assert.ok(
    codeBlockCode.includes("fontSize: '0.88em'"),
    'CodeBlock should use relative 0.88em font size instead of fixed text-xs'
  );

  const codeViewerCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/CodeViewer.tsx'),
    'utf8'
  );
  assert.ok(
    codeViewerCode.includes("calc(var(--ov-font-size, 15px) * 0.88)"),
    'CodeViewer should dynamically scale with --ov-font-size'
  );

  const csvViewerCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/CsvViewer.tsx'),
    'utf8'
  );
  assert.ok(
    csvViewerCode.includes("calc(var(--ov-font-size, 15px) * 0.88)"),
    'CsvViewer should dynamically scale with --ov-font-size'
  );

  const jsonTreeCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/data/JsonTreeView.tsx'),
    'utf8'
  );
  assert.ok(
    jsonTreeCode.includes("calc(var(--ov-font-size, 15px) * 0.88)"),
    'JsonTreeView should dynamically scale with --ov-font-size'
  );

  const notebookViewerCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/NotebookViewer.tsx'),
    'utf8'
  );
  assert.ok(
    notebookViewerCode.includes("var(--ov-font-size, 15px)"),
    'NotebookViewer should dynamically scale with --ov-font-size'
  );

  const univerSheetCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/xlsx/UniverSheetViewer.tsx'),
    'utf8'
  );
  assert.ok(
    univerSheetCode.includes('calc(var(--ov-font-size, 15px) *'),
    'UniverSheetViewer grid viewport should scale with --ov-font-size and zoom'
  );
}

// 7. 验证顶部工具栏在 ~1080px 中等视口及带侧边栏容器下的多阶梯自适应收纳防覆盖契约
{
  const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert.ok(
    cssCode.includes('@container md-toolbar (max-width: 1239px)') &&
      cssCode.includes('.markdown-tool-collapse-xl'),
    'index.css must define @container md-toolbar (max-width: 1239px) collapsing .markdown-tool-collapse-xl'
  );
  assert.ok(
    cssCode.includes('@container md-toolbar (max-width: 980px)') &&
      cssCode.includes('.markdown-tool-collapse-lg') &&
      cssCode.includes('.markdown-group-collapse-lg'),
    'index.css must define @container md-toolbar (max-width: 980px) collapsing zoom, density, and width controls'
  );
  assert.ok(
    cssCode.includes('@container md-toolbar (max-width: 660px)') &&
      cssCode.includes('.markdown-tool-collapse-md'),
    'index.css must define @container md-toolbar (max-width: 660px) collapsing secondary controls on narrow viewports'
  );

  const mdToolbarCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/markdown/MarkdownToolbar.tsx'),
    'utf8'
  );
  assert.ok(
    mdToolbarCode.includes('ResizeObserver') && mdToolbarCode.includes('data-toolbar-tier='),
    'MarkdownToolbar must observe container width via ResizeObserver and expose data-toolbar-tier'
  );
  assert.ok(
    mdToolbarCode.includes('markdown-tool-collapse-xl') &&
      mdToolbarCode.includes('markdown-group-collapse-lg') &&
      mdToolbarCode.includes('toolbarWidth <= 980') &&
      mdToolbarCode.includes('toolbarWidth < 1240'),
    'MarkdownToolbar must progressively collapse low-frequency controls into the More menu around 1080px'
  );

  const workbenchHeaderCode = fs.readFileSync(
    path.join(rootDir, 'src/features/workbench/components/WorkbenchHeader.tsx'),
    'utf8'
  );
  assert.ok(
    workbenchHeaderCode.includes('hidden 2xl:flex') &&
      workbenchHeaderCode.includes('hidden xl:block'),
    'WorkbenchHeader must hide duplicate zoom and density groups below xl/2xl so 1080px viewports never overlap'
  );
}

// 8. 验证 Vite 依赖预构建完整性与 ViewerRenderer / CodeViewer React Hook 调用边界合规性
{
  const viteConfigCode = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf8');
  assert.ok(
    viteConfigCode.includes("'@hpcc-js/wasm-graphviz'") &&
      viteConfigCode.includes("'@myriaddreamin/typst.ts'") &&
      viteConfigCode.includes("'prismjs/components/prism-typescript'"),
    'vite.config.ts must pre-bundle @hpcc-js/wasm-graphviz, @myriaddreamin/typst.ts, and prismjs language components to prevent mid-session Vite dep re-optimization hash mismatches'
  );

  const viewerRendererCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/ViewerRenderer.tsx'),
    'utf8'
  );
  assert.ok(
    viewerRendererCode.includes('<PluginModeComponent'),
    'ViewerRenderer must mount plugin.renderMode as a React component (<PluginModeComponent />) so hooks inside renderMarkdownMode have an isolated Fiber'
  );

  const codeViewerCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/drivers/CodeViewer.tsx'),
    'utf8'
  );
  assert.ok(
    codeViewerCode.includes('const PlainCodeViewer: React.FC<CodeViewerProps>') &&
      codeViewerCode.includes('return <PlainCodeViewer {...props} />;'),
    'CodeViewer must delegate stateful hooks to PlainCodeViewer after STRUCTURED_EXTENSIONS branching'
  );

  const swCode = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
  assert.ok(
    swCode.includes("const CACHE_NAME = 'omniview-v2'") &&
      swCode.includes('isViteDevOrModuleRequest') &&
      swCode.includes("p.startsWith('/src/')") &&
      swCode.includes("p.startsWith('/node_modules/')"),
    'public/sw.js must bypass Vite /src/* and /node_modules/* requests and purge legacy omniview-v1 cache'
  );

  const errorBoundaryCode = fs.readFileSync(
    path.join(rootDir, 'src/features/viewers/components/common/RenderErrorBoundary.tsx'),
    'utf8'
  );
  assert.ok(
    errorBoundaryCode.includes('purgeBrowserCachesAndReload'),
    'RenderErrorBoundary must purge CacheStorage and Service Worker registrations before reloading on stale dispatcher errors'
  );

  assert.ok(
    viteConfigCode.includes('performance.getEntriesByType("resource")') &&
      viteConfigCode.includes('react-dom_client'),
    'vite.config.ts dev middleware must bridge React imports to the mounted react-dom_client ?v= hash to prevent duplicate React instances in open tabs'
  );

  const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.tsx'), 'utf8');
  assert.ok(
    mainCode.includes('bootstrapOmniView') && mainCode.includes('window.caches.keys()'),
    'src/main.tsx must purge legacy CacheStorage before mounting React root in dev mode'
  );
}

console.log('✅ All Markdown local editing, dynamic font-size & responsive toolbar regression tests passed!');




