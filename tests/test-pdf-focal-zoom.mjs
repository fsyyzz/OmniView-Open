import assert from 'node:assert';
import {
  MIN_PDF_ZOOM,
  MAX_PDF_ZOOM,
  DEFAULT_PDF_ZOOM,
  PDF_ZOOM_PRESETS,
  calculatePdfWheelZoom,
  calculatePdfFocalScroll,
  getNextPdfZoomIn,
  getNextPdfZoomOut,
  calculateFitWidthZoom,
  calculateFitPageZoom,
  clampPdfZoom,
  calculatePanOffset,
} from '../src/features/viewers/components/drivers/pdf/pdfZoomHelper.ts';

console.log('🧪 开始 PDF 视口无级缩放与光标锚点定位核心单元测试 (PDF Focal Zoom)...');

// 1. 基础常数测试
console.log('--- 测试 1: 缩放阈值常数校验 ---');
assert.strictEqual(MIN_PDF_ZOOM, 25, '最小缩放比应为 25%');
assert.strictEqual(MAX_PDF_ZOOM, 500, '最大缩放比应为 500%');
assert.strictEqual(DEFAULT_PDF_ZOOM, 100, '默认缩放比应为 100%');
console.log('✅ 缩放常数测试通过');

// 2. 滚轮与触控板缩放计算测试
console.log('--- 测试 2: calculatePdfWheelZoom 计算 ---');
// 向上滚动 (deltaY < 0) -> 放大
const zoomedIn = calculatePdfWheelZoom(100, -100, true);
assert(zoomedIn > 100, `向上滚动应当放大，当前: ${zoomedIn}`);
assert.strictEqual(zoomedIn, 115, '大步进滚轮向上滚动步进为 1.15 倍');

// 向下滚动 (deltaY > 0) -> 缩小
const zoomedOut = calculatePdfWheelZoom(100, 100, true);
assert(zoomedOut < 100, `向下滚动应当缩小，当前: ${zoomedOut}`);
assert.strictEqual(zoomedOut, 87, '大步进滚轮向下滚动步进为 0.87 倍');

// 触控板小步进平滑缩放 (小 deltaY)
const trackpadZoomIn = calculatePdfWheelZoom(100, -10, true);
assert(trackpadZoomIn > 100 && trackpadZoomIn < 115, `触控板平滑放大应连续平缓，当前: ${trackpadZoomIn}`);

// 上下边界截断 (Clamping)
const clampedMax = calculatePdfWheelZoom(480, -200, true);
assert.strictEqual(clampedMax, MAX_PDF_ZOOM, '超出最大缩放比应截断至 500%');

const clampedMin = calculatePdfWheelZoom(26, 200, true);
assert.strictEqual(clampedMin, MIN_PDF_ZOOM, '超出最小缩放比应截断至 25%');
console.log('✅ 滚轮与触控板缩放计算测试通过');

// 3. 光标锚点对齐计算测试 (Focal Scroll Invariance)
console.log('--- 测试 3: calculatePdfFocalScroll 光标锚点几何不变性 ---');
const containerRect = { left: 100, top: 50, width: 800, height: 600 };
const cursorClientX = 500; // 光标在屏幕上的位置
const cursorClientY = 350;

const initialScroll = {
  scrollLeft: 200,
  scrollTop: 400,
};

const focalResult = calculatePdfFocalScroll({
  containerRect,
  cursorClientX,
  cursorClientY,
  scrollLeft: initialScroll.scrollLeft,
  scrollTop: initialScroll.scrollTop,
  oldZoom: 100,
  newZoom: 200,
});

// 在 oldZoom 下：
// cursorOffsetX = 500 - 100 = 400
// cursorOffsetY = 350 - 50 = 300
// contentX = 200 + 400 = 600
// contentY = 400 + 300 = 700
// 缩放至 200% 时，该点 content 坐标变为: 600 * 2 = 1200, 700 * 2 = 1400
// 此时为了保持光标依然在视口内的 (400, 300) 处:
// targetScrollLeft = 1200 - 400 = 800
// targetScrollTop = 1400 - 300 = 1100
assert.strictEqual(focalResult.targetScrollLeft, 800, '水平滚动偏移应精确对齐光标锚点');
assert.strictEqual(focalResult.targetScrollTop, 1100, '垂直滚动偏移应精确对齐光标锚点');

// 缩放比例相同则保持原状
const unchangedResult = calculatePdfFocalScroll({
  containerRect,
  cursorClientX: 200,
  cursorClientY: 200,
  scrollLeft: 100,
  scrollTop: 100,
  oldZoom: 150,
  newZoom: 150,
});
assert.strictEqual(unchangedResult.targetScrollLeft, 100);
assert.strictEqual(unchangedResult.targetScrollTop, 100);
console.log('✅ 光标锚点对齐测试通过');

// 4. 单步放大/缩小推导测试
console.log('--- 测试 4: getNextPdfZoomIn / getNextPdfZoomOut 步进阶梯 ---');
assert.strictEqual(getNextPdfZoomIn(100), 125, '100% 放大一级应为 125%');
assert.strictEqual(getNextPdfZoomIn(125), 150, '125% 放大一级应为 150%');
assert.strictEqual(getNextPdfZoomIn(200), 250, '200% 放大一级应为 250%');
assert.strictEqual(getNextPdfZoomIn(500), 500, '达到 500% 时不可再放大');

assert.strictEqual(getNextPdfZoomOut(100), 85, '100% 缩小一级应为 85%');
assert.strictEqual(getNextPdfZoomOut(85), 70, '85% 缩小一级应为 70%');
assert.strictEqual(getNextPdfZoomOut(25), 25, '达到 25% 时不可再缩小');
console.log('✅ 步进阶梯测试通过');

// 5. 适宽与适页缩放计算测试
console.log('--- 测试 5: calculateFitWidthZoom & calculateFitPageZoom ---');
// 单页连续流式模式 (padding 80)
// containerWidth = 1000, available = 920, pageWidth = 595 -> scale = 920 / 595 ≈ 1.546 -> 155%
const fitW = calculateFitWidthZoom(1000, 595, 'continuous');
assert.strictEqual(fitW, 155, '适宽计算应准确');

// 双页模式 (padding 140, baseW = 595 * 2 = 1190)
// containerWidth = 1200, available = 1060 -> 1060 / 1190 ≈ 0.89 -> 89%
const fitWDual = calculateFitWidthZoom(1200, 595, 'dual');
assert.strictEqual(fitWDual, 89, '双页适宽计算应考虑两页并排与内边距');

// 适页模式 (padding 80)
// containerHeight = 900, available = 820, pageHeight = 842 -> 820 / 842 ≈ 0.973 -> 97%
const fitP = calculateFitPageZoom(900, 842);
assert.strictEqual(fitP, 97, '适页计算应准确');
console.log('✅ 适宽与适页计算测试通过');

// 6. 缩放预设列表与边界截断校验
console.log('--- 测试 6: PDF_ZOOM_PRESETS 与 clampPdfZoom ---');
assert(Array.isArray(PDF_ZOOM_PRESETS) && PDF_ZOOM_PRESETS.length >= 8, '缩放预设应至少覆盖 8 档');
assert(PDF_ZOOM_PRESETS.includes(100), '缩放预设必须包含 100% 实际大小');
assert(PDF_ZOOM_PRESETS.includes(50), '缩放预设必须包含 50%');
assert(PDF_ZOOM_PRESETS.includes(200), '缩放预设必须包含 200%');
assert.strictEqual(clampPdfZoom(10), MIN_PDF_ZOOM, '过低缩放截断为 25%');
assert.strictEqual(clampPdfZoom(999), MAX_PDF_ZOOM, '过高缩放截断为 500%');
assert.strictEqual(clampPdfZoom(123.4), 123, '四舍五入为整数');
console.log('✅ 缩放预设与边界截断测试通过');

// 7. 抓手平移 offset 计算测试
console.log('--- 测试 7: calculatePanOffset 抓手漫游几何平移 ---');
const pan1 = calculatePanOffset(100, 200, 50, 40);
assert.strictEqual(pan1.scrollLeft, 50, '水平向右拖拽 50px，滚动视口反向平移');
assert.strictEqual(pan1.scrollTop, 160, '垂直向下拖拽 40px，滚动视口反向平移');

const panClamped = calculatePanOffset(20, 20, 100, 100);
assert.strictEqual(panClamped.scrollLeft, 0, '滚动位置不应小于 0');
assert.strictEqual(panClamped.scrollTop, 0, '滚动位置不应小于 0');
console.log('✅ 抓手漫游平移几何测试通过');

console.log('🎉 所有 PDF 视口缩放与锚点定位测试 100% 顺利通过！');

