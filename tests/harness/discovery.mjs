/**
 * OmniView — 自动化测试套件动态发现与分级分类策略中心 (Test Discovery & Taxonomy)
 *
 * 核心能力：
 * 1. 自动扫描 tests/ 目录下的所有 test-*.mjs 测试套件，告别硬编码清单维护；
 * 2. 依据文件名与特征智能推断运行模式 (node vs esbuild) 与打包策略；
 * 3. 领域标签化分类管理 (headless, svg, diagram, office, markdown, storage, driver, unit)；
 * 4. 支持丰富的关键词与分类过滤。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const TESTS_DIR = path.resolve(ROOT_DIR, 'tests');

/**
 * 特殊模式或外部依赖重载表
 */
const SUITE_CONFIG_OVERRIDES = {
  // 需要外部包排除或原生 node 模式的特殊配置
  'test-check-vsix-contents.mjs': { mode: 'node', category: 'unit' },
  'test-version-bump.mjs': { mode: 'node', category: 'unit' },
  'test-toolbar-dedup.mjs': { mode: 'node', category: 'unit' },
  'test-find-and-replace.mjs': { mode: 'node', category: 'markdown' },
  'test-diagram-toolbar-toggle.mjs': { mode: 'node', category: 'diagram' },
  'test-markdown-diagram-dblclick.mjs': { mode: 'node', category: 'diagram' },
  'test-markdown-outline.mjs': { mode: 'node', category: 'markdown' },
  'test-markdown-print-export.mjs': { mode: 'node', category: 'markdown' },
  'test-webview-save-writeback.mjs': { mode: 'node', category: 'markdown' },
  'test-presentation-outline-restore.mjs': { mode: 'node', category: 'markdown' },
  'test-native-theme.mjs': { mode: 'node', category: 'unit' },
  'test-lazy-viewport-block.mjs': { mode: 'node', category: 'unit' },
  'test-settings-integration.mjs': { mode: 'node', category: 'storage' },
  'test-codeblock-hover-toolbar.mjs': { mode: 'node', category: 'markdown' },
  'test-headless-ui-interactions.mjs': { mode: 'node', category: 'headless' },
  'test-svg-v2-advanced-interactions.mjs': { mode: 'node', category: 'headless' },
  'test-svg-global-styles.mjs': { mode: 'node', category: 'svg' },
  'test-pdf-search-controller.mjs': { mode: 'node', category: 'unit' },
  'test-echarts-block.mjs': { mode: 'node', category: 'diagram' },
  'test-doc-image-export.mjs': { mode: 'node', category: 'office' },

  // 带外部包或特殊打包策略的配置
  'test-excalidraw.mjs': { mode: 'esbuild', external: ['@excalidraw/*'], category: 'driver' },
  'test-mindmap-driver.mjs': { mode: 'esbuild', packagesExternal: true, category: 'driver' },
  'test-driver-routing.mjs': { mode: 'esbuild', packagesExternal: true, category: 'driver' },
  'test-cloudnative-drivers.mjs': { mode: 'esbuild', packagesExternal: true, category: 'driver' },
  'test-html-viewer.mjs': { mode: 'esbuild', packagesExternal: true, category: 'driver' },
  'test-vscode-integration-features.mjs': { mode: 'esbuild', packagesExternal: true, category: 'unit' },
  'test-graphviz.mjs': { mode: 'esbuild', packagesExternal: true, category: 'diagram' },
  'test-image-engine.mjs': { mode: 'esbuild', packagesExternal: true, category: 'driver' },
  'test-svg-selection-enhancements.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-core-model.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-runtime-commands.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-e2e.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-wheel-zoom-fix.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-layers-batch.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-p0-fixes.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-viewport.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-tools-shapes.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
  'test-svg-v2-transform-align.mjs': { mode: 'esbuild', packagesExternal: true, category: 'svg' },
};

/**
 * 依据文件名推断分类领域
 */
function inferCategory(fileName) {
  if (fileName.includes('headless')) return 'headless';
  if (fileName.includes('svg')) return 'svg';
  if (fileName.includes('diagram') || fileName.includes('mermaid') || fileName.includes('plantuml') || fileName.includes('graphviz')) return 'diagram';
  if (fileName.includes('docx') || fileName.includes('xlsx') || fileName.includes('pptx') || fileName.includes('word') || fileName.includes('office')) return 'office';
  if (fileName.includes('markdown') || fileName.includes('math') || fileName.includes('footnotes') || fileName.includes('wikilinks')) return 'markdown';
  if (fileName.includes('storage') || fileName.includes('indexeddb') || fileName.includes('cache') || fileName.includes('logger')) return 'storage';
  if (fileName.includes('driver') || fileName.includes('viewer') || fileName.includes('typst') || fileName.includes('epub') || fileName.includes('excalidraw')) return 'driver';
  return 'unit';
}

/**
 * 自动发现所有可用测试套件
 *
 * @param {object} [filterOptions]
 * @param {string} [filterOptions.keyword] 关键词筛选
 * @param {string} [filterOptions.category] 领域分类筛选
 * @returns {Array<{ file: string, fullPath: string, mode: 'node' | 'esbuild', category: string, external?: string[], packagesExternal?: boolean }>}
 */
export function discoverSuites(filterOptions = {}) {
  const { keyword, category } = filterOptions;
  if (!fs.existsSync(TESTS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(TESTS_DIR)
    .filter((f) => f.startsWith('test-') && f.endsWith('.mjs'))
    .sort();

  const suites = files.map((file) => {
    const override = SUITE_CONFIG_OVERRIDES[file] || {};
    const inferredCat = inferCategory(file);
    return {
      file,
      fullPath: path.join(TESTS_DIR, file),
      mode: override.mode ?? 'esbuild',
      category: override.category ?? inferredCat,
      external: override.external,
      packagesExternal: override.packagesExternal,
    };
  });

  return suites.filter((suite) => {
    if (category && suite.category.toLowerCase() !== category.toLowerCase()) {
      return false;
    }
    if (keyword) {
      const matchFile = suite.file.toLowerCase().includes(keyword.toLowerCase());
      const matchCategory = suite.category.toLowerCase().includes(keyword.toLowerCase());
      return matchFile || matchCategory;
    }
    return true;
  });
}
