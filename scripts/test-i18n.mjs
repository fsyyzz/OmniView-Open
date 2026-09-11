import assert from 'node:assert';
import { TRANSLATIONS, t, getStoredLocale } from '../src/shared/lib/i18n.ts';

console.log('🧪 开始 i18n 国际化字典完备性与翻译引擎单元测试...');

// 1. 字典对齐性测试：zh-CN 与 en-US 词条键名 100% 双向对齐
console.log('--- 测试 1: zh-CN 与 en-US 词条键名 100% 双向对齐 ---');
const zhKeys = Object.keys(TRANSLATIONS['zh-CN']);
const enKeys = Object.keys(TRANSLATIONS['en-US']);

assert.strictEqual(zhKeys.length, enKeys.length, `中英文词条数量必须一致 (zh: ${zhKeys.length}, en: ${enKeys.length})`);

const missingInEn = zhKeys.filter(k => !(k in TRANSLATIONS['en-US']));
const missingInZh = enKeys.filter(k => !(k in TRANSLATIONS['zh-CN']));

assert.deepStrictEqual(missingInEn, [], `en-US 缺失以下词条: ${missingInEn.join(', ')}`);
assert.deepStrictEqual(missingInZh, [], `zh-CN 缺失以下词条: ${missingInZh.join(', ')}`);

console.log(`✅ 字典双向对齐验证通过 (共有 ${zhKeys.length} 个双语词条，0 缺失)`);

// 2. 词条非空与有效性检测
console.log('--- 测试 2: 词条内容非空与有效性 ---');
for (const key of zhKeys) {
  const zhVal = TRANSLATIONS['zh-CN'][key];
  const enVal = TRANSLATIONS['en-US'][key];
  assert.ok(typeof zhVal === 'string' && zhVal.trim().length > 0, `zh-CN 中的 [${key}] 不得为空`);
  assert.ok(typeof enVal === 'string' && enVal.trim().length > 0, `en-US 中的 [${key}] 不得为空`);
}
console.log('✅ 所有词条内容非空且格式有效');

// 3. 翻译函数 t() 容错与回退机制
console.log('--- 测试 3: 翻译函数 t() 容错与回退机制 ---');
assert.strictEqual(t('outline', 'zh-CN'), '大纲', 't(outline, zh-CN) 应返回 "大纲"');
assert.strictEqual(t('outline', 'en-US'), 'Outline', 't(outline, en-US) 应返回 "Outline"');

// 针对不存在的键降级为 key 本身
const fakeKey = 'nonExistentKey123';
assert.strictEqual(t(fakeKey, 'zh-CN'), fakeKey, '未知键应安全降级返回 key 字符串本身');

console.log('✅ 翻译函数 t() 容错与回退机制验证全部通过');

// 4. 环境安全兜底测试
console.log('--- 测试 4: 环境无 window/localStorage 时防御降级 ---');
const detectedLocale = getStoredLocale();
assert.ok(detectedLocale === 'zh-CN' || detectedLocale === 'en-US', '无浏览器环境应安全回退默认 locale');
console.log(`✅ 环境降级与安全调用验证通过 (默认回退: ${detectedLocale})`);

console.log('🎉 全部 4 组 i18n 国际化引擎与字典完备性测试用例 100% 通过！');
