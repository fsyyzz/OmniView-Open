/**
 * OmniView 视口基于光标位置缩放 (Focal Point Zoom) 单元测试
 */
import assert from 'node:assert';
import {
  calculateFocalZoom,
  calculateWheelFactor,
  getNextZoomIn,
  getNextZoomOut,
  LIGHTBOX_MIN_ZOOM,
  LIGHTBOX_MAX_ZOOM,
} from '../src/features/viewers/lib/focalZoom.ts';

console.log('🧪 开始 Lightbox 光标锚点缩放 (Focal Point Zoom) 核心算法单元测试...');

console.log('--- 测试 1: 滚轮因子与触控板连续缩放判定 ---');
const discreteIn = calculateWheelFactor(-100, false);
assert.strictEqual(discreteIn, 1.15, '鼠标向上滚轮应获得 1.15 放大系数');

const discreteOut = calculateWheelFactor(100, false);
assert.strictEqual(discreteOut, 0.87, '鼠标向下滚轮应获得 0.87 缩小系数');

const pinchZoomIn = calculateWheelFactor(-10, true);
assert.ok(pinchZoomIn > 1 && pinchZoomIn < 1.2, `触控板捏合放大应连续指数平滑，当前: ${pinchZoomIn}`);

const pinchZoomOut = calculateWheelFactor(10, true);
assert.ok(pinchZoomOut < 1 && pinchZoomOut > 0.8, `触控板捏合缩小应连续指数平滑，当前: ${pinchZoomOut}`);
console.log('✅ 滚轮因子与触控板连续缩放测试通过');

console.log('--- 测试 2: 响应式单步缩放阶梯推导 ---');
assert.strictEqual(getNextZoomIn(0.2), 0.3, '< 0.5 时按 0.1 步进递增');
assert.strictEqual(getNextZoomIn(1.0), 1.25, '< 2 时按 0.25 步进递增');
assert.strictEqual(getNextZoomIn(3.0), 3.5, '< 5 时按 0.5 步进递增');
assert.strictEqual(getNextZoomIn(19.0), 20.0, '最大缩放比不能超过 20');

assert.strictEqual(getNextZoomOut(0.4), 0.3, '<= 0.5 时按 0.1 步进递减');
assert.strictEqual(getNextZoomOut(1.5), 1.25, '<= 2 时按 0.25 步进递减');
assert.strictEqual(getNextZoomOut(4.0), 3.5, '<= 5 时按 0.5 步进递减');
assert.strictEqual(getNextZoomOut(0.06), 0.05, '最小缩放比不能小于 0.05');
console.log('✅ 响应式单步缩放阶梯测试通过');

console.log('--- 测试 3: 核心几何不变性 (Focal Invariance: 光标所指内容像素零位移) ---');
const containerRect = { left: 100, top: 50, width: 1000, height: 800 };
const stageCenter = {
  x: containerRect.left + containerRect.width / 2, // 600
  y: containerRect.top + containerRect.height / 2,  // 450
};

// 任意选定一个偏离屏幕中心的鼠标光标位置
const cursor = { clientX: 750, clientY: 300 };

// 初始状态：zoom = 1, pan = (0, 0)
const initial = { zoom: 1, pan: { x: 0, y: 0 } };

// 计算初始光标所指在内容图表内部的局部相对坐标
const contentLocalX = (cursor.clientX - stageCenter.x - initial.pan.x) / initial.zoom; // 750 - 600 = 150
const contentLocalY = (cursor.clientY - stageCenter.y - initial.pan.y) / initial.zoom; // 300 - 450 = -150

// 模拟放大至 2.5x
const zoomedState = calculateFocalZoom(initial, 2.5, cursor, containerRect);
assert.strictEqual(zoomedState.zoom, 2.5, '缩放后 zoom 应为 2.5');

// 缩放后，同一内部内容点在屏幕上的映射位置：
const mappedScreenX = stageCenter.x + zoomedState.pan.x + zoomedState.zoom * contentLocalX;
const mappedScreenY = stageCenter.y + zoomedState.pan.y + zoomedState.zoom * contentLocalY;

assert.ok(Math.abs(mappedScreenX - cursor.clientX) < 0.2, `缩放后 X 坐标必须与光标一致 (预期 ${cursor.clientX}, 实际 ${mappedScreenX})`);
assert.ok(Math.abs(mappedScreenY - cursor.clientY) < 0.2, `缩放后 Y 坐标必须与光标一致 (预期 ${cursor.clientY}, 实际 ${mappedScreenY})`);
console.log('✅ 单次基于光标放大几何不变性测试通过');

console.log('--- 测试 4: 连续多步缩放光标锚点稳定性 ---');
let current = { zoom: 1.0, pan: { x: 0, y: 0 } };
const focal = { clientX: 820, clientY: 280 };

const steps = [1.2, 1.5, 2.0, 3.2, 2.4, 1.1, 0.8, 1.0];
for (const targetZ of steps) {
  const localX = (focal.clientX - stageCenter.x - current.pan.x) / current.zoom;
  const localY = (focal.clientY - stageCenter.y - current.pan.y) / current.zoom;

  current = calculateFocalZoom(current, targetZ, focal, containerRect);

  const screenX = stageCenter.x + current.pan.x + current.zoom * localX;
  const screenY = stageCenter.y + current.pan.y + current.zoom * localY;

  assert.ok(Math.abs(screenX - focal.clientX) < 0.5, `目标缩放 ${targetZ}x 时 X 坐标漂移超标: ${screenX}`);
  assert.ok(Math.abs(screenY - focal.clientY) < 0.5, `目标缩放 ${targetZ}x 时 Y 坐标漂移超标: ${screenY}`);
}
console.log('✅ 连续 8 步缩放光标锚点无漂移测试通过');

console.log('--- 测试 5: 视口中心缩放特殊情形校验 ---');
const centerCursor = { clientX: stageCenter.x, clientY: stageCenter.y };
const centerZoomed = calculateFocalZoom({ zoom: 1, pan: { x: 0, y: 0 } }, 3.0, centerCursor, containerRect);
assert.strictEqual(centerZoomed.zoom, 3.0);
assert.strictEqual(centerZoomed.pan.x, 0, '中心缩放时 pan.x 应维持 0');
assert.strictEqual(centerZoomed.pan.y, 0, '中心缩放时 pan.y 应维持 0');
console.log('✅ 视口中心缩放特殊情形测试通过');

console.log('\n🎉 所有 Lightbox 光标锚点缩放 (Focal Point Zoom) 算法单元测试 100% 通过！');
