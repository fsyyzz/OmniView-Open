/**
 * OmniView SVG 编辑引擎 v2 — 文档模型核心类型契约 (ADR-0001)
 *
 * 本文件**仅声明类型契约**，不包含任何运行时实现。后续 M2 阶段在
 * `core/model/{document,node,selection,snapshot,geometry,path}.ts` 中提供实现。
 *
 * 设计参考：VectorCraft `crates/doc/src/{node,document,selection}.rs`，
 * 适配 OmniView 浏览器侧 Webview 与 SVG 单一格式约束。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md
 */

// ============================================================================
// 1. 节点 ID 与基础标识
// ============================================================================

/**
 * 全局唯一的节点 ID（单调递增整数）。同一文档内永不重用，与 VectorCraft
 * 的 `vectorcraft_doc::NodeId` 对齐。撤销栈引用 ID 而非对象引用，保证
 * 跨 snapshot 的安全比较。
 */
export type NodeId = number & { readonly __brand: 'NodeId' };

/** 创建新的 NodeId（运行时由 Document 持有计数器分配）。 */
export declare function allocNodeId(raw: number): NodeId;

/**
 * 字符串形式的稳定 ID（导出 SVG 时作为 `id="…"` 属性）。由 Document 在
 * export 阶段从 NodeId 派生，保证：同一节点跨 export 字符串稳定；不同
 * 文档间绝不冲突（带文档短哈希前缀）。
 */
export type StableId = string;

// ============================================================================
// 2. 节点种类 (NodeKind)
// ============================================================================

/**
 * 节点种类枚举。命名与 SVG 标签基本对齐，但语义上做了归一化：
 * - `Group`：对应 `<g>` 与隐式容器
 * - `Path`：`<path>`、`<rect>`、`<circle>`、`<ellipse>`、`<line>`、`<polyline>`、`<polygon>` 全部归一为 Path（含几何 + 填充/描边符号）
 * - `Text`：`<text>` / `<tspan>`（P1 暂作只读）
 * - `Image`：`<image>`（P1 暂作只读）
 * - `Use`：`<use>`（P1 暂作只读，保留接口给 P2）
 * - `Layer`：顶层图层（必有 name、color、visible、locked）
 */
export type NodeKind =
  | 'Layer'
  | 'Group'
  | 'Path'
  | 'Text'
  | 'Image'
  | 'Use';

// ============================================================================
// 3. 几何 (Geometry)
// ============================================================================

/** 二维向量（点 / 偏移）。 */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** 仿射变换矩阵 [a b c d e f]。与 SVG `transform="matrix(a b c d e f)"` 同构。 */
export interface AffineTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/** 轴对齐矩形。 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 路径几何（参考 VectorCraft `vectorcraft_geom::BezPath`）。
 * 单一连续路径由若干 SubPath 组成；每个 SubPath 由若干 Anchor 组成；
 * Anchor 含位置 + 入/出控制柄 + 类型（corner/smooth/symmetric）。
 *
 * P1 阶段 import 时由 usvg-wasm 把 transform 烘焙到几何上；运行时操作
 * 只改 Anchor 集合，不改 matrix。
 */
export interface PathGeometry {
  readonly subPaths: ReadonlyArray<SubPath>;
}

export interface SubPath {
  readonly anchors: ReadonlyArray<Anchor>;
  readonly closed: boolean;
}

export type AnchorKind = 'corner' | 'smooth' | 'symmetric';

export interface Anchor {
  readonly point: Vec2;
  /** 入控制柄（相对 point 的偏移）。corner 可为 null。 */
  readonly handleIn: Vec2 | null;
  /** 出控制柄（相对 point 的偏移）。corner 可为 null。 */
  readonly handleOut: Vec2 | null;
  readonly kind: AnchorKind;
}

/** 路径单位：像素 (px)、磅 (pt)、毫米 (mm)、百分比 (%)。P1 仅 px。 */
export type LengthUnit = 'px' | 'pt' | 'mm' | 'percent';

// ============================================================================
// 4. 外观 (Appearance)
// ============================================================================

/** 颜色模型（与 CSS Color Module Level 4 对齐，P1 仅支持 hex / rgb / rgba）。 */
export type Color = string;

/**
 * 填充。`none` = 无填充；`solid` = 单色；`url(#id)` = 渐变/图案引用（export
 * 阶段由 export 模块决定如何展开）。P1 仅实现 solid + 线性/径向渐变。
 */
export type Fill =
  | { readonly type: 'none' }
  | { readonly type: 'solid'; readonly color: Color; readonly opacity: number }
  | { readonly type: 'gradient'; readonly id: StableId }
  | { readonly type: 'pattern'; readonly id: StableId };

/** 描边。语义同 Fill；额外含宽度、线帽、线交、虚线模式、对齐。 */
export interface Stroke {
  readonly paint: Fill;
  readonly width: number;
  readonly widthUnit: LengthUnit;
  readonly cap: 'butt' | 'round' | 'square';
  readonly join: 'miter' | 'round' | 'bevel';
  readonly miterLimit: number;
  readonly dashArray: readonly number[] | null;
  readonly dashOffset: number;
  readonly alignment: 'center' | 'inside' | 'outside';
}

/** 混合模式（CSS Compositing Level 1）。 */
export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

/** 单个外观层（fill/stroke/effect）。多个 AppearanceItem 组成 Appearance。 */
export type AppearanceItem =
  | { readonly kind: 'fill'; readonly fill: Fill; readonly blend: BlendMode; readonly opacity: number }
  | { readonly kind: 'stroke'; readonly stroke: Stroke; readonly blend: BlendMode; readonly opacity: number }
  | { readonly kind: 'effect'; readonly effectId: StableId; readonly params: Readonly<Record<string, unknown>> };

/** 图元外观（VectorCraft `vectorcraft_doc::Appearance` 对齐）。 */
export interface Appearance {
  readonly items: ReadonlyArray<AppearanceItem>;
}

// ============================================================================
// 5. 节点 (Node)
// ============================================================================

/** 节点公共字段。 */
export interface NodeBase {
  readonly id: NodeId;
  readonly kind: NodeKind;
  readonly name: string | null;
  /** 局部变换（相对父节点坐标系）。P1 默认 identity。 */
  readonly transform: AffineTransform;
  readonly opacity: number;
  readonly blend: BlendMode;
  readonly visible: boolean;
  readonly locked: boolean;
  /** 子节点 ID 列表（Group / Layer 才有）。Path/Text/Image/Use 为空。 */
  readonly children: ReadonlyArray<NodeId>;
}

export interface LayerNode extends NodeBase {
  readonly kind: 'Layer';
  readonly children: ReadonlyArray<NodeId>;
  /** 图层色标签（Illustrator 风格），便于在面板中辨识。 */
  readonly colorTag: LayerColorTag;
}

export interface GroupNode extends NodeBase {
  readonly kind: 'Group';
  readonly children: ReadonlyArray<NodeId>;
  readonly appearance: Appearance;
}

export interface PathNode extends NodeBase {
  readonly kind: 'Path';
  readonly geometry: PathGeometry;
  readonly appearance: Appearance;
  /** 导出时映射回 SVG 标签：`path` / `rect` / `circle` / `ellipse` / `line` / `polyline` / `polygon`。 */
  readonly primitiveHint: 'path' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon';
}

export interface TextNode extends NodeBase {
  readonly kind: 'Text';
  readonly text: string;
  readonly appearance: Appearance;
  /** P1 暂作只读；预留字段给 P2。 */
  readonly _reserved?: never;
}

export interface ImageNode extends NodeBase {
  readonly kind: 'Image';
  readonly href: string;
  readonly width: number;
  readonly height: number;
  readonly appearance: Appearance;
  readonly _reserved?: never;
}

export interface UseNode extends NodeBase {
  readonly kind: 'Use';
  readonly symbolId: NodeId;
  readonly appearance: Appearance;
  readonly _reserved?: never;
}

export type Node = LayerNode | GroupNode | PathNode | TextNode | ImageNode | UseNode;

/** 图层色标签（Illustrator 风格 7 色循环）。 */
export type LayerColorTag =
  | 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

// ============================================================================
// 6. 选择 (Selection)
// ============================================================================

/**
 * 当前选择。P1 仅节点级选择；P2 可扩展为路径子选择（单 Anchor / 多 Anchor /
 * 区间段）。
 */
export interface Selection {
  readonly nodeIds: ReadonlyArray<NodeId>;
  /** 主选中节点（panel 高亮、Gizmo 跟随）。多选时 = `nodeIds[0]`。 */
  readonly primaryId: NodeId | null;
}

// ============================================================================
// 7. 文档 (Document)
// ============================================================================

/** 文档画布尺寸与单位。 */
export interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly unit: LengthUnit;
  readonly viewBox: Rect | null;
}

/** 文档根（VectorCraft `vectorcraft_doc::Document` 对齐）。 */
export interface Document {
  readonly canvas: Canvas;
  /** 顶层图层 ID 列表（顺序 = z-order 渲染顺序）。 */
  readonly layers: ReadonlyArray<NodeId>;
  /** 所有节点（id → Node）。包含 Layer/Group/Path/Text/Image/Use。 */
  readonly nodes: ReadonlyMap<NodeId, Node>;
  /** 单调递增 ID 计数器（export/serialization 用）。 */
  readonly nextNodeId: number;
  /** 元数据（保留给 SVG `<metadata>` 块）。 */
  readonly metadata: Readonly<Record<string, string>>;
  /** 撤销/重做的内部字段（运行时持有，UI 不直接读）。 */
  readonly _internal: DocumentInternal;
}

/** 文档内部字段（计数器、计数器缓存、版本号）。 */
export interface DocumentInternal {
  readonly revision: number;
}

// ============================================================================
// 8. 历史 / 快照 (History & Snapshot)
// ============================================================================

/** 单条撤销记录。参考 VectorCraft `crates/engine/src/lib.rs:60-90`。 */
export interface HistoryEntry {
  /** 撤销 UI 上显示的标签（如 "Move Selection"、"Set Fill"）。 */
  readonly label: string;
  /** 该步骤执行前的快照（undo 回到这里）。 */
  readonly docBefore: Document;
  /** 该步骤执行后的快照（redo 回到这里）。 */
  readonly docAfter: Document;
  /** 该步骤执行前的选择（undo 时同步恢复）。 */
  readonly selectionBefore: Selection;
  /** 该步骤执行后的选择。 */
  readonly selectionAfter: Selection;
}

/** 撤销栈状态。 */
export interface History {
  readonly undo: ReadonlyArray<HistoryEntry>;
  readonly redo: ReadonlyArray<HistoryEntry>;
  /** Illustrator 无硬上限；快照成本由结构共享保证。本字段为软上限 = 0 表示不限。 */
  readonly limit: number;
}

// ============================================================================
// 9. 工具输入 / 事件 (Pointer)
// ============================================================================

/** 修饰键（参考 VectorCraft `vectorcraft_tools::Mods`）。 */
export interface ToolMods {
  readonly shift: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
  readonly ctrl: boolean;
  readonly space: boolean;
}

/** 指针事件。 */
export interface PointerEvent {
  readonly kind: 'down' | 'drag' | 'up' | 'move' | 'doubleClick';
  /** 画布坐标系（已应用 zoom/pan 反变换）。 */
  readonly point: Vec2;
  readonly mods: ToolMods;
  readonly pressure: number;
}

/** 键盘事件（工具关心的键；其余由 UI 处理）。 */
export type ToolKey =
  | 'Enter' | 'Escape' | 'Backspace' | 'Delete'
  | 'Up' | 'Down' | 'Left' | 'Right'
  | 'Tab' | 'Home' | 'End';

/** 工具关心的上下文（参考 VectorCraft `vectorcraft_tools::ToolContext`）。 */
export interface ToolContext {
  readonly doc: Document;
  readonly selection: Selection;
  /** 屏幕 1 像素对应的文档长度。 */
  readonly zoom: number;
  readonly fillActive: boolean;
  readonly constrainAngle: number;
  readonly snapToGrid: boolean;
  readonly snapToPoint: boolean;
  readonly snapTolerance: number;
}