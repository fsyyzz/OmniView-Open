/**
 * OmniView 查看器交互状态记忆与持久化单元测试 (V3 架构)
 */
import assert from 'node:assert';
import {
  OMNIVIEW_DB_NAME,
  OMNIVIEW_DB_VERSION,
  STORE_VIEWER_STATES,
  STORE_RENDER_CACHE,
  makeViewerStateKey,
  idbSetViewerState,
  idbGetViewerState,
  idbDeleteViewerState,
  idbClearViewerStates,
  idbCountViewerStates,
  idbGetStorageSummary,
} from '../src/shared/lib/indexedDbStorage.js';
import {
  persistentMermaidCache,
  persistentGraphvizCache,
  makeDeterministicCacheKey,
} from '../src/features/viewers/lib/diagramCache.js';

async function runTests() {
  console.log('🧪 开始查看器交互偏好记忆与全景持久化存储全链路测试 (V3)...');

  // 1. 验证主键构建规则
  console.log('--- 测试 1: makeViewerStateKey 主键规整性 ---');
  const pdfKey = makeViewerStateKey('pdf', 'annual-report.pdf');
  assert.strictEqual(pdfKey, 'viewer:state:pdf:annual-report.pdf');

  const csvKey = makeViewerStateKey(' CSV ', ' sales_2026.csv ');
  assert.strictEqual(csvKey, 'viewer:state:csv:sales_2026.csv');
  console.log('✅ 1. 查看器状态复合键构建断言通过');

  // 2. 构造轻量 Mock IndexedDB 环境以支持 Node.js 离线单测
  console.log('--- 测试 2: 内存 Mock IndexedDB 环境中的 CRUD 行为 ---');

  class MockIDBCursor {
    constructor(items, req, onDelete) {
      this._items = items;
      this._index = 0;
      this._req = req;
      this._onDelete = onDelete;
    }

    get result() {
      if (this._index >= this._items.length) return null;
      const current = this._items[this._index];
      return {
        value: current,
        delete: () => this._onDelete?.(current.key || current.id),
        continue: () => {
          this._index++;
          queueMicrotask(() => {
            this._req.result = this.result;
            if (this._req.onsuccess) {
              this._req.onsuccess({ target: this._req });
            }
          });
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
      const req = { onsuccess: null, onerror: null, result: null };
      if (this.indexName === 'lastAccessedAt') {
        items.sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0));
      } else if (range && range.lower) {
        const filtered = items.filter(i => i[this.indexName] === range.lower);
        const cursor = new MockIDBCursor(filtered, req, (k) => this.store.delete(k));
        req.result = cursor.result;
        queueMicrotask(() => req.onsuccess?.({ target: req }));
        return req;
      }

      const cursor = new MockIDBCursor(items, req, (k) => this.store.delete(k));
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
    get(key) {
      const val = this._data.get(key);
      const req = { onsuccess: null, onerror: null, result: val ? JSON.parse(JSON.stringify(val)) : undefined };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }
    put(item) {
      const key = item.key || item.id;
      this._data.set(key, JSON.parse(JSON.stringify(item)));
      const req = { onsuccess: null, onerror: null, result: key };
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
    index(name) {
      if (!this._indexes.has(name)) {
        this._indexes.set(name, new MockIDBIndex(this, name));
      }
      return this._indexes.get(name);
    }
    openCursor() {
      const items = Array.from(this._data.values());
      const req = { onsuccess: null, onerror: null, result: null };
      const cursor = new MockIDBCursor(items, req, (k) => this.delete(k));
      req.result = cursor.result;
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }
  }

  const stores = new Map([
    ['files', new MockIDBObjectStore('files')],
    ['blobs', new MockIDBObjectStore('blobs')],
    ['render_cache', new MockIDBObjectStore('render_cache')],
    ['viewer_states', new MockIDBObjectStore('viewer_states')],
  ]);

  const mockDb = {
    objectStoreNames: {
      contains: (name) => stores.has(name),
    },
    transaction: (storeNames) => {
      const tx = {
        objectStore: (name) => stores.get(name),
        oncomplete: null,
        onerror: null,
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
    close: () => {},
  };

  globalThis.window = {
    indexedDB: {
      open: () => {
        const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: mockDb };
        queueMicrotask(() => req.onsuccess?.({ target: req }));
        return req;
      },
    },
  };
  globalThis.IDBKeyRange = {
    only: (val) => ({ lower: val, upper: val }),
  };

  // 3. 测试 PDF 阅读进度存取
  console.log('--- 测试 3: PDF 阅读进度状态持久化与还原 ---');
  await idbSetViewerState('pdf', 'spec.pdf', {
    currentPage: 42,
    zoom: 125,
    viewMode: 'continuous',
    annotations: [{ id: 'ann-1', page: 42, text: '重要规范条目' }],
  });

  const pdfState = await idbGetViewerState('pdf', 'spec.pdf');
  assert(pdfState !== undefined, '应当成功获取 PDF 阅读状态');
  assert.strictEqual(pdfState.currentPage, 42);
  assert.strictEqual(pdfState.zoom, 125);
  assert.strictEqual(pdfState.annotations.length, 1);
  console.log('✅ 3. PDF 阅读状态写入与读取验证通过');

  // 4. 测试 CSV 表格排序与分页偏好存取
  console.log('--- 测试 4: CSV 表格排序与分页偏好存取 ---');
  await idbSetViewerState('csv', 'users.csv', {
    sortCol: 2,
    sortAsc: false,
    pageSize: 50,
    viewMode: 'table',
  });

  const csvState = await idbGetViewerState('csv', 'users.csv');
  assert(csvState !== undefined, '应当成功获取 CSV 表格偏好');
  assert.strictEqual(csvState.sortCol, 2);
  assert.strictEqual(csvState.sortAsc, false);
  assert.strictEqual(csvState.pageSize, 50);
  console.log('✅ 4. CSV 表格偏好状态写入与读取验证通过');

  // 5. 统计与分项清理验证
  console.log('--- 测试 5: 查看器状态统计与清理 ---');
  let stats = await idbCountViewerStates();
  assert.strictEqual(stats.count, 2, '当前应存有 2 份文件的偏好记录');
  assert(stats.totalBytes > 0, '总字节数估算应大于 0');

  // 局部清理 PDF
  await idbClearViewerStates('pdf');
  const pdfAfter = await idbGetViewerState('pdf', 'spec.pdf');
  assert.strictEqual(pdfAfter, undefined, 'PDF 状态已被清空');
  const csvAfter = await idbGetViewerState('csv', 'users.csv');
  assert(csvAfter !== undefined, 'CSV 状态依然保留');

  // 全量清空
  await idbClearViewerStates();
  stats = await idbCountViewerStates();
  assert.strictEqual(stats.count, 0, '全部清空后条目数应为 0');
  console.log('✅ 5. 查看器偏好统计与精细化清理验证通过');

  // 6. 持久化图表快照验证 (Mermaid & Graphviz)
  console.log('--- 测试 6: Mermaid 与 Graphviz 双层持久化快照验证 ---');
  const mmdKey = makeDeterministicCacheKey('mermaid', 'graph TD\n A-->B', 'dark', 'svg');
  await persistentMermaidCache.set(mmdKey, '<svg id="mmd">graph</svg>');
  
  // 验证内存 0ms 命中与异步回填
  assert.strictEqual(persistentMermaidCache.getSync(mmdKey), '<svg id="mmd">graph</svg>');
  const mmdIdb = await persistentMermaidCache.get(mmdKey);
  assert.strictEqual(mmdIdb, '<svg id="mmd">graph</svg>');

  const gvKey = makeDeterministicCacheKey('graphviz:dot', 'digraph { A -> B }', 'dark', 'svg');
  await persistentGraphvizCache.set(gvKey, '<svg id="gv">dot</svg>');
  const gvIdb = await persistentGraphvizCache.get(gvKey);
  assert.strictEqual(gvIdb, '<svg id="gv">dot</svg>');
  console.log('✅ 6. Mermaid 与 Graphviz 双层持久化快照验证通过');

  console.log('\n🎉 所有查看器交互偏好与图表全景持久化单元测试全部顺利通过 (6/6 PASS)!');
}

runTests().catch(err => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
