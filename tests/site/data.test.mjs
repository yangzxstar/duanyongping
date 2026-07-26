import { test, expect, beforeEach } from 'bun:test';
import { getIndex, getConv, topicSlug, _resetCache } from '../../site/data.js';

let calls;
beforeEach(() => {
  _resetCache();
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const fixtures = {
      'data/index.json': [
        { id: 'a1', date: '2024-05-01' },
        { id: 'solo-b2', date: '2019-03-02' },
      ],
      'data/convs/2024.json': [{ id: 'a1', posts: [] }],
      'data/convs/2019.json': [{ id: 'solo-b2', posts: [] }],
    };
    if (!(url in fixtures)) return { ok: false, status: 404 };
    return { ok: true, json: async () => fixtures[url] };
  };
});

test('getIndex 同一路径只 fetch 一次（缓存）', async () => {
  await getIndex();
  await getIndex();
  expect(calls.filter((u) => u === 'data/index.json').length).toBe(1);
});

test('getConv 按 index 条目日期的年份定位分片', async () => {
  const conv = await getConv('solo-b2');
  expect(conv.id).toBe('solo-b2');
  expect(calls).toContain('data/convs/2019.json');
});

test('getConv 未知 id 返回 null 且不加载分片', async () => {
  expect(await getConv('nope')).toBeNull();
  expect(calls.some((u) => u.startsWith('data/convs/'))).toBe(false);
});

test('404 抛错', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  await expect(getIndex()).rejects.toThrow('404');
});

test('topicSlug 把全部 / 换成 -', () => {
  expect(topicSlug('企业经营/本分')).toBe('企业经营-本分');
});
