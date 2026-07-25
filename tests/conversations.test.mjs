import { test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { convKey, toConversations } from '../build/lib/conversations.mjs';

const PATH = '/Users/seal/duanyongping/data/normalized.json';
const records = existsSync(PATH) ? JSON.parse(readFileSync(PATH, 'utf8')) : null;
const hasData = records !== null;

test('convKey 对回复用根帖 id，对原创用 solo- 前缀', () => {
  expect(convKey({ id: 5, thread_root_id: 99 })).toBe('99');
  expect(convKey({ id: 5, thread_root_id: null })).toBe('solo-5');
});

test('toConversations 聚出正确的单元数', () => {
  if (!hasData) return;
  const convs = toConversations(records);
  expect(convs.length).toBe(5174);
  expect(convs.filter((c) => c.kind === 'thread').length).toBe(4734);
  expect(convs.filter((c) => c.kind === 'original').length).toBe(440);
});

test('独立原创单元全部是 original 类型', () => {
  if (!hasData) return;
  const convs = toConversations(records);
  for (const c of convs.filter((x) => x.kind === 'original')) {
    expect(c.posts.length).toBe(1);
    expect(c.posts[0].type).toBe('original');
    expect(c.root).toBe(null);
  }
});

test('每场 thread 都还原出最初提问', () => {
  if (!hasData) return;
  const convs = toConversations(records);
  const missing = convs.filter((c) => c.kind === 'thread' && !c.root);
  expect(missing.length).toBe(0);
});

test('最长的一场对话完整聚成一场', () => {
  if (!hasData) return;
  const convs = toConversations(records);
  const c = convs.find((x) => x.id === '209473011');
  expect(c).toBeDefined();
  expect(c.reply_count).toBe(97);
  expect(c.own_chars).toBe(5358);
  expect(c.root.user).toBe('价值投资日志刘文权');
  expect(c.first_at.slice(0, 10)).toBe('2022-01-20');
  expect(c.last_at.slice(0, 10)).toBe('2022-02-04');
});

test('posts 按时间正序，跨年对话记录多个年份', () => {
  if (!hasData) return;
  const convs = toConversations(records);
  for (const c of convs) {
    for (let i = 1; i < c.posts.length; i++) {
      expect(c.posts[i].created_at >= c.posts[i - 1].created_at).toBe(true);
    }
  }
  expect(convs.filter((c) => c.years.length > 1).length).toBe(100);
});

test('conversations 按 first_at 倒序排列', () => {
  if (!hasData) return;
  const convs = toConversations(records);
  for (let i = 1; i < convs.length; i++) {
    expect(convs[i].first_at <= convs[i - 1].first_at).toBe(true);
  }
});

test('own_chars 与 stats 是各条求和/取值', () => {
  if (!hasData) return;
  const convs = toConversations(records);
  const c = convs.find((x) => x.id === '209473011');
  const manual = c.posts.reduce((n, p) => n + p.own_text.length, 0);
  expect(c.own_chars).toBe(manual);
  expect(c.stats.like).toBe(c.posts.reduce((n, p) => n + p.stats.like, 0));
});
