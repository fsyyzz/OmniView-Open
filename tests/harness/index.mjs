/**
 * OmniView — 统一测试工具库总入口 (Test Harness Entrypoint)
 */
import assert from 'node:assert';

export { setupDomEnvironment, cleanupDomEnvironment } from './dom-env.mjs';
export { bundleAndLoadTsx } from './module-loader.mjs';
export { discoverSuites } from './discovery.mjs';

/**
 * 轻量化套件级 Runner 状态与助手
 */
class TestSuiteContext {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.currentSuite = '';
  }

  describe(name, fn) {
    this.currentSuite = name;
    console.log(`\n--- ${name} ---`);
    if (typeof fn === 'function') {
      const res = fn();
      if (res && typeof res.then === 'function') {
        return res;
      }
    }
  }

  async it(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      this.passed++;
    } catch (e) {
      console.error(`  ❌ ${name} -`, e instanceof Error ? e.message : e);
      if (e instanceof Error && e.stack) {
        console.error(e.stack.split('\n').slice(1, 4).join('\n'));
      }
      this.failed++;
    }
  }

  summary(suiteTitle = '测试套件') {
    const total = this.passed + this.failed;
    console.log(`\n📊 ${suiteTitle} 执行汇总: ${this.passed} 通过, ${this.failed} 失败, 共 ${total} 项`);
    if (this.failed > 0) {
      process.exitCode = 1;
    }
    return { passed: this.passed, failed: this.failed, total };
  }
}

const defaultContext = new TestSuiteContext();

export const describe = (name, fn) => defaultContext.describe(name, fn);
export const it = (name, fn) => defaultContext.it(name, fn);
export const test = it;
export const reportSummary = (title) => defaultContext.summary(title);
export { assert };
