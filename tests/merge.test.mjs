import { test, expect } from 'bun:test';
import { mergeBatchResults, addEmptyConvDefaults, emptyEnrichment } from '../build/lib/merge.mjs';

const conv = (id, text = '原文里确实有这句话') => ({
  id,
  posts: [{ id: 1, own_text: text }],
});

const convById = (...convs) => new Map(convs.map((c) => [c.id, c]));

const entry = (id, over = {}) => ({
  conv_id: id,
  topics: [],
  companies: [],
  summary: '摘要',
  quotes: [],
  substantive: true,
  ...over,
});

test('mergeBatchResults 正常合并多批标注', () => {
  const map = convById(conv('a'), conv('b'));
  const { enriched, warnings, stats } = mergeBatchResults(
    [
      { label: 'batch-001.json', results: [entry('a')] },
      { label: 'batch-002.json', results: [entry('b', { summary: 'B 摘要' })] },
    ],
    map
  );
  expect(Object.keys(enriched).sort()).toEqual(['a', 'b']);
  expect(enriched.b.summary).toBe('B 摘要');
  expect(enriched.a.substantive).toBe(true);
  expect(stats).toEqual({ mergedResultCount: 2, orphanCount: 0, duplicateCount: 0 });
  expect(warnings).toEqual([]);
});

test('mergeBatchResults 逐条过 validateEnrichment：非法话题被丢弃并告警', () => {
  const { enriched, warnings } = mergeBatchResults(
    [
      {
        label: 'batch-001.json',
        results: [entry('a', { topics: [{ path: '不存在的话题', confidence: 0.9 }] })],
      },
    ],
    convById(conv('a'))
  );
  expect(enriched.a.topics).toEqual([]);
  expect(warnings.some((w) => w.includes('话题不在体系内'))).toBe(true);
});

test('mergeBatchResults 丢弃孤儿标注并告警', () => {
  const { enriched, warnings, stats } = mergeBatchResults(
    [
      {
        label: 'batch-007.json',
        results: [entry('a'), entry('不存在的id'), { summary: '没有 conv_id' }, null],
      },
    ],
    convById(conv('a'))
  );
  expect(Object.keys(enriched)).toEqual(['a']);
  expect(stats.orphanCount).toBe(3);
  expect(stats.mergedResultCount).toBe(4);
  expect(warnings.filter((w) => w.includes('孤儿标注')).length).toBe(3);
  expect(warnings.some((w) => w.includes('batch-007.json'))).toBe(true);
});

test('mergeBatchResults 同 conv_id 跨批重复以后者为准并计数告警', () => {
  const { enriched, warnings, stats } = mergeBatchResults(
    [
      { label: 'batch-001.json', results: [entry('a', { summary: '第一次' })] },
      { label: 'batch-050.json', results: [entry('a', { summary: '第二次' })] },
    ],
    convById(conv('a'))
  );
  expect(enriched.a.summary).toBe('第二次');
  expect(stats.duplicateCount).toBe(1);
  expect(warnings.some((w) => w.includes('跨批重复'))).toBe(true);
});

test('mergeBatchResults 对 results 不是数组的批次告警并按 0 条处理', () => {
  const { enriched, warnings, stats } = mergeBatchResults(
    [
      { label: 'batch-003.json', results: undefined },
      { label: 'batch-004.json', results: '{}' },
    ],
    convById(conv('a'))
  );
  expect(Object.keys(enriched)).toEqual([]);
  expect(stats.mergedResultCount).toBe(0);
  expect(warnings.length).toBe(2);
  expect(warnings.every((w) => w.includes('顶层 results 不是数组'))).toBe(true);
});

test('mergeBatchResults 用无原型对象承载，公司名/id 为 __proto__ 时不串到原型链', () => {
  const { enriched } = mergeBatchResults(
    [{ label: 'batch-001.json', results: [entry('__proto__')] }],
    convById(conv('__proto__'))
  );
  expect(Object.getPrototypeOf(enriched)).toBe(null);
  expect(enriched['__proto__'].conv_id).toBe('__proto__');
});

test('addEmptyConvDefaults 给空内容对话补默认标注', () => {
  const enriched = { a: entry('a') };
  const { added, warnings } = addEmptyConvDefaults(
    enriched,
    ['e1', 'e2'],
    convById(conv('a'), conv('e1'), conv('e2'))
  );
  expect(added).toBe(2);
  expect(warnings).toEqual([]);
  expect(enriched.e1).toEqual({
    conv_id: 'e1',
    topics: [],
    companies: [],
    summary: '',
    quotes: [],
    substantive: false,
  });
  expect(enriched.e2).toEqual(emptyEnrichment('e2'));
  expect(enriched.a.summary).toBe('摘要');
});

test('addEmptyConvDefaults 对不存在于 conversations.json 的 id 告警且不补', () => {
  const enriched = {};
  const { added, warnings } = addEmptyConvDefaults(enriched, ['ghost'], convById(conv('a')));
  expect(added).toBe(0);
  expect(Object.keys(enriched)).toEqual([]);
  expect(warnings.length).toBe(1);
  expect(warnings[0]).toContain('ghost');
  expect(warnings[0]).toContain('数据不一致');
});

test('addEmptyConvDefaults 覆盖 AI 意外给出的标注并告警', () => {
  const enriched = { e1: entry('e1', { summary: '不该有的摘要' }) };
  const { added, warnings } = addEmptyConvDefaults(enriched, ['e1'], convById(conv('e1')));
  expect(added).toBe(1);
  expect(enriched.e1.summary).toBe('');
  expect(enriched.e1.substantive).toBe(false);
  expect(warnings.some((w) => w.includes('仍以默认空标注覆盖'))).toBe(true);
});

test('addEmptyConvDefaults 空列表是安全的空操作', () => {
  const enriched = {};
  expect(addEmptyConvDefaults(enriched, [], convById())).toEqual({ added: 0, warnings: [] });
  expect(addEmptyConvDefaults(enriched, undefined, convById())).toEqual({
    added: 0,
    warnings: [],
  });
});
