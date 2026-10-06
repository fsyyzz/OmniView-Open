/**
 * OmniView 应用运行与诊断日志持久化单元测试 (V4 架构)
 */
import assert from 'node:assert';
import {
  OMNIVIEW_DB_NAME,
  OMNIVIEW_DB_VERSION,
  STORE_LOGS,
  MAX_LOG_ENTRIES,
  TARGET_LOG_ENTRIES,
  idbSaveLogs,
  idbGetLogs,
  idbClearLogs,
  idbCountLogs,
} from '../src/shared/lib/indexedDbStorage.js';
import { appLogger } from '../src/shared/lib/appLogger.js';

async function runTests() {
  console.log('🧪 开始应用运行与诊断日志中枢全链路单元测试 (V4)...');

  // --- 测试 1: 内存 Mock IndexedDB 环境配置 ---
  console.log('--- 测试 1: 构造支持 logs 仓库与时间戳索引的 Mock 数据库 ---');

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
        delete: () => this._onDelete?.(current.id),
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
    openCursor(range, direction = 'next') {
      const items = Array.from(this.store._data.values());
      const req = { onsuccess: null, onerror: null, result: null };

      if (this.indexName === 'timestamp') {
        items.sort((a, b) => a.timestamp - b.timestamp);
      }
      if (direction === 'prev') {
        items.reverse();
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
      const key = item.id || item.key;
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
    openCursor(range, direction) {
      const items = Array.from(this._data.values());
      const req = { onsuccess: null, onerror: null, result: null };
      const cursor = new MockIDBCursor(items, req, (k) => this.delete(k));
      req.result = cursor.result;
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }
  }

  const stores = new Map([
    ['logs', new MockIDBObjectStore('logs')],
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
  console.log('✅ 1. Mock IndexedDB 日志运行时初始化通过');

  // --- 测试 2: appLogger 基础记录与分级格式化 ---
  console.log('--- 测试 2: appLogger 分级记录与内存环形缓冲 ---');
  let notifiedCount = 0;
  const unsubscribe = appLogger.subscribe((item) => {
    notifiedCount++;
  });

  appLogger.info('test:module', '这是一条测试信息', { code: 200 });
  appLogger.warn('test:warning', '这是一条警告信息');
  appLogger.error('test:error', '这是一条异常信息', new Error('测试崩溃堆栈'));

  const memoryLogs = appLogger.getMemoryLogs();
  assert(memoryLogs.length >= 3, '内存缓冲区应存有至少 3 条日志');
  assert(notifiedCount >= 3, '订阅者应当被触发至少 3 次');

  const errorLog = memoryLogs.find(l => l.level === 'error');
  assert(errorLog !== undefined, '应当包含 error 级别的日志');
  assert.strictEqual(errorLog.source, 'test:error');
  assert(errorLog.details?.includes('测试崩溃堆栈'), '应当正确序列化并保存 Error 堆栈');
  console.log('✅ 2. appLogger 分级记录、堆栈捕获与响应式订阅断言通过');

  // --- 测试 3: 批量持久化与 IndexedDB 读写 ---
  console.log('--- 测试 3: 立即刷新暂存队列并持久化至 IndexedDB ---');
  await appLogger.flush();

  const idbLogs = await idbGetLogs({ limit: 10 });
  assert(idbLogs.length >= 3, 'IndexedDB 应当成功持久化刚才的日志');
  assert.strictEqual(idbLogs[0].timestamp >= idbLogs[idbLogs.length - 1].timestamp, true, '日志应当默认按时间倒序排列');

  const onlyErrors = await idbGetLogs({ level: 'error' });
  assert.strictEqual(onlyErrors.every(l => l.level === 'error'), true, '按 error 级别过滤应当仅返回错误条目');
  console.log('✅ 3. 批量防抖持久化与多维度过滤查询断言通过');

  // --- 测试 4: 多格式导出 (纯文本 / JSON / 系统全景诊断报告) ---
  console.log('--- 测试 4: 多格式诊断日志导出断言 (Text / JSON / Markdown Report) ---');
  const exportText = await appLogger.exportLogsAsText();
  assert(exportText.includes('OmniView 系统诊断与运行日志导出'), '导出文本应包含诊断报头');
  assert(exportText.includes('[ERROR] [test:error] 这是一条异常信息'), '导出文本应包含详细格式化行');

  const exportJsonStr = await appLogger.exportLogsAsJson();
  const parsedJson = JSON.parse(exportJsonStr);
  assert(parsedJson.generator === 'OmniView Diagnostic Logger', 'JSON 导出应包含正确的发生器标识');
  assert(Array.isArray(parsedJson.logs) && parsedJson.logs.length >= 3, 'JSON 导出应包含结构化日志数组');
  assert(parsedJson.logs.some(l => l.level === 'error'), 'JSON 日志列表应包含已记录的错误条目');

  const diagnosticsReport = await appLogger.exportSystemDiagnostics();
  assert(diagnosticsReport.includes('# OmniView 系统全景诊断与运行体检报告'), '诊断报告应包含主标题');
  assert(diagnosticsReport.includes('## 1. 运行宿主与环境 (Environment)'), '诊断报告应包含宿主环境章节');
  assert(diagnosticsReport.includes('## 2. 数据库与日志存储概况 (Storage & Logs)'), '诊断报告应包含存储概况章节');
  assert(diagnosticsReport.includes('## 3. 最近严重异常追踪 (Recent Errors)'), '诊断报告应包含异常追踪章节');

  console.log('✅ 4. 诊断日志格式化文本、结构化 JSON 与系统诊断全景报告导出断言全部通过');

  // --- 测试 5: 自动容量守护与旧日志淘汰 (Cap at 1000 items) ---
  console.log('--- 测试 5: 自动容量守护与 LRU 批量淘汰测试 (1050 -> 800 条) ---');
  const bulkItems = [];
  const baseTime = Date.now();
  for (let i = 0; i < 1050; i++) {
    bulkItems.push({
      id: `bulk_log_${i}`,
      timestamp: baseTime + i,
      level: 'info',
      source: 'test:bulk',
      message: `Bulk message #${i}`,
      size: 100,
    });
  }
  await idbSaveLogs(bulkItems);

  // 验证当前总条数被裁剪至 TARGET_LOG_ENTRIES (800) 附近
  const countStats = await idbCountLogs();
  assert(countStats.count <= MAX_LOG_ENTRIES, `当前日志条数应不超过 ${MAX_LOG_ENTRIES}`);
  assert.strictEqual(countStats.count, TARGET_LOG_ENTRIES, `超限后应被自动裁剪至目标水位线 ${TARGET_LOG_ENTRIES}`);
  console.log('✅ 5. 超限 1000 条时自动 LRU 淘汰旧日志验证通过');

  // --- 测试 6: 清空全部日志 ---
  console.log('--- 测试 6: 清空所有日志 ---');
  await appLogger.clearLogs();
  const emptyStats = await idbCountLogs();
  assert.strictEqual(emptyStats.count, 0, '清空后条数应为 0');
  assert.strictEqual(appLogger.getMemoryLogs().length, 0, '清空后内存缓冲区条数应为 0');
  console.log('✅ 6. 清空日志验证通过');

  unsubscribe();
  console.log('\n🎉 所有应用运行与诊断日志中枢单元测试全部顺利通过 (6/6 PASS)!');
}

runTests().catch(err => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
