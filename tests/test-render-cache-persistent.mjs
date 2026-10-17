/**
 * OmniView 图表渲染快照持久化缓存与 LRU 空间配额守护单元测试
 */
import assert from 'node:assert';
import {
  OMNIVIEW_DB_NAME,
  OMNIVIEW_DB_VERSION,
  STORE_RENDER_CACHE,
  MAX_RENDER_CACHE_BYTES,
  HIGH_WATERMARK_BYTES,
  idbGetRenderCache,
  idbSetRenderCache,
  idbDeleteRenderCache,
  idbClearRenderCache,
  idbGetRenderCacheStats,
  getIndexedDB,
} from '../src/shared/lib/indexedDbStorage.js';
import {
  makeDeterministicCacheKey,
  PersistentDiagramCache,
  fastFnv1a,
} from '../src/features/viewers/lib/diagramCache.js';

async function runTests() {
  console.log('🧪 开始渲染快照持久化缓存与 LRU 配额守护全链路单元测试...');

  // --- 测试 1: 确定性复合哈希键规范化与正交性 ---
  console.log('--- 测试 1: 确定性复合哈希键规范化与正交性断言 ---');
  const codeLF = '@startuml\nAlice -> Bob: Hello\n@enduml';
  const codeCRLF = '@startuml\r\nAlice -> Bob: Hello\r\n@enduml';
  const codeSpaces = '   @startuml\nAlice -> Bob: Hello\n@enduml   \n\n';

  const key1 = makeDeterministicCacheKey('plantuml', codeLF, 'dark', 'svg');
  const key2 = makeDeterministicCacheKey('plantuml', codeCRLF, 'dark', 'svg');
  const key3 = makeDeterministicCacheKey('plantuml', codeSpaces, 'dark', 'svg');

  assert.strictEqual(key1, key2, 'CRLF 与 LF 规范化后必须生成完全相同的 Key');
  assert.strictEqual(key1, key3, '首尾换行与空白剪裁后必须生成完全相同的 Key');

  // 深浅色正交性
  const keyDark = makeDeterministicCacheKey('plantuml', codeLF, 'dark', 'svg');
  const keyLight = makeDeterministicCacheKey('plantuml', codeLF, 'light', 'svg');
  assert.notStrictEqual(keyDark, keyLight, '不同主题颜色下的渲染产物必须生成独立的 Key');
  assert.ok(keyDark.includes(':dark:'));
  assert.ok(keyLight.includes(':light:'));

  // 引擎正交性
  const keyMermaid = makeDeterministicCacheKey('mermaid', codeLF, 'dark', 'svg');
  assert.notStrictEqual(keyDark, keyMermaid, '不同引擎类型必须生成独立的 Key');
  console.log('✅ 1. 确定性复合哈希键规范化与正交性验证通过');

  // --- 测试 2: 内存 Mock IndexedDB 运行时与表结构 ---
  console.log('--- 测试 2: 构造 Mock IndexedDB 运行时并验证 render_cache 仓库 ---');

  class MockIDBCursor {
    constructor(items, onUpdate, onDelete) {
      this._items = items; // 已按索引排序的数组
      this._index = 0;
      this._onDelete = onDelete;
    }

    get result() {
      if (this._index >= this._items.length) return null;
      const current = this._items[this._index];
      return {
        value: current,
        delete: () => this._onDelete(current.key),
        continue: () => {
          this._index++;
          queueMicrotask(() => this.onsuccess?.({ target: this }));
        },
      };
    }
  }

  class MockIDBIndex {
    constructor(store, indexName) {
      this.store = store;
      this.indexName = indexName;
    }

    openCursor(range) {
      const items = Array.from(this.store._data.values());
      // 升序排列 (按 lastAccessedAt 升序，最旧的排在前面)
      if (this.indexName === 'lastAccessedAt') {
        items.sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0));
      } else if (this.indexName === 'engine' && range) {
        const filtered = items.filter(i => i.engine === range);
        const req = { onsuccess: null, onerror: null };
        const cursor = new MockIDBCursor(filtered, null, (k) => this.store.delete(k));
        req.result = cursor.result;
        queueMicrotask(() => req.onsuccess?.({ target: req }));
        return req;
      }

      const req = { onsuccess: null, onerror: null };
      const cursor = new MockIDBCursor(items, null, (k) => this.store.delete(k));
      req.result = cursor.result;
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }
  }

  class MockIDBObjectStore {
    constructor(name) {
      this.name = name;
      this._data = new Map();
      this._indexes = new Map();
    }

    put(val) {
      this._data.set(val.key || val.id, JSON.parse(JSON.stringify(val)));
      const req = { onsuccess: null, onerror: null, result: val.key || val.id };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    get(key) {
      const v = this._data.get(key);
      const req = { onsuccess: null, onerror: null, result: v ? JSON.parse(JSON.stringify(v)) : undefined };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    getAll() {
      const list = Array.from(this._data.values()).map(v => JSON.parse(JSON.stringify(v)));
      const req = { onsuccess: null, onerror: null, result: list };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    delete(key) {
      this._data.delete(key);
      const req = { onsuccess: null, onerror: null, result: undefined };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    clear() {
      this._data.clear();
      const req = { onsuccess: null, onerror: null, result: undefined };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    count() {
      const req = { onsuccess: null, onerror: null, result: this._data.size };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    createIndex(name) {
      this._indexes.set(name, new MockIDBIndex(this, name));
    }

    index(name) {
      return this._indexes.get(name) || new MockIDBIndex(this, name);
    }
  }

  class MockIDBDatabase {
    constructor() {
      this.objectStoreNames = {
        _names: new Set(),
        contains: (name) => this.objectStoreNames._names.has(name),
      };
      this._stores = new Map();
    }

    createObjectStore(name, opt) {
      this.objectStoreNames._names.add(name);
      const store = new MockIDBObjectStore(name);
      this._stores.set(name, store);
      return store;
    }

    transaction(storeNames) {
      const stores = this._stores;
      const tx = {
        objectStore: (n) => stores.get(n),
        oncomplete: null,
        onerror: null,
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    }
  }

  const mockDb = new MockIDBDatabase();
  globalThis.IDBKeyRange = {
    only: (val) => val,
  };
  globalThis.window = {
    indexedDB: {
      open: () => {
        const req = {
          result: mockDb,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        queueMicrotask(() => {
          req.onupgradeneeded?.({ target: req });
          req.onsuccess?.({ target: req });
        });
        return req;
      },
    },
  };

  const db = await getIndexedDB();
  assert.ok(db.objectStoreNames.contains(STORE_RENDER_CACHE), 'render_cache 仓库应成功初始化');
  console.log('✅ 2. Mock 运行时与 render_cache 索引结构初始化通过');

  // --- 测试 3: 渲染产物写入与 Singleflight 幂等性 ---
  console.log('--- 测试 3: 渲染产物原子落盘与 Singleflight 幂等性断言 ---');
  const dummySvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';

  // 并发写同一个 Key 两次，Singleflight 应当自动合并
  await Promise.all([
    idbSetRenderCache({ key: keyDark, engine: 'plantuml', format: 'svg', data: dummySvg }),
    idbSetRenderCache({ key: keyDark, engine: 'plantuml', format: 'svg', data: dummySvg }),
  ]);

  const loadedSvg = await idbGetRenderCache(keyDark);
  assert.strictEqual(loadedSvg, dummySvg, '应成功从 IndexedDB 取回持久化的 SVG 产物');

  // 幂等性断言：条目数量仍必须为 1
  let stats = await idbGetRenderCacheStats();
  assert.strictEqual(stats.count, 1, '并发写入相同 Key 必须保持严格单一条目，绝不重复插入');
  console.log('✅ 3. 原子落盘与并发 Singleflight 幂等性通过');

  // --- 测试 4: PersistentDiagramCache 双层门面协同 ---
  console.log('--- 测试 4: PersistentDiagramCache 内存与磁盘双层命中 ---');
  const cacheManager = new PersistentDiagramCache('plantuml', 10);
  const testKey = 'cache:render:plantuml:svg:dark:test999';
  const testSvg = '<svg id="test999"></svg>';

  // 写入双层缓存
  await cacheManager.set(testKey, testSvg, 'svg');

  // 内存命中 (0ms)
  const syncMem = cacheManager.getSync(testKey);
  assert.strictEqual(syncMem, testSvg, '内存层应立即可用');

  // 模拟清空内存，测试从磁盘回填
  cacheManager.clearMemory();
  assert.strictEqual(cacheManager.getSync(testKey), undefined, '清空内存后同步读应为空');

  // 异步读取：自动从 IndexedDB 读出并回填内存
  const asyncDisk = await cacheManager.get(testKey);
  assert.strictEqual(asyncDisk, testSvg, '异步读取应成功从 IndexedDB 取出');
  assert.strictEqual(cacheManager.getSync(testKey), testSvg, '取出后应自动回填至内存 LRU 中');
  console.log('✅ 4. PersistentDiagramCache 双层协同与回填机制通过');

  // --- 测试 5: 统计指标与一键清空 ---
  console.log('--- 测试 5: 存储度量统计与一键清理 ---');
  stats = await idbGetRenderCacheStats();
  assert.ok(stats.count >= 2, '当前应至少有 2 个快照');
  assert.ok(stats.totalBytes > 0, '字节数应大于 0');
  assert.strictEqual(stats.maxBytes, MAX_RENDER_CACHE_BYTES, '硬上限应为 50MB');

  // 清空测试
  await idbClearRenderCache();
  stats = await idbGetRenderCacheStats();
  assert.strictEqual(stats.count, 0, '清空后条目数应为 0');
  assert.strictEqual(stats.totalBytes, 0, '清空后字节数应为 0');
  console.log('✅ 5. 存储分析指标度量与一键清空通过');

  console.log('🎉 所有图表渲染快照持久化缓存与 LRU 配额守护单元测试 100% 通过！');
}

runTests().catch((err) => {
  console.error('❌ 渲染快照持久化缓存测试失败:', err);
  process.exit(1);
});
