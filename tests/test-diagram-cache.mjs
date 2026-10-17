/**
 * DiagramLruCache 单元测试与契约验证：
 * 验证 LRU 淘汰机制、fastFnv1a 快速哈希、命中率统计与边界情况。
 */
import assert from 'node:assert/strict';
import {
  DiagramLruCache,
  fastFnv1a,
  mermaidRenderCache,
  katexRenderCache,
} from '../src/features/viewers/lib/diagramCache';

async function runTests() {
  console.log('🧪 开始测试 DiagramLruCache & fastFnv1a...');

  // 1. 测试 fastFnv1a 哈希函数
  const h1 = fastFnv1a('graph TD; A-->B;');
  const h2 = fastFnv1a('graph TD; A-->B;');
  const h3 = fastFnv1a('graph TD; A-->C;');
  assert.equal(typeof h1, 'string', 'Hash 应该返回字符串');
  assert.equal(h1, h2, '相同文本应该产生完全相同的哈希');
  assert.notEqual(h1, h3, '不同文本应该产生不同的哈希');
  assert.ok(h1.length > 0, 'Hash 不应为空');
  console.log('  ✓ fastFnv1a 哈希一致性与区分度验证通过');

  // 2. 测试 DiagramLruCache 存取与命中统计
  const cache = new DiagramLruCache(3);
  assert.equal(cache.get('non-existent'), undefined, '未命中应返回 undefined');
  
  const stats0 = cache.getStats();
  assert.equal(stats0.misses, 1, '未命中次数应为 1');
  assert.equal(stats0.hits, 0, '命中次数应为 0');

  cache.set('k1', 'val1');
  cache.set('k2', 'val2');
  cache.set('k3', 'val3');
  assert.equal(cache.get('k1'), 'val1', '应该能获取到 k1');
  assert.equal(cache.get('k2'), 'val2', '应该能获取到 k2');
  
  const stats1 = cache.getStats();
  assert.equal(stats1.hits, 2, '命中次数应为 2');
  assert.equal(stats1.size, 3, '容量应该为 3');
  console.log('  ✓ 基本存取与命中计数验证通过');

  // 3. 测试 LRU 淘汰机制
  // 当前使用顺序（从旧到新）：k3, k1, k2
  // 插入 k4 时，最久未使用的 k3 应该被淘汰
  cache.set('k4', 'val4');
  assert.equal(cache.has('k3'), false, '最久未访问的 k3 应当已被 LRU 淘汰');
  assert.equal(cache.has('k1'), true, '被访问过的 k1 应当保留');
  assert.equal(cache.has('k2'), true, '被访问过的 k2 应当保留');
  assert.equal(cache.has('k4'), true, '新插入的 k4 应当保留');
  assert.equal(cache.getStats().size, 3, '容量应仍为上限 3');
  console.log('  ✓ LRU 容量淘汰机制验证通过');

  // 4. makeKey 规范
  const key1 = cache.makeKey('mermaid', 'graph TD; A-->B;', 'dark');
  const key2 = cache.makeKey('mermaid', 'graph TD; A-->B;', 'dark');
  const key3 = cache.makeKey('mermaid', 'graph TD; A-->B;', 'light');
  assert.equal(key1, key2, '相同参数生成的 key 必须相同');
  assert.notEqual(key1, key3, '不同 extra 模式生成的 key 必须不同');
  console.log('  ✓ 复合缓存键 makeKey 生成规则验证通过');

  // 5. 单例导出存在性验证
  assert.ok(mermaidRenderCache instanceof DiagramLruCache, 'mermaidRenderCache 必须是 DiagramLruCache 实例');
  assert.ok(katexRenderCache instanceof DiagramLruCache, 'katexRenderCache 必须是 DiagramLruCache 实例');
  console.log('  ✓ 全局单例导出验证通过');

  console.log('✅ DiagramLruCache 全部测试通过！');
}

runTests().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
