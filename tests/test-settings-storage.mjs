/**
 * OmniView 配置持久化与工作区存储单元测试
 */
import assert from 'node:assert';
import {
  DEFAULT_SETTINGS,
  loadStoredSettings,
  saveStoredSettings,
  resetStoredSettings,
  exportSettingsJson,
  importSettingsJson,
  getStorageStats,
} from '../src/shared/lib/settingsStorage.js';
import {
  loadStoredFiles,
  saveStoredFiles,
  resetStoredFiles,
  clearStoredFiles,
} from '../src/shared/lib/fileStorage.js';

console.log('🧪 开始配置项持久化系统全链路单元测试...');

// 模拟全局 localStorage
const memoryStorage = new Map();
const storageMock = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, String(value)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
  get length() {
    return memoryStorage.size;
  },
  key: (index) => Array.from(memoryStorage.keys())[index] ?? null,
};

globalThis.localStorage = storageMock;
globalThis.window = {
  localStorage: storageMock,
};

// 1. 测试空环境默认配置加载
memoryStorage.clear();
const initial = loadStoredSettings();
assert.strictEqual(initial.theme, 'dark');
assert.strictEqual(initial.density, 'compact');
assert.strictEqual(initial.zoom, 1.0);
assert.strictEqual(initial.fontSize, 15);
assert.strictEqual(initial.sidebarOpen, true);
assert.strictEqual(initial.explorerOpen, true);
assert.strictEqual(initial.plantUmlServerUrl, 'https://www.plantuml.com/plantuml');
assert.strictEqual(initial.mindmapSplitRatio, 42);
assert.strictEqual(initial.plantUmlSplitRatio, 50);
assert.strictEqual(initial.enableOkfRendering, true);
assert.strictEqual(initial.outlinePosition, 'right');
console.log('✅ 1. 空存储环境下默认设置完整性通过');

// 2. 测试增量保存与读取
saveStoredSettings({
  theme: 'cyber',
  zoom: 1.25,
  contentWidth: 'a4',
  mindmapSplitRatio: 50,
  wordWrap: false,
  plantUmlServerUrl: 'https://custom-plantuml.internal',
  enableOkfRendering: false,
  outlinePosition: 'left',
});

const updated = loadStoredSettings();
assert.strictEqual(updated.theme, 'cyber');
assert.strictEqual(updated.zoom, 1.25);
assert.strictEqual(updated.contentWidth, 'a4', '应支持 a4 纸张宽度排版模式');
assert.strictEqual(updated.mindmapSplitRatio, 50);
assert.strictEqual(updated.wordWrap, false);
assert.strictEqual(updated.plantUmlServerUrl, 'https://custom-plantuml.internal');
assert.strictEqual(updated.enableOkfRendering, false);
assert.strictEqual(updated.outlinePosition, 'left');
// 确保未修改的字段保留默认值
assert.strictEqual(updated.density, 'compact');
console.log('✅ 2. 增量更新与合并逻辑通过');

// 3. 测试非法输入与范围自动纠偏
saveStoredSettings({
  zoom: 999, // 溢出最大值 2.5
  fontSize: 5, // 低于最小值 12
  mindmapSplitRatio: 120, // 溢出 85
  plantUmlSplitRatio: -10, // 低于 15
});

const clamped = loadStoredSettings();
assert.strictEqual(clamped.zoom, 2.5, 'zoom 超限应被截断至 2.5');
assert.strictEqual(clamped.fontSize, 12, 'fontSize 低于下限应被截断至 12');
assert.strictEqual(clamped.mindmapSplitRatio, 85, 'mindmapSplitRatio 超限应被截断至 85');
assert.strictEqual(clamped.plantUmlSplitRatio, 15, 'plantUmlSplitRatio 低于下限应被截断至 15');
console.log('✅ 3. 非法参数与数值钳位容错通过');

// 4. 测试旧版 v1 结构向 v2 自动平滑迁移
memoryStorage.clear();
memoryStorage.set('omniview:workbench:settings:v1', JSON.stringify({
  theme: 'nord',
  density: 'comfortable',
  zoom: 1.1,
  fontSize: 18,
  outlineOpen: false,
}));

const migrated = loadStoredSettings();
assert.strictEqual(migrated.theme, 'nord');
assert.strictEqual(migrated.density, 'comfortable');
assert.strictEqual(migrated.fontSize, 18);
assert.strictEqual(migrated.outlineOpen, false);
// 校验已自动存入 v2 键名
assert.ok(memoryStorage.has('omniview:workbench:settings:v2'), '应自动持久化至 v2 键名');
console.log('✅ 4. v1 到 v2 自动向前兼容平滑迁移通过');

// 5. 测试导出与导入配置备份
const exportedJson = exportSettingsJson();
assert.ok(exportedJson.includes('"theme": "nord"'));

const importResult = importSettingsJson(JSON.stringify({
  theme: 'forest',
  density: 'standard',
  zoom: 1.5,
  plantUmlServerUrl: 'https://backup-uml.org',
}));
assert.strictEqual(importResult.success, true);
assert.strictEqual(importResult.settings?.theme, 'forest');

const loadedAfterImport = loadStoredSettings();
assert.strictEqual(loadedAfterImport.theme, 'forest');
assert.strictEqual(loadedAfterImport.plantUmlServerUrl, 'https://backup-uml.org');
console.log('✅ 5. 配置 JSON 导入导出与备份恢复通过');

// 6. 测试重置配置
const reset = resetStoredSettings();
assert.strictEqual(reset.theme, 'dark');
assert.strictEqual(reset.plantUmlServerUrl, 'https://www.plantuml.com/plantuml');
console.log('✅ 6. 恢复出厂默认设置通过');

// 7. 测试文件持久化生命周期
memoryStorage.clear();
const initFiles = loadStoredFiles();
assert.ok(initFiles.length >= 3, '默认应有内置示例文件');

const customFile = {
  id: 'test-custom-1',
  name: 'architecture.mm',
  path: '/workspace/architecture.mm',
  extension: 'mm',
  content: '# 导图设计\n## 模块A\n## 模块B',
  size: 30,
  lastModified: Date.now(),
  isCustomUploaded: true,
};

saveStoredFiles([customFile, ...initFiles]);
const loadedFiles = loadStoredFiles();
assert.strictEqual(loadedFiles[0].id, 'test-custom-1');
assert.strictEqual(loadedFiles[0].content, '# 导图设计\n## 模块A\n## 模块B');

const resetFilesResult = resetStoredFiles();
assert.strictEqual(resetFilesResult.some(f => f.id === 'test-custom-1'), false, '重置后不应包含临时自定义文件');
console.log('✅ 7. 工作区文件多实例持久化与生命周期管理通过');

// 8. 测试存储容量统计
const stats = getStorageStats();
assert.ok(stats.totalBytes > 0);
assert.ok(stats.fileCount > 0);
console.log(`✅ 8. 存储开销度量正常（当前存储占用: ${stats.totalFormatted}, 键数量: ${stats.keys.length}）`);

console.log('🎉 所有配置项与工作区持久化全量测试通过！');
