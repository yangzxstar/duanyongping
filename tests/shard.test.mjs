import { test, expect } from 'bun:test';
import { isFeatured, buildIndexEntry, buildYearShards, topicSlug } from '../build/lib/shard.mjs';

const base = {
  id: '99', kind: 'thread', first_at: '2024-05-01T03:00:00.000Z', last_at: '2024-05-01T04:00:00.000Z',
  years: [2024], reply_count: 1, own_chars: 100, stocks: [],
  root: { id: 99, user: '提问者', text_plain: '问题' },
  posts: [{ id: 100, created_at: '2024-05-01T03:00:00.000Z', own_text: '回答', url: 'https://xueqiu.com/1247347556/100',
    conversation: { chain: [{ speaker: '段永平', text: '回答', replying_to: '提问者' }] }, stats: { like: 10, reply: 0, retweet: 0, fav: 0 } }],
  stats: { like: 10, reply: 0, retweet: 0, fav: 0 },
};
const enr = { topics: [{ path: '投资理念/能力圈', confidence: 0.9 }], companies: [], summary: '摘要', quotes: [], substantive: true };

test('非 substantive 一律不进精华', () => {
  const big = { ...base, own_chars: 9999, reply_count: 20, stats: { ...base.stats, like: 5000 } };
  expect(isFeatured(big, { ...enr, substantive: false }, 677)).toBe(false);
});

test('substantive 且长文进精华', () => {
  expect(isFeatured({ ...base, own_chars: 501 }, enr, 677)).toBe(true);
});

test('substantive 且深度对话进精华', () => {
  expect(isFeatured({ ...base, reply_count: 5 }, enr, 677)).toBe(true);
});

test('substantive 且高赞进精华', () => {
  expect(isFeatured({ ...base, stats: { ...base.stats, like: 677 } }, enr, 677)).toBe(true);
});

test('substantive 的原创一律进精华', () => {
  expect(isFeatured({ ...base, kind: 'original' }, enr, 677)).toBe(true);
});

test('substantive 但各项都不达标不进精华', () => {
  expect(isFeatured(base, enr, 677)).toBe(false);
});

test('索引条目只含轻量字段，不含正文', () => {
  const e = buildIndexEntry(base, enr, 677);
  expect(e.id).toBe('99');
  expect(e.date).toBe('2024-05-01');
  expect(e.kind).toBe('thread');
  expect(e.summary).toBe('摘要');
  expect(e.topics).toEqual(['投资理念/能力圈']);
  expect(e.reply_count).toBe(1);
  expect(e.like).toBe(10);
  expect(e.featured).toBe(false);
  expect(e.posts).toBeUndefined();
  expect(e.text_html).toBeUndefined();
});

test('缺标注时索引条目仍可生成', () => {
  const e = buildIndexEntry(base, undefined, 677);
  expect(e.summary).toBe('');
  expect(e.topics).toEqual([]);
  expect(e.featured).toBe(false);
});

test('年份分片按首条时间归年，正文只留净文本与对话链', () => {
  const shards = buildYearShards([base], { 99: enr });
  expect([...shards.keys()]).toEqual([2024]);
  const c = shards.get(2024)[0];
  expect(c.id).toBe('99');
  expect(c.root.user).toBe('提问者');
  expect(c.posts[0].own_text).toBe('回答');
  expect(c.posts[0].url).toBe('https://xueqiu.com/1247347556/100');
  expect(c.posts[0].text_html).toBeUndefined();
});

test('topicSlug 把话题路径转成文件名安全的 slug', () => {
  expect(topicSlug('投资理念/能力圈')).toBe('投资理念-能力圈');
  expect(topicSlug('投机批判')).toBe('投机批判');
});
