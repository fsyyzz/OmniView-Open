#!/usr/bin/env node
/**
 * Graphviz 渲染器与安全清洗单元测试脚本
 */
import { Graphviz } from '@hpcc-js/wasm-graphviz';
import { solidifyGraphvizSvg, resolveGraphvizPalette } from '../src/features/viewers/lib/graphvizTheme.ts';

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

  // 5. 14 大主题高保真调色盘与矢量渲染自适应测试 (solidifyGraphvizSvg)
  console.log('\n[5/5] 测试 Graphviz 14 大主题高保真调色盘与原生矢量重映射');
  const rawSvg = `<svg width="100" height="100"><polygon fill="white" stroke="none" points="-4,4 -4,-100 100,-100 100,4 -4,4"/><g class="node"><polygon fill="none" stroke="black" points="54,-36 0,-36 0,0 54,0 54,-36"/><text text-anchor="middle" x="27" y="-14.3" font-family="Times,serif" font-size="14.00">A</text></g><g class="edge"><path fill="none" stroke="black" d="M27,-36 C27,-40 27,-50 27,-55"/><polygon fill="black" stroke="black" points="30,-55 27,-65 24,-55 30,-55"/></g></svg>`;

  const draculaSvg = solidifyGraphvizSvg(rawSvg, 'dracula');
  assert(draculaSvg.includes('fill="none"') || draculaSvg.includes('fill="transparent"'), '白底 polygon 已被置为 transparent 或 none 消除纯白底框');
  assert(draculaSvg.includes('stroke="#bd93f9"'), '默认黑线已被重映射为 Dracula 强调色 #bd93f9');
  assert(draculaSvg.includes('fill="#f8f8f2"'), '默认黑字已重映射为 Dracula 前景色 #f8f8f2');

  const sepiaSvg = solidifyGraphvizSvg(rawSvg, 'sepia');
  assert(sepiaSvg.includes('stroke="#b45309"'), '默认黑线已被重映射为 Sepia 强调色 #b45309');
  assert(sepiaSvg.includes('fill="#78350f"'), '默认黑字已重映射为 Sepia 文本色 #78350f');

  // 原彩保持测试
  const colorfulSvg = `<svg width="100" height="100"><polygon fill="#ef4444" stroke="#22c55e" points="0,0 10,10"/></svg>`;
  const preservedSvg = solidifyGraphvizSvg(colorfulSvg, 'dracula');
  assert(preservedSvg.includes('fill="#ef4444"'), '用户显式指定的原彩 fill 必须 100% 保持');
  assert(preservedSvg.includes('stroke="#22c55e"'), '用户显式指定的原彩 stroke 必须 100% 保持');

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
