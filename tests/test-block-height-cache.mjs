#!/usr/bin/env node
/**
 * OmniView — 零 CLS 块渲染高度缓存池与智能预估单元测试套件 (RFC-0001)
 */
import assert from 'node:assert';
import { BlockHeightCache, globalBlockHeightCache } from '../src/features/viewers/lib/blockHeightCache.ts';

console.log('🧪 开始零 CLS 块渲染高度缓存池单元测试...\n');

// 1. 基础读写与精确测量记忆
console.log('--- 测试 1: 基础高度记录与精确读取 ---');
const cache = new BlockHeightCache(5);
cache.set('block-1', 180.4, 'code');
assert.strictEqual(cache.has('block-1'), true, '应成功记录 block-1');
assert.strictEqual(cache.get('block-1'), 180, '记录值应四舍五入为 180');
assert.strictEqual(cache.size(), 1);
console.log('✅ 基础读写测试通过');

// 2. 块类型启发式首屏高度智能预估
console.log('--- 测试 2: 启发式高度智能预估 ---');
assert.strictEqual(cache.get('unknown-math', 'math'), 110, 'math 预估应为 110px');
assert.strictEqual(cache.get('unknown-diagram', 'diagram'), 320, 'diagram 预估应为 320px');
assert.strictEqual(cache.get('unknown-table', 'table'), 220, 'table 预估应为 220px');
assert.strictEqual(cache.get('unknown-code', 'code'), 180, 'code 预估应为 180px');
assert.strictEqual(cache.get('unknown-default', 'default', 140), 140, '默认预估应为 140px');
console.log('✅ 启发式高度预估通过');

// 3. LRU 淘汰机制验证
console.log('--- 测试 3: LRU 容量淘汰机制 ---');
const lruCache = new BlockHeightCache(3);
lruCache.set('k1', 100);
lruCache.set('k2', 200);
lruCache.set('k3', 300);
assert.strictEqual(lruCache.size(), 3);

// 访问 k1，使其变为最近使用
lruCache.get('k1');

// 写入 k4，此时最久未使用的 k2 应被淘汰
lruCache.set('k4', 400);
assert.strictEqual(lruCache.has('k2'), false, 'k2 应当被淘汰');
assert.strictEqual(lruCache.has('k1'), true, 'k1 应当仍存在');
assert.strictEqual(lruCache.has('k3'), true, 'k3 应当仍存在');
assert.strictEqual(lruCache.has('k4'), true, 'k4 应当仍存在');
console.log('✅ LRU 淘汰机制验证通过');

// 4. 全局单例保护与边界防御
console.log('--- 测试 4: 边界防御与全局单例测试 ---');
globalBlockHeightCache.set('test-guard', -50);
assert.strictEqual(globalBlockHeightCache.has('test-guard'), false, '负数高度不应入池');
globalBlockHeightCache.set('test-guard-nan', NaN);
assert.strictEqual(globalBlockHeightCache.has('test-guard-nan'), false, 'NaN 不应入池');
globalBlockHeightCache.set('valid-block', 250);
assert.strictEqual(globalBlockHeightCache.get('valid-block'), 250);
console.log('✅ 边界防御验证通过');

console.log('🎉 全部 4 组零 CLS 块渲染高度缓存池单元测试 100% 顺利通过！\n');

