#!/usr/bin/env node
/**
 * Mermaid 配置与状态图 (stateDiagram) 渲染主题高对比度测试
 * 重点检验：stateLabelColor 与 stateBkg 决不能同色，杜绝文字隐形与对比度缺失
 */
import assert from 'node:assert';
import { getMermaidConfig } from '../src/shared/lib/mermaidConfig.ts';

console.log('🧪 开始 Mermaid 配置与 stateDiagram 状态图高对比度测试...');

// 1. 暗色模式配置测试
console.log('--- 测试 1: 暗色模式 (isDark=true) stateDiagram 变量完整性与高对比度 ---');
const darkConfig = getMermaidConfig(true);
assert.strictEqual(darkConfig.theme, 'dark');
assert.ok(darkConfig.themeVariables, '暗色 themeVariables 必须存在');

const darkTheme = darkConfig.themeVariables;
assert.strictEqual(darkTheme.stateBkg, '#111827', '暗色 stateBkg 应为深色背景');
assert.strictEqual(darkTheme.stateBorder, '#38bdf8', '暗色 stateBorder 应为高对比亮天蓝');
assert.strictEqual(darkTheme.stateLabelColor, '#f8fafc', '暗色 stateLabelColor 必须为高亮白色，确保文字可见');
assert.notStrictEqual(darkTheme.stateLabelColor, darkTheme.stateBkg, '暗色文字与背景决不能同色');
assert.strictEqual(darkTheme.transitionColor, '#60a5fa', '暗色 transitionColor 应为清晰亮蓝');
assert.strictEqual(darkTheme.transitionLabelColor, '#f1f5f9', '暗色 transitionLabelColor 必须清晰可见');
assert.strictEqual(darkTheme.specialStateColor, '#38bdf8', '暗色 specialStateColor 起始节点必须高亮');

assert.ok(darkConfig.state, '暗色模式下 state 专用配置块必须存在');
assert.strictEqual(darkConfig.state?.useMaxWidth, true);
assert.strictEqual(darkConfig.state?.fontSize, 12);
console.log('✅ 暗色模式 stateDiagram 变量与对比度校验通过');

// 2. 亮色模式配置测试
console.log('--- 测试 2: 亮色模式 (isDark=false) stateDiagram 变量完整性与高对比度 ---');
const lightConfig = getMermaidConfig(false);
assert.strictEqual(lightConfig.theme, 'default');
assert.ok(lightConfig.themeVariables, '亮色 themeVariables 必须存在');

const lightTheme = lightConfig.themeVariables;
assert.strictEqual(lightTheme.stateBkg, '#f8fafc', '亮色 stateBkg 应为亮色背景');
assert.strictEqual(lightTheme.stateBorder, '#2563eb', '亮色 stateBorder 应为高对比深蓝');
assert.strictEqual(lightTheme.stateLabelColor, '#0f172a', '亮色 stateLabelColor 必须为深色墨蓝，确保文字可见');
assert.notStrictEqual(lightTheme.stateLabelColor, lightTheme.stateBkg, '亮色文字与背景决不能同色');
assert.strictEqual(lightTheme.transitionColor, '#1e293b', '亮色 transitionColor 应为高对比深色');
assert.strictEqual(lightTheme.transitionLabelColor, '#0f172a', '亮色 transitionLabelColor 必须清晰可见');
assert.strictEqual(lightTheme.specialStateColor, '#2563eb', '亮色 specialStateColor 起始节点必须清晰');

assert.ok(lightConfig.state, '亮色模式下 state 专用配置块必须存在');
assert.strictEqual(lightConfig.state?.useMaxWidth, true);
assert.strictEqual(lightConfig.state?.fontSize, 12);
console.log('✅ 亮色模式 stateDiagram 变量与对比度校验通过');

// 3. 复合状态与边缘场景测试
console.log('--- 测试 3: 复合状态与连线背景配置 ---');
assert.ok(darkTheme.compositeBackground, '暗色复合状态背景必须存在');
assert.ok(darkTheme.compositeTitleBackground, '暗色复合状态标题背景必须存在');
assert.ok(lightTheme.compositeBackground, '亮色复合状态背景必须存在');
assert.ok(lightTheme.compositeTitleBackground, '亮色复合状态标题背景必须存在');
console.log('✅ 复合状态配置校验通过');

console.log('🎉 所有 Mermaid stateDiagram 校验测试 100% 通过！\n');
