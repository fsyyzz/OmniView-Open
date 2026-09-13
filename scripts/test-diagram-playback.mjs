import assert from 'node:assert';
import {
  detectDiagramPlaybackSupport,
  extractDiagramSteps,
  applyStepHighlightToSvg,
} from '../src/features/viewers/lib/diagramPlaybackEngine.ts';

console.log('🧪 开始图表步进播放引擎 (Diagram Step Player Engine) 单元测试...');

// 测试 1: Mermaid 时序图 (Sequence Diagram) 步骤提取
console.log('--- 测试 1: Mermaid 时序图消息与 Note 提取 ---');
const seqCode = `
sequenceDiagram
  autonumber
  participant User as 用户
  participant Auth as 认证中心
  participant DB as 数据库
  User->>Auth: 1. 提交账号密码 (POST /login)
  Note over Auth: 校验 Hash 密码与防重放 Token
  Auth->>DB: 2. 查询用户凭证
  DB-->>Auth: 3. 返回用户信息
  Auth-->>User: 4. 下发 JWT AccessToken
`;

const seqResult = detectDiagramPlaybackSupport(seqCode);
assert.strictEqual(seqResult.isSupported, true, '时序图必须被正确识别为支持步进播放');
assert.strictEqual(seqResult.diagramType, 'sequence', '图表类型必须为 sequence');
assert.strictEqual(seqResult.stepCount, 5, `应提取出 5 个有序步骤，实际提取到 ${seqResult.stepCount}`);

assert.strictEqual(seqResult.steps[0].from, 'User');
assert.strictEqual(seqResult.steps[0].to, 'Auth');
assert.strictEqual(seqResult.steps[1].type, 'note');
assert.strictEqual(seqResult.steps[2].to, 'DB');
assert.strictEqual(seqResult.steps[3].from, 'DB');
assert.strictEqual(seqResult.steps[4].to, 'User');

console.log(`✅ 时序图步骤提取通过 (共 ${seqResult.stepCount} 步)`);

// 测试 2: Mermaid 状态机图 (State Diagram) 迁移步骤提取
console.log('--- 测试 2: Mermaid 状态图状态机迁移步骤提取 ---');
const stateCode = `
stateDiagram-v2
  [*] --> Idle: 系统冷启动就绪
  Idle --> Compiling: 触发源码变更事件
  Compiling --> Ready: AST 编译完成
  Compiling --> Error: 语法校验异常
  Error --> Compiling: 触发自动修复
  Ready --> [*]: 视口卸载
`;

const stateResult = detectDiagramPlaybackSupport(stateCode);
assert.strictEqual(stateResult.isSupported, true, '状态图必须被正确识别');
assert.strictEqual(stateResult.diagramType, 'state', '图表类型必须为 state');
assert.strictEqual(stateResult.stepCount, 6, `应提取出 6 个状态转移，实际提取到 ${stateResult.stepCount}`);

assert.strictEqual(stateResult.steps[0].from, 'Start(初始)');
assert.strictEqual(stateResult.steps[0].to, 'Idle');
assert.strictEqual(stateResult.steps[1].from, 'Idle');
assert.strictEqual(stateResult.steps[1].to, 'Compiling');
assert.strictEqual(stateResult.steps[5].to, 'End(终止)');

console.log(`✅ 状态图迁移步骤提取通过 (共 ${stateResult.stepCount} 步)`);

// 测试 3: Mermaid 流程图 (Flowchart) 拓扑步骤提取
console.log('--- 测试 3: Mermaid 流程图拓扑步骤提取 ---');
const flowCode = `
flowchart TD
  A[收到 Webhook] --> B{签名校验}
  B -->|校验通过| C[放入 Redis 任务队列]
  C --> D[Worker 异步消费]
`;

const flowResult = detectDiagramPlaybackSupport(flowCode);
assert.strictEqual(flowResult.isSupported, true, '流程图必须被识别');
assert.strictEqual(flowResult.diagramType, 'flowchart', '图表类型必须为 flowchart');
assert.strictEqual(flowResult.stepCount, 3, `应提取出 3 个流转步骤，实际提取到 ${flowResult.stepCount}`);

console.log(`✅ 流程图步骤提取通过 (共 ${flowResult.stepCount} 步)`);

// 测试 4: PlantUML 时序与状态图兼容
console.log('--- 测试 4: PlantUML DSL 时序步进提取 ---');
const pumlCode = `
@startuml
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response
Alice -> Bob: Another authentication Request
Alice <-- Bob: Another authentication Response
@enduml
`;

const pumlResult = detectDiagramPlaybackSupport(pumlCode);
assert.strictEqual(pumlResult.isSupported, true, 'PlantUML 时序图必须支持步进识别');
assert.strictEqual(pumlResult.diagramType, 'plantuml-sequence');
assert.strictEqual(pumlResult.stepCount, 4, `PlantUML 应提取 4 个步骤，实际 ${pumlResult.stepCount}`);

console.log('✅ PlantUML 时序步骤提取通过');

// 测试 5: SVG 动态高亮与渐隐样式注入
console.log('--- 测试 5: SVG 动态高亮样式注入测试 ---');
const mockSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><g class="sequenceDiagram"><path class="messageLine0" d="M0,0 L100,0"/></g></svg>`;

// 未激活步进 (-1) 时应保持原样
const rawOutput = applyStepHighlightToSvg(mockSvg, -1, 5, 'sequence');
assert.strictEqual(rawOutput, mockSvg, '当 step 为 -1 时不应注入高亮样式');

// 激活第 2 步 (index=1)
const highlightedSvg = applyStepHighlightToSvg(mockSvg, 1, 3, 'sequence');
assert.ok(highlightedSvg.includes('id="omniview-step-playback-style"'), '应成功注入步进样式');
assert.ok(highlightedSvg.includes('messageLine1'), '应包含第 2 步的高亮选择器');
assert.ok(highlightedSvg.includes('omniviewStepPulse'), '应包含脉冲发光动画');

console.log('✅ SVG 动态高亮注入与动画帧注入验证通过');

// 测试 6: 边界与容错测试
console.log('--- 测试 6: 边界与容错测试 ---');
const emptyResult = detectDiagramPlaybackSupport('');
assert.strictEqual(emptyResult.isSupported, false);
assert.strictEqual(emptyResult.stepCount, 0);

const pieCode = `
pie title 占比
  "TypeScript" : 70
  "Rust" : 30
`;
const pieResult = detectDiagramPlaybackSupport(pieCode);
assert.strictEqual(pieResult.isSupported, false, '饼图不属于步进播放图表');

console.log('✅ 边界与容错测试全部通过');
console.log('🎉 全部 6 组图表步进播放引擎单元测试 100% 通过！');
