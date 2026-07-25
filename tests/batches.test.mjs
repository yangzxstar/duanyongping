import { test, expect } from 'bun:test';
import { toAiPayload, splitBatches, batchFileName, missingBatches, isEmptyPayload } from '../build/lib/batches.mjs';

const conv = {
  id: '99',
  kind: 'thread',
  first_at: '2024-05-01T03:00:00.000Z',
  root: { id: 99, user: '提问者', text_plain: '大道老师怎么看这个生意' },
  posts: [
    { id: 100, own_text: '这个生意我不懂', text_plain: '回复@提问者: 这个生意我不懂', stats: {} },
    { id: 101, own_text: '不懂就不做', text_plain: '回复@别人: 不懂就不做', stats: {} },
  ],
};

test('toAiPayload 只带 AI 需要的字段，正文用 own_text', () => {
  const p = toAiPayload(conv);
  expect(p.conv_id).toBe('99');
  expect(p.date).toBe('2024-05-01');
  expect(p.kind).toBe('thread');
  expect(p.root_question).toBe('大道老师怎么看这个生意');
  expect(p.posts).toEqual([
    { post_id: 100, text: '这个生意我不懂' },
    { post_id: 101, text: '不懂就不做' },
  ]);
  expect(p.text_html).toBeUndefined();
});

test('toAiPayload 对独立原创没有 root_question', () => {
  const solo = { id: 'solo-7', kind: 'original', first_at: '2020-01-02T00:00:00.000Z', root: null,
    posts: [{ id: 7, own_text: '原创内容', stats: {} }] };
  const p = toAiPayload(solo);
  expect(p.root_question).toBe(null);
  expect(p.posts.length).toBe(1);
});

test('toAiPayload 附带关键词命中的公司作为提示', () => {
  const c = { ...conv, posts: [{ id: 1, own_text: '苹果这个生意很好', stats: {} }] };
  expect(toAiPayload(c).hint_companies).toEqual(['苹果']);
});

test('splitBatches 按 40 切分，batch_no 从 1 起', () => {
  const convs = Array.from({ length: 85 }, (_, i) => ({ ...conv, id: String(i) }));
  const bs = splitBatches(convs, 40);
  expect(bs.length).toBe(3);
  expect(bs[0].batch_no).toBe(1);
  expect(bs[0].items.length).toBe(40);
  expect(bs[2].items.length).toBe(5);
});

test('5174 场按 40 切出 130 批', () => {
  const convs = Array.from({ length: 5174 }, (_, i) => ({ ...conv, id: String(i) }));
  expect(splitBatches(convs, 40).length).toBe(130);
});

test('batchFileName 三位补零', () => {
  expect(batchFileName(1)).toBe('batch-001.json');
  expect(batchFileName(130)).toBe('batch-130.json');
});

test('missingBatches 找出未完成的批次', () => {
  expect(missingBatches(5, [1, 3, 5])).toEqual([2, 4]);
  expect(missingBatches(3, [1, 2, 3])).toEqual([]);
});

test('isEmptyPayload 判定 posts 全空且 root 为 null 的对话为空内容', () => {
  const empty = {
    id: 'solo-1',
    kind: 'original',
    first_at: '2020-01-01T00:00:00.000Z',
    root: null,
    posts: [{ id: 1, own_text: '', stats: {} }],
  };
  expect(isEmptyPayload(toAiPayload(empty))).toBe(true);
});

test('isEmptyPayload 对 posts 全空但 root_question 有实质内容的对话判定为非空', () => {
  const c = {
    id: '113693907-like',
    kind: 'thread',
    first_at: '2021-01-01T00:00:00.000Z',
    root: { id: 1, user: '苹果(AAPL)', text_plain: '苹果这个生意未来十年会怎样' },
    posts: [{ id: 2, own_text: '', stats: {} }],
  };
  expect(isEmptyPayload(toAiPayload(c))).toBe(false);
});

test('isEmptyPayload 对正常对话判定为非空', () => {
  expect(isEmptyPayload(toAiPayload(conv))).toBe(false);
});

test('splitBatches 与 missingBatches 处理空输入边界', () => {
  expect(splitBatches([], 40)).toEqual([]);
  expect(missingBatches(0, [])).toEqual([]);
});

test('isEmptyPayload 判定 root_question 为已知删帖占位语的对话为空内容', () => {
  expect(isEmptyPayload({ posts: [], root_question: '原帖已删除' })).toBe(true);
  expect(isEmptyPayload({ posts: [], root_question: '原帖已被作者删除' })).toBe(true);
});

test('toAiPayload 过滤纯空白（非空字符串）的 own_text', () => {
  const c = { ...conv, posts: [{ id: 1, own_text: '   \n\t  ', stats: {} }] };
  const p = toAiPayload(c);
  expect(p.posts).toEqual([]);
});
