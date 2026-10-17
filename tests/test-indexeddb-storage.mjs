/**
 * OmniView IndexedDB 本地持久化与双层存储引擎单元测试
 */
import assert from 'node:assert';
import {
  OMNIVIEW_DB_NAME,
  OMNIVIEW_DB_VERSION,
  STORE_FILES,
  STORE_BLOBS,
  isIndexedDbSupported,
  getIndexedDB,
  idbSaveFiles,
  idbLoadFiles,
  idbSaveFile,
  idbDeleteFile,
  idbClearFiles,
  idbSaveBlob,
  idbGetBlob,
  idbDeleteBlob,
  idbGetStorageStats,
} from '../src/shared/lib/indexedDbStorage.js';
import {
  initStorageAsync,
  loadStoredFiles,
  saveStoredFiles,
  resetStoredFiles,
  saveBinaryBlob,
  getBinaryBlob,
  deleteBinaryBlob,
  getStorageEngineInfo,
} from '../src/shared/lib/fileStorage.js';

async function runTests() {
  console.log('🧪 开始 IndexedDB 持久化引擎与双层存储架构全链路单元测试...');

  // --- 阶段 1: 无 IndexedDB 的 Node 原生环境降级测试 ---
  console.log('--- 测试 1: 原生 Node.js 无浏览器上下文时的优雅降级 ---');
  assert.strictEqual(isIndexedDbSupported(), false, 'Node 环境下默认不支持 window.indexedDB');
  const engineInfo = getStorageEngineInfo();
  assert.strictEqual(engineInfo.engine, 'LocalStorage (Fallback)');
  assert.strictEqual(engineInfo.supported, false);

  // 尝试获取数据库应当优雅抛错或被捕获
  await assert.rejects(
    async () => {
      await getIndexedDB();
    },
    {
      name: 'Error',
      message: 'IndexedDB is not supported in the current environment',
    }
  );
  console.log('✅ 1. 环境自适应与不支持环境容错断言通过');

  // --- 阶段 2: 构造轻量内存 Mock IndexedDB 环境 ---
  console.log('--- 测试 2: 构造标准 Mock IndexedDB 运行时并验证核心引擎 ---');

  class MockIDBObjectStore {
    constructor(name, dataMap, indexes = new Set()) {
      this.name = name;
      this._data = dataMap;
      this._indexes = indexes;
    }

    put(value) {
      const key = value.id;
      this._data.set(key, JSON.parse(JSON.stringify(value)));
      const req = { onsuccess: null, onerror: null, result: key };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    get(key) {
      const val = this._data.get(key);
      const req = { onsuccess: null, onerror: null, result: val ? JSON.parse(JSON.stringify(val)) : undefined };
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
      const count = this._data.size;
      const req = { onsuccess: null, onerror: null, result: count };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    }

    createIndex(name) {
      this._indexes.add(name);
    }
  }

  class MockIDBTransaction {
    constructor(stores) {
      this.stores = stores;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;

      queueMicrotask(() => {
        this.oncomplete?.();
      });
    }

    objectStore(name) {
      const store = this.stores.get(name);
      if (!store) throw new Error(`Object store ${name} not found`);
      return store;
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

    createObjectStore(name) {
      this.objectStoreNames._names.add(name);
      const store = new MockIDBObjectStore(name, new Map());
      this._stores.set(name, store);
      return store;
    }

    transaction(storeNames) {
      return new MockIDBTransaction(this._stores);
    }
  }

  let currentMockDb = new MockIDBDatabase();

  const mockIndexedDB = {
    open: (name, version) => {
      const req = {
        result: currentMockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      queueMicrotask(() => {
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: req });
        }
        req.onsuccess?.({ target: req });
      });

      return req;
    },
  };

  // 注入浏览器运行上下文
  const memoryLocalStorage = new Map();
  const mockLocalStorage = {
    getItem: (k) => memoryLocalStorage.get(k) ?? null,
    setItem: (k, v) => memoryLocalStorage.set(k, String(v)),
    removeItem: (k) => memoryLocalStorage.delete(k),
    clear: () => memoryLocalStorage.clear(),
    get length() {
      return memoryLocalStorage.size;
    },
  };

  globalThis.window = {
    indexedDB: mockIndexedDB,
    localStorage: mockLocalStorage,
  };

  assert.strictEqual(isIndexedDbSupported(), true, 'Mock 注入后应识别为支持 IndexedDB');

  // 连接并初始化 DB
  const db = await getIndexedDB();
  assert.ok(db, '数据库应成功建立连接');
  assert.ok(db.objectStoreNames.contains(STORE_FILES), '工作区文件仓库 files 应成功创建');
  assert.ok(db.objectStoreNames.contains(STORE_BLOBS), '二进制文件仓库 blobs 应成功创建');
  console.log('✅ 2. Mock 运行时初始化与 Schema 索引定义验证通过');

  // --- 阶段 3: 文件增删改查与批量操作 ---
  console.log('--- 测试 3: 文件持久化增删查改与批量原子写入 ---');
  const sampleFiles = [
    {
      id: 'f-1',
      name: 'architecture.md',
      path: '/workspace/architecture.md',
      extension: 'md',
      content: '# Architecture\nUnified IDB Storage',
      size: 35,
      lastModified: 1700000000000,
      isModified: false,
      isCustomUploaded: false,
    },
    {
      id: 'f-2',
      name: 'data.csv',
      path: '/workspace/data.csv',
      extension: 'csv',
      content: 'id,name,value\n1,Alpha,100\n2,Beta,200',
      size: 38,
      lastModified: 1700000001000,
      isModified: true,
      isCustomUploaded: true,
    },
  ];

  await idbSaveFiles(sampleFiles);
  let loadedFromDb = await idbLoadFiles();
  assert.strictEqual(loadedFromDb.length, 2);
  assert.strictEqual(loadedFromDb.find(f => f.id === 'f-1')?.name, 'architecture.md');
  assert.strictEqual(loadedFromDb.find(f => f.id === 'f-2')?.content, 'id,name,value\n1,Alpha,100\n2,Beta,200');

  // 单文件更新
  await idbSaveFile({
    id: 'f-1',
    name: 'architecture.md',
    path: '/workspace/architecture.md',
    extension: 'md',
    content: '# Architecture\nUpdated Content!',
    size: 38,
    lastModified: 1700000002000,
    isModified: true,
  });
  loadedFromDb = await idbLoadFiles();
  assert.strictEqual(loadedFromDb.find(f => f.id === 'f-1')?.content, '# Architecture\nUpdated Content!');

  // 单文件删除
  await idbDeleteFile('f-2');
  loadedFromDb = await idbLoadFiles();
  assert.strictEqual(loadedFromDb.length, 1);
  assert.strictEqual(loadedFromDb[0].id, 'f-1');

  // 清空文件
  await idbClearFiles();
  loadedFromDb = await idbLoadFiles();
  assert.strictEqual(loadedFromDb.length, 0);
  console.log('✅ 3. 文件批处理、单个更新、删除与清空测试全部通过');

  // --- 阶段 4: 二进制 Blob 存取测试 ---
  console.log('--- 测试 4: 二进制数据 (Blob / ArrayBuffer) 存取与生命周期 ---');
  const dummyBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer; // PNG 幻数
  await idbSaveBlob('blob-img-1', dummyBuffer);

  const retrievedBlob = await idbGetBlob('blob-img-1');
  assert.ok(retrievedBlob, '应成功读取存入的 ArrayBuffer 二进制');

  await idbDeleteBlob('blob-img-1');
  const afterDeleteBlob = await idbGetBlob('blob-img-1');
  assert.strictEqual(afterDeleteBlob, undefined, '删除后应返回 undefined');
  console.log('✅ 4. 二进制 Blob 存取与隔离销毁验证通过');

  // --- 阶段 5: 容量度量与分析器断言 ---
  console.log('--- 测试 5: 存储容量与分析器度量计算 ---');
  await idbSaveFiles(sampleFiles);
  await idbSaveBlob('blob-pdf-1', dummyBuffer);

  const stats = await idbGetStorageStats();
  assert.strictEqual(stats.supported, true);
  assert.strictEqual(stats.fileCount, 2);
  assert.strictEqual(stats.blobCount, 1);
  assert.ok(stats.totalEstimatedBytes > 50, '容量字节估算应大于 50 字节');
  console.log(`✅ 5. 存储分析器指标正常 (文件数: ${stats.fileCount}, Blob: ${stats.blobCount}, 估算字节: ${stats.totalEstimatedBytes})`);

  // --- 阶段 6: fileStorage Gateway 双层平滑迁移集成测试 ---
  console.log('--- 测试 6: 从 LocalStorage 旧数据自动平滑迁移至 IndexedDB ---');
  // 模拟用户在 LocalStorage 中有旧文件
  await idbClearFiles();
  memoryLocalStorage.clear();

  const legacyFiles = [
    {
      id: 'legacy-doc-1',
      name: 'migrated.md',
      path: '/workspace/migrated.md',
      extension: 'md',
      content: '# Migrated from LocalStorage',
      size: 28,
      lastModified: 1699999999000,
      isModified: false,
      isCustomUploaded: true,
    },
  ];
  mockLocalStorage.setItem('omniview:workbench:files:v2', JSON.stringify(legacyFiles));

  // 触发异步初始化水合
  const initializedFiles = await initStorageAsync();
  assert.ok(initializedFiles.some(f => f.id === 'legacy-doc-1'), '旧版文件应被成功迁移并合并');
  assert.strictEqual(mockLocalStorage.getItem('omniview:workbench:idb_migrated:v1'), 'true', '应标记迁移成功');

  // 验证 IndexedDB 里面是否也已经落盘
  const dbAfterMigration = await idbLoadFiles();
  assert.ok(dbAfterMigration.some(f => f.id === 'legacy-doc-1'), 'IndexedDB 中已完整落盘迁移数据');
  console.log('✅ 6. 跨版本自动无感数据平滑迁移全部通过');

  console.log('🎉 所有 IndexedDB 本地持久化与双层存储架构全量单元测试 100% 通过！');
}

runTests().catch((err) => {
  console.error('❌ IndexedDB 单元测试失败:', err);
  process.exit(1);
});
