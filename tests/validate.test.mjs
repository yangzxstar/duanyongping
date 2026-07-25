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

// ---- 补丁二：畸形输入加固 ----
// 同一类崩溃隐患：真值但类型不对（非数组/非字符串）、数组里混入 null/undefined。
// 原则：这个模块永远不应该因为输入畸形而 throw，任何畸形输入都应该被清洗掉 + 记入 warnings。

test('quotes 为字符串（非数组）时不抛异常，按空数组处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: 's', quotes: 'not-an-array', substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.quotes).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('quotes 为单个对象（非数组）时不抛异常，按空数组处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: 's', quotes: { text: 'x', post_id: 100 }, substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.quotes).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('topics 为字符串（非数组）时不抛异常，按空数组处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: 'not-an-array', companies: [], summary: 's', quotes: [], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.topics).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('companies 为单个对象（非数组）时不抛异常，按空数组处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: { name: '苹果', symbol: null, stance: 'holds' }, summary: 's', quotes: [], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.companies).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('topics 数组内混入 null 时不抛异常，该元素被丢弃并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [null], companies: [], summary: 's', quotes: [], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.topics).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('companies 数组内混入 null 时不抛异常，该元素被丢弃并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [null], summary: 's', quotes: [], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.companies).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('quotes 数组内混入 null 和 undefined 时不抛异常，均被丢弃并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: 's', quotes: [null, undefined], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.quotes).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('summary 为数字时不抛异常，按空字符串处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: 12345, quotes: [], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.summary).toBe('');
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('summary 为对象时不抛异常，按空字符串处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: { x: 1 }, quotes: [], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.summary).toBe('');
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('entry 本身为 null 时不抛异常，按空标注处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(null, conv);
  }).not.toThrow();
  expect(result.clean.topics).toEqual([]);
  expect(result.clean.companies).toEqual([]);
  expect(result.clean.quotes).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('entry 本身为 undefined 时不抛异常，按空标注处理并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(undefined, conv);
  }).not.toThrow();
  expect(result.clean.topics).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('回归保护：quotes 内的原始字符串元素仍被安全丢弃，不崩溃', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [], summary: 's', quotes: ['just a string'], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.quotes).toEqual([]);
});

// ---- 补丁三：companies 整条校验 ----
// companies 之前只对 stance/symbol 做单字段修复，从不整条丢弃非法元素。
// typeof [] === 'object'，所以数组元素能绕过 isDroppableElement 的检查，
// 被当成"合法对象"塞进去做字段修复，产出带数字键、没有 name 的垃圾记录。
// 这里要求：元素必须是非数组的普通对象，且 name 必须是非空字符串（trim 后非空），
// 否则整条丢弃，不做修补。

test('companies 元素是数组时整条丢弃并告警', () => {
  let result;
  expect(() => {
    result = validateEnrichment(
      { conv_id: '99', topics: [], companies: [[1, 2, 3]], summary: 's', quotes: [], substantive: true },
      conv
    );
  }).not.toThrow();
  expect(result.clean.companies).toEqual([]);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('companies 元素是空对象（无 name）时整条丢弃并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{}], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies).toEqual([]);
  expect(warnings.length).toBeGreaterThan(0);
});

test('companies 元素有其它字段但缺 name 时整条丢弃并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ symbol: 'AAPL', stance: 'holds' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies).toEqual([]);
  expect(warnings.length).toBeGreaterThan(0);
});

test('companies 元素 name 为空字符串时整条丢弃并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '', stance: 'holds' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies).toEqual([]);
  expect(warnings.length).toBeGreaterThan(0);
});

test('companies 元素 name 为纯空白时整条丢弃并告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '   ', stance: 'holds' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies).toEqual([]);
  expect(warnings.length).toBeGreaterThan(0);
});

test('回归保护：合法公司记录原样保留，零告警', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '苹果', symbol: 'AAPL', stance: 'holds' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies).toEqual([{ name: '苹果', symbol: 'AAPL', stance: 'holds' }]);
  expect(warnings).toEqual([]);
});

test('回归保护：非法 stance 仍归一化为 unknown 并告警，但记录保留（不因 stance 非法整条丢弃）', () => {
  const { clean, warnings } = validateEnrichment(
    { conv_id: '99', topics: [], companies: [{ name: '苹果', symbol: 'AAPL', stance: '强烈看好' }], summary: 's', quotes: [], substantive: true },
    conv
  );
  expect(clean.companies.length).toBe(1);
  expect(clean.companies[0].name).toBe('苹果');
  expect(clean.companies[0].stance).toBe('unknown');
  expect(warnings.some((w) => w.includes('stance'))).toBe(true);
});

test('一条合法 + 一条非法混在同一数组中，合法保留、非法丢弃', () => {
  const { clean, warnings } = validateEnrichment(
    {
      conv_id: '99',
      topics: [],
      companies: [
        { name: '苹果', symbol: 'AAPL', stance: 'holds' },
        [1, 2, 3],
      ],
      summary: 's',
      quotes: [],
      substantive: true,
    },
    conv
  );
  expect(clean.companies).toEqual([{ name: '苹果', symbol: 'AAPL', stance: 'holds' }]);
  expect(warnings.length).toBeGreaterThan(0);
});
