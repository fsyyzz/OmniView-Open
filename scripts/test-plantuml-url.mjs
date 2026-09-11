/**
 * PlantUML URL / 空图防护契约测试
 */
import assert from 'node:assert/strict';
import {
  hasRenderablePlantUmlCode,
  getPlantUmlSvgUrl,
  withPlantUmlCacheBust,
  encodePlantUml,
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

const busted = withPlantUmlCacheBust(url, 42);
assert.match(busted, /\?ov_cb=42$/);

const encoded = encodePlantUml('@startuml\nA -> B\n@enduml');
assert.ok(encoded.length > 4);

console.log('🎉 PlantUML 编码与空图防护测试全部通过！');
