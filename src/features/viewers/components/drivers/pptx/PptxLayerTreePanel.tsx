import React from 'react';
import {
  Layers,
  Type,
  Shapes,
  Image as ImageIcon,
  Table2,
  BarChart3,
  FolderTree,
  Minus,
} from 'lucide-react';
import type { PptxElement } from '../../../lib/pptxEngine';

export interface PptxLayerTreePanelProps {
  elements: PptxElement[];
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string | null) => void;
  locale?: string;
}

const SHAPE_LABEL_ZH: Record<string, string> = {
  rect: '矩形',
  roundRect: '圆角矩形',
  snip1Rect: '单切角矩形',
  snip2SameRect: '同侧双切角矩形',
  snip2DiagRect: '对角双切角矩形',
  round2SameRect: '同侧圆角矩形',
  round2DiagRect: '对角圆角矩形',
  plaque: '铭牌多边形',
  foldedCorner: '折角矩形',
  frame: '画框',
  ellipse: '椭圆',
  donut: '同心圆环',
  pie: '扇形',
  blockArc: '空心弧',
  can: '圆柱体',
  cube: '立方体',
  teardrop: '泪滴形',
  triangle: '等腰三角形',
  rtTriangle: '直角三角形',
  parallelogram: '平行四边形',
  trapezoid: '梯形',
  diamond: '菱形',
  pentagon: '正五边形',
  homePlate: '五边箭头块',
  hexagon: '正六边形',
  heptagon: '正七边形',
  octagon: '正八边形',
  decagon: '正十边形',
  dodecagon: '正十二边形',
  star4: '四角星',
  star5: '五角星',
  star: '星形',
  star6: '六角星',
  star8: '八角星',
  star10: '十角星',
  star12: '十二角星',
  star16: '十六角星',
  star24: '二十四角星',
  star32: '三十二角星',
  chevron: '燕尾箭头',
  rightArrow: '右向箭头',
  leftArrow: '左向箭头',
  upArrow: '上向箭头',
  downArrow: '下向箭头',
  leftRightArrow: '左右双向箭头',
  upDownArrow: '上下双向箭头',
  quadArrow: '四向箭头',
  notchedRightArrow: '缺口右箭头',
  stripedRightArrow: '条纹右箭头',
  bentArrow: '直角弯箭头',
  uturnArrow: 'U 形回转箭头',
  plus: '十字形',
  heart: '心形',
  lightningBolt: '闪电形',
  sun: '太阳形',
  moon: '新月形',
  cloud: '云朵形',
  wave: '波浪形',
  ribbon: '彩带横幅',
  callout: '标注框',
  line: '直线',
  connector: '连接线',
  custom: '自定义多边形',
};

function renderElementIcon(el: PptxElement) {
  if (el.type === 'text') return <Type className="w-3.5 h-3.5 shrink-0" />;
  if (el.type === 'image') return <ImageIcon className="w-3.5 h-3.5 shrink-0" />;
  if (el.type === 'table') return <Table2 className="w-3.5 h-3.5 shrink-0" />;
  if (el.type === 'chart') return <BarChart3 className="w-3.5 h-3.5 shrink-0" />;
  if (el.shapeType === 'line' || el.shapeType === 'connector') {
    return <Minus className="w-3.5 h-3.5 shrink-0" />;
  }
  return <Shapes className="w-3.5 h-3.5 shrink-0" />;
}

function describeElement(el: PptxElement, isEn: boolean): string {
  if (el.name) return el.name;
  if (el.type === 'text' && el.paragraphs?.length) {
    const t = el.paragraphs[0].runs.map(r => r.text).join('').trim();
    if (t) return t.slice(0, 26);
  }
  if (el.shapeType) {
    return isEn ? el.shapeType : SHAPE_LABEL_ZH[el.shapeType] || el.shapeType;
  }
  return el.type;
}

export const PptxLayerTreePanel: React.FC<PptxLayerTreePanelProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  locale = 'zh-CN',
}) => {
  const isEn = locale === 'en-US';

  // 从视觉顶层到底层倒序排列（栈顶前景在上，母版与底板在下）
  const descending = [...elements].reverse();

  const foreground = descending.filter(
    el => el.layerTier !== 'master' && el.layerTier !== 'layout' && !el.isBackgroundShape
  );
  const backdrop = descending.filter(el => el.isBackgroundShape);
  const layoutEls = descending.filter(el => el.layerTier === 'layout');
  const masterEls = descending.filter(el => el.layerTier === 'master');

  const sections: Array<{
    key: string;
    title: string;
    items: PptxElement[];
  }> = [
    {
      key: 'fg',
      title: isEn ? `Foreground Elements (${foreground.length})` : `前景图元层 (${foreground.length})`,
      items: foreground,
    },
    {
      key: 'bg',
      title: isEn ? `Canvas Backdrop (${backdrop.length})` : `画布底板层 (${backdrop.length})`,
      items: backdrop,
    },
    {
      key: 'layout',
      title: isEn ? `Slide Layout (${layoutEls.length})` : `版式装饰层 (${layoutEls.length})`,
      items: layoutEls,
    },
    {
      key: 'master',
      title: isEn ? `Slide Master (${masterEls.length})` : `母版底层 (${masterEls.length})`,
      items: masterEls,
    },
  ].filter(sec => sec.items.length > 0);

  return (
    <div className="flex flex-col gap-2.5 text-xs" data-testid="pptx-layer-tree">
      <div
        className="px-2 py-1.5 rounded-lg border flex items-center justify-between"
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
        }}
      >
        <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--ov-text)' }}>
          <Layers className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
          {isEn ? 'Element Hierarchy' : '页面元素层级'}
        </span>
        <span className="font-mono text-[10px]">
          {isEn ? `${elements.length} nodes` : `${elements.length} 项`}
        </span>
      </div>

      {sections.length === 0 ? (
        <div className="py-6 text-center opacity-60 text-[11px]">
          {isEn ? 'No elements on this slide' : '当前幻灯片暂无可见图元'}
        </div>
      ) : (
        sections.map(sec => (
          <div key={sec.key} className="space-y-1">
            <div
              className="px-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between"
              style={{ color: 'var(--ov-text-secondary)' }}
            >
              <span>{sec.title}</span>
              <span>Z-Order</span>
            </div>
            <div className="space-y-1">
              {sec.items.map(el => {
                const isSelected = selectedElementId === el.id;
                const shapeTag =
                  el.shapeType && el.shapeType !== 'rect'
                    ? isEn
                      ? el.shapeType
                      : SHAPE_LABEL_ZH[el.shapeType] || el.shapeType
                    : undefined;
                const hasGroup = Boolean(el.groupPath && el.groupPath.length > 0);

                return (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => onSelectElement?.(isSelected ? null : el.id)}
                    className="w-full px-2 py-1.5 rounded-lg border text-left transition flex flex-col gap-0.5"
                    style={{
                      backgroundColor: isSelected ? 'var(--ov-accent-subtle)' : 'var(--ov-surface)',
                      borderColor: isSelected ? 'var(--ov-accent)' : 'var(--ov-border-subtle)',
                      color: 'var(--ov-text)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span style={{ color: isSelected ? 'var(--ov-accent)' : 'var(--ov-text-secondary)' }}>
                          {renderElementIcon(el)}
                        </span>
                        <span className="truncate font-medium text-[11px]">
                          {describeElement(el, isEn)}
                        </span>
                      </div>
                      <span
                        className="font-mono text-[10px] px-1 rounded border shrink-0"
                        style={{
                          backgroundColor: 'var(--ov-bg)',
                          borderColor: 'var(--ov-border-subtle)',
                          color: 'var(--ov-text-secondary)',
                        }}
                      >
                        Z{el.zIndex ?? '-'}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-between gap-1 text-[10px] font-mono pl-5"
                      style={{ color: 'var(--ov-text-secondary)' }}
                    >
                      <span className="truncate flex items-center gap-1">
                        {hasGroup && (
                          <span className="inline-flex items-center gap-0.5 opacity-80">
                            <FolderTree className="w-2.5 h-2.5" />
                            {el.groupPath!.join(' › ')}
                          </span>
                        )}
                        {!hasGroup && shapeTag && <span>{shapeTag}</span>}
                        {!hasGroup && !shapeTag && <span>{el.type}</span>}
                      </span>
                      <span className="shrink-0">
                        {Math.round(el.width)}×{Math.round(el.height)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
