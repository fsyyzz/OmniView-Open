/**
 * PlantUML URL / 空图防护契约测试
 */
import assert from 'node:assert/strict';
import {
  hasRenderablePlantUmlCode,
  getPlantUmlSvgUrl,
  withPlantUmlCacheBust,
  encodePlantUml,
  preparePlantUmlCode,
} from '../src/shared/lib/plantuml';

console.log('🧪 开始 PlantUML 编码与空图防护测试...');

assert.equal(hasRenderablePlantUmlCode(''), false);
assert.equal(hasRenderablePlantUmlCode('   \n  '), false);
assert.equal(hasRenderablePlantUmlCode('@startuml\n@enduml'), false);
assert.equal(hasRenderablePlantUmlCode("@startuml\n' comment only\n@enduml"), false);
assert.equal(hasRenderablePlantUmlCode('@startuml\nBob -> Alice : hi\n@enduml'), true);

assert.equal(getPlantUmlSvgUrl(''), '');
assert.equal(getPlantUmlSvgUrl('@startuml\n@enduml'), '');

const url = getPlantUmlSvgUrl('@startuml\nBob -> Alice : hi\n@enduml', 'https://www.plantuml.com/plantuml');
assert.match(url, /^https:\/\/www\.plantuml\.com\/plantuml\/svg\//);
assert.ok(!url.includes('?'), '原始 SVG URL 不应包含查询串');

// 暗色主题注入验证
const darkCode = preparePlantUmlCode('@startuml\nBob -> Alice : hi\n@enduml', true);
assert.ok(darkCode.includes('skinparam ArrowColor #60a5fa'), '暗色模式应注入高对比度箭头颜色');
assert.ok(darkCode.includes('skinparam backgroundColor transparent'), '暗色模式应注入透明背景');

// 用例图防白底白字皮肤注入验证
assert.ok(darkCode.includes('skinparam usecaseBackgroundColor #111827'), '暗色模式下用例图必须注入深色背景以杜绝白底白字');
assert.ok(darkCode.includes('skinparam usecaseFontColor #f8fafc'), '暗色模式下用例图必须注入高对比文字');

// 思维脑图 (Mindmap) <style> 原生样式块注入验证
const mindmapDarkCode = preparePlantUmlCode('@startmindmap\n* Root\n** Child\n@endmindmap', true);
assert.ok(mindmapDarkCode.includes('mindmapDiagram {'), '暗色模式思维脑图必须包含 mindmapDiagram 样式块');
assert.ok(mindmapDarkCode.includes('BackgroundColor #111827'), '暗色模式思维脑图必须设置深色节点背景以杜绝白底白字');
assert.ok(mindmapDarkCode.includes('FontColor #f8fafc'), '暗色模式思维脑图必须设置白色文字');

const mindmapLightCode = preparePlantUmlCode('@startmindmap\n* Root\n** Child\n@endmindmap', false);
assert.ok(mindmapLightCode.includes('mindmapDiagram {'), '亮色模式思维脑图必须包含 mindmapDiagram 样式块');
assert.ok(mindmapLightCode.includes('BackgroundColor #f8fafc'), '亮色模式思维脑图必须设置浅色节点背景');
assert.ok(mindmapLightCode.includes('FontColor #0f172a'), '亮色模式思维脑图必须设置深色文字');

// 用户自定义主题不覆盖验证
const customThemeCode = '@startuml\n!theme plain\nBob -> Alice : hi\n@enduml';
assert.equal(preparePlantUmlCode(customThemeCode, true), customThemeCode, '用户自定义 !theme 时不应注入默认皮肤');

// 亮色主题注入验证
const lightCode = preparePlantUmlCode('@startuml\nBob -> Alice : hi\n@enduml', false);
assert.ok(lightCode.includes('skinparam ArrowColor #1e293b'), '亮色模式应注入高对比度箭头颜色');
assert.ok(lightCode.includes('skinparam backgroundColor transparent'), '亮色模式应注入透明背景');
assert.ok(lightCode.includes('skinparam usecaseBackgroundColor #f8fafc'), '亮色模式下用例图必须注入浅色背景');
assert.ok(lightCode.includes('skinparam usecaseFontColor #0f172a'), '亮色模式下用例图必须注入深色文字');

const busted = withPlantUmlCacheBust(url, 42);
assert.match(busted, /\?ov_cb=42$/);

const encoded = encodePlantUml('@startuml\nA -> B\n@enduml');
assert.ok(encoded.length > 4);

console.log('🎉 PlantUML 编码、暗色对比度与空图防护测试全部通过！');
