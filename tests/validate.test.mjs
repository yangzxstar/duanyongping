import { test, expect } from 'bun:test';
import { validateEnrichment, ENRICH_SCHEMA } from '../build/lib/validate.mjs';

const conv = {
  id: '99',
  posts: [
    { id: 100, own_text: '不懂就不做，这是最重要的' },
    { id: 101, own_text: '好生意好价格好人' },
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

test('非法 stance 归为 neutral 并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '苹果', symbol: null, stance: '超级看好' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies[0].stance).toBe('neutral');
  expect(warnings.some((w) => w.includes('stance'))).toBe(true);
});

test('summary 为空时告警', () => {
  const { warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [], summary: '', quotes: [], substantive: false },
    conv
  );
  expect(warnings.some((w) => w.includes('summary'))).toBe(true);
});

test('ENRICH_SCHEMA 限定 stance 取值', () => {
  const stance = ENRICH_SCHEMA.properties.results.items.properties.companies.items.properties.stance;
  expect(stance.enum.sort()).toEqual(['admires', 'criticizes', 'holds', 'neutral']);
});
