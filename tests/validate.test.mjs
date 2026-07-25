import { test, expect } from 'bun:test';
import { validateEnrichment, ENRICH_SCHEMA, CLEAN_STANCES } from '../build/lib/validate.mjs';

const conv = {
  id: '99',
  posts: [
    { id: 100, own_text: '不懂就不做，这是最重要的' },
    { id: 101, own_text: '好生意好价格好人' },
    { id: 102, own_text: '' },
    { id: 103 }, // 故意缺失 own_text 字段
  ],
};

test('合法标注原样通过', () => {
  const { clean, warnings } = validateEnrichment(
    {
      conv_id: '99',
      topics: [{ path: '投资理念/能力圈', confidence: 0.9 }],
      companies: [{ name: '苹果', symbol: 'AAPL', stance: 'holds' }],
      summary: '谈能力圈',
      quotes: [{ text: '不懂就不做', post_id: 100 }],
      substantive: true,
    },
    conv
  );
  expect(warnings).toEqual([]);
  expect(clean.quotes.length).toBe(1);
  expect(clean.topics.length).toBe(1);
});

test('丢弃不在体系内的话题并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [{ path: '瞎编的话题', confidence: 1 }], companies: [], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.topics).toEqual([]);
  expect(warnings.some((w) => w.includes('瞎编的话题'))).toBe(true);
});

test('丢弃不是逐字出自 own_text 的金句', () => {
  const { clean, warnings } = validateEnrichment(
    {
      conv_id: '99',
      topics: [],
      companies: [],
      summary: 's',
      quotes: [
        { text: '不懂就不做', post_id: 100 },
        { text: '这句话他根本没说过', post_id: 100 },
      ],
      substantive: true,
    },
    conv
  );
  expect(clean.quotes.length).toBe(1);
  expect(clean.quotes[0].text).toBe('不懂就不做');
  expect(warnings.some((w) => w.includes('杜撰'))).toBe(true);
});

test('金句 post_id 不属于本场对话时告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [], summary: 's', quotes: [{ text: '不懂就不做', post_id: 999 }], substantive: true },
    conv
  );
  expect(clean.quotes.length).toBe(0);
  expect(warnings.some((w) => w.includes('999'))).toBe(true);
});

test('非法 stance 归为 unknown 并告警（含原始值）', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '苹果', symbol: null, stance: '超级看好' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies[0].stance).toBe('unknown');
  expect(warnings.some((w) => w.includes('stance') && w.includes('超级看好'))).toBe(true);
});

test('合法 stance neutral 不受影响，仍是 neutral', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '苹果', symbol: null, stance: 'neutral' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies[0].stance).toBe('neutral');
  expect(warnings.some((w) => w.includes('stance'))).toBe(false);
});

test('summary 为空时告警', () => {
  const { warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [], summary: '', quotes: [], substantive: false },
    conv
  );
  expect(warnings.some((w) => w.includes('summary'))).toBe(true);
});

test('空字符串金句被丢弃并告警（对应 own_text 正常）', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [], summary: 's', quotes: [{ text: '', post_id: 100 }], substantive: true },
    conv
  );
  expect(clean.quotes.length).toBe(0);
  expect(warnings.length).toBeGreaterThan(0);
});

test('空字符串金句被丢弃并告警（对应 own_text 也是空字符串）', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [], summary: 's', quotes: [{ text: '', post_id: 102 }], substantive: true },
    conv
  );
  expect(clean.quotes.length).toBe(0);
  expect(warnings.length).toBeGreaterThan(0);
});

test('纯空白金句被丢弃并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [], summary: 's', quotes: [{ text: '   ', post_id: 100 }], substantive: true },
    conv
  );
  expect(clean.quotes.length).toBe(0);
  expect(warnings.length).toBeGreaterThan(0);
});

test('金句 text 为 undefined 时不抛异常，丢弃并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: 's', quotes: [{ text: undefined, post_id: 100 }], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.quotes.length).toBe(0);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('金句 text 为非字符串类型（own_text 字段缺失的 post）时不抛异常，丢弃并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: 's', quotes: [{ text: 12345, post_id: 103 }], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.quotes.length).toBe(0);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('confidence 越界时归一化为 0.5 并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [{ path: '投资理念/能力圈', confidence: 1.5 }], companies: [], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.topics[0].confidence).toBe(0.5);
  expect(warnings.some((w) => w.includes('confidence'))).toBe(true);
});

test('confidence 为非数字时归一化为 0.5 并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [{ path: '投资理念/能力圈', confidence: '高' }], companies: [], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.topics[0].confidence).toBe(0.5);
  expect(warnings.some((w) => w.includes('confidence'))).toBe(true);
});

test('symbol 非字符串非 null 时置为 null 并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '苹果', symbol: 123, stance: 'holds' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies[0].symbol).toBe(null);
  expect(warnings.some((w) => w.includes('symbol'))).toBe(true);
});

test('CLEAN_STANCES 包含 unknown，供下游分组使用', () => {
  expect(CLEAN_STANCES.sort()).toEqual(['admires', 'criticizes', 'holds', 'neutral', 'unknown']);
});

test('ENRICH_SCHEMA 限定 stance 取值', () => {
  const stance = ENRICH_SCHEMA.properties.results.items.properties.companies.items.properties.stance;
  expect(stance.enum.sort()).toEqual(['admires', 'criticizes', 'holds', 'neutral']);
});
