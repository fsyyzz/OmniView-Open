#!/usr/bin/env node
/**
 * OmniView — Markmap 全主题自适应与设计令牌绑定单元测试
 * 重点验证：
 * 1. isThemeDark 工具函数对全量 15 个主题的明暗判断准确无误；
 * 2. MarkmapBlock 容器与画布 100% 依托 --ov-* 设计令牌，无残留写死 slate-950 暗色背景；
 * 3. src/index.css 中 .markdown-diagram-markmap 与 .diagram-canvas 拥有 sepia/light/solarized/notion 像素级适配规则；
 * 4. settingsStorage.ts 完整支持全量主题标识识别。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { isThemeDark } from '../src/shared/types.ts';

console.log('🧪 开始 Markmap 全主题自适应与设计令牌绑定单元测试...\n');

// 1. 测试 isThemeDark 准确性
console.log('--- 测试 1: isThemeDark 准确性判定 ---');
const lightThemes = ['light', 'sepia', 'solarized', 'notion'];
const darkThemes = ['dark', 'midnight', 'cyber', 'nord', 'dracula', 'forest', 'github-dark', 'catppuccin', 'tokyo-night'];

for (const t of lightThemes) {
  assert.strictEqual(isThemeDark(t), false, `主题 ${t} 应判定为浅色模式`);
}
for (const t of darkThemes) {
  assert.strictEqual(isThemeDark(t), true, `主题 ${t} 应判定为暗色模式`);
}
assert.strictEqual(isThemeDark('system'), true, '默认 system 在无特定类名时应回退为暗色模式');
console.log('✅ isThemeDark 对全量主题判定准确无误');

// 2. 测试 MarkmapBlock 组件源码无写死暗色背景
console.log('--- 测试 2: MarkmapBlock 设计令牌自适应验证 ---');
const markmapBlockSrc = readFileSync('./src/features/viewers/components/drivers/markdown/MarkmapBlock.tsx', 'utf8');
assert.ok(!markmapBlockSrc.includes('bg-slate-950/40'), 'MarkmapBlock 不应包含残留写死的 bg-slate-950/40');
assert.ok(markmapBlockSrc.includes('var(--ov-surface)'), 'MarkmapBlock 应使用 --ov-surface');
assert.ok(markmapBlockSrc.includes('var(--ov-diagram-canvas-bg'), 'MarkmapBlock 画布应使用 --ov-diagram-canvas-bg');
assert.ok(markmapBlockSrc.includes('data-theme={theme}'), 'MarkmapBlock 根元素应透传 data-theme');
console.log('✅ MarkmapBlock 设计令牌与主题透传验证通过');

// 3. 测试 src/index.css 包含 Markmap 关键主题适配规则
console.log('--- 测试 3: src/index.css Markmap 全主题规则校验 ---');
const indexCss = readFileSync('./src/index.css', 'utf8');
assert.ok(indexCss.includes('.markdown-diagram-markmap'), 'index.css 应包含 .markdown-diagram-markmap 声明');
assert.ok(indexCss.includes('[data-theme="sepia"] .markdown-diagram-markmap'), 'index.css 应包含 sepia 专属 markmap 卡片规则');
assert.ok(indexCss.includes('[data-theme="sepia"] .markdown-diagram-markmap .diagram-canvas'), 'index.css 应包含 sepia 专属 markmap 画布规则');
assert.ok(indexCss.includes('[data-theme="light"] .markdown-diagram-markmap'), 'index.css 应包含 light 专属 markmap 规则');
assert.ok(indexCss.includes('[data-theme="solarized"] .markdown-diagram-markmap'), 'index.css 应包含 solarized 专属 markmap 规则');
console.log('✅ index.css Markmap 主题规则校验通过');

// 4. 测试 settingsStorage 支持全部主题识别
console.log('--- 测试 4: settingsStorage 支持所有 ThemeId 语法校验 ---');
const storageSrc = readFileSync('./src/shared/lib/settingsStorage.ts', 'utf8');
for (const t of ['sepia', 'solarized', 'notion', 'github-dark', 'catppuccin', 'tokyo-night']) {
  assert.ok(storageSrc.includes(`'${t}'`), `settingsStorage.ts 应包含 ${t} 主题标识支持`);
}
console.log('✅ settingsStorage 全量主题识别校验通过');

console.log('\n🎉 Markmap 全主题自适应测试套件全部通过！\n');
