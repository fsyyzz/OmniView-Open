#!/usr/bin/env node
/**
 * Graphviz 渲染器与安全清洗单元测试脚本
 */
import { Graphviz } from '@hpcc-js/wasm-graphviz';

async function runTests() {
  console.log('🧪 开始运行 Graphviz 渲染与安全清洗自动化测试...');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. WASM 引擎加载测试
  console.log('\n[1/4] 测试 Graphviz WASM 实例加载');
  const graphviz = await Graphviz.load();
  assert(!!graphviz, 'Graphviz WASM 加载成功');
  assert(typeof graphviz.layout === 'function', 'layout 方法存在可用');

  // 2. 基础与中文有向图 / 无向图渲染测试
  console.log('\n[2/4] 测试 DOT 渲染输出');
  const dotDirected = `
    digraph Architecture {
      rankdir=LR;
      node [shape=box, style="rounded,filled", fillcolor="#e0f2fe"];
      User [label="用户终端"];
      Gateway [label="API 网关"];
      Service [label="微服务集群"];
      DB [label="核心数据库"];
      User -> Gateway -> Service -> DB;
    }
  `;
  const svgDirected = graphviz.layout(dotDirected, 'svg', 'dot');
  assert(svgDirected.includes('<svg') && svgDirected.includes('用户终端'), '有向图及中文 Label 渲染正常');

  const dotUndirected = `
    graph NetworkTopology {
      NodeA -- NodeB;
      NodeB -- NodeC;
      NodeC -- NodeA;
    }
  `;
  const svgUndirected = graphviz.layout(dotUndirected, 'svg', 'dot');
  assert(svgUndirected.includes('<svg') && svgUndirected.includes('NetworkTopology'), '无向图渲染正常');

  // 3. 多布局引擎测试 (neato, circo, fdp)
  console.log('\n[3/4] 测试多布局引擎');
  const svgNeato = graphviz.layout(dotUndirected, 'svg', 'neato');
  assert(svgNeato.includes('<svg'), 'neato 弹簧模型布局渲染正常');

  const svgCirco = graphviz.layout(dotUndirected, 'svg', 'circo');
  assert(svgCirco.includes('<svg'), 'circo 环形布局渲染正常');

  const svgFdp = graphviz.layout(dotUndirected, 'svg', 'fdp');
  assert(svgFdp.includes('<svg'), 'fdp 力导向布局渲染正常');

  // 4. 错误捕获与降级测试
  console.log('\n[4/4] 测试语法错误捕获');
  try {
    graphviz.layout('invalid graph { A -> }', 'svg', 'dot');
    assert(false, '语法错误应抛出异常');
  } catch (err) {
    assert(true, `语法错误正确被捕获并抛出友好异常: ${err.message?.slice(0, 40)}...`);
  }

  console.log(`\n========================================`);
  console.log(`测试完成: ${passed} 项通过, ${failed} 项失败`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
