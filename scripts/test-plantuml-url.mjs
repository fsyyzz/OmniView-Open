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

// 用户自定义主题不覆盖验证
const customThemeCode = '@startuml\n!theme plain\nBob -> Alice : hi\n@enduml';
assert.equal(preparePlantUmlCode(customThemeCode, true), customThemeCode, '用户自定义 !theme 时不应注入默认皮肤');

const lightCode = preparePlantUmlCode('@startuml\nBob -> Alice : hi\n@enduml', false);
assert.equal(lightCode, '@startuml\nBob -> Alice : hi\n@enduml', '亮色模式应保持原样');

const busted = withPlantUmlCacheBust(url, 42);
assert.match(busted, /\?ov_cb=42$/);

const encoded = encodePlantUml('@startuml\nA -> B\n@enduml');
assert.ok(encoded.length > 4);

console.log('🎉 PlantUML 编码、暗色对比度与空图防护测试全部通过！');
