import { test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { convKey, toConversations } from '../build/lib/conversations.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── 全量语料（data/ 未入版本库，干净 clone 上会跳过）──
// 用 test.skipIf 而不是在测试体里 return：后者在测试输出里表现为"通过"，
// 会把"这台机器上根本没跑"伪装成"断言全过"。
const PATH = join(HERE, '..', 'data', 'normalized.json');
const records = existsSync(PATH) ? JSON.parse(readFileSync(PATH, 'utf8')) : null;
const noData = records === null;

// ── 提交进仓库的小样本（任何机器上都会跑）──
const sample = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'conversations-sample.json'), 'utf8')
);

test('convKey 对回复用根帖 id，对原创用 solo- 前缀', () => {
  expect(convKey({ id: 5, thread_root_id: 99 })).toBe('99');
  expect(convKey({ id: 5, thread_root_id: null })).toBe('solo-5');
  expect(convKey({ id: 5, thread_root_id: 0 })).toBe('solo-5');
});

// ── 基于 fixture 的断言：不依赖 data/ ──

test('[fixture] toConversations 把 10 条发言聚成 5 个展示单元', () => {
  const convs = toConversations(sample);
  expect(sample.length).toBe(10);
  expect(convs.length).toBe(5);
});

test('[fixture] thread 与 original 的划分', () => {
  const convs = toConversations(sample);
  const threads = convs.filter((c) => c.kind === 'thread');
  const originals = convs.filter((c) => c.kind === 'original');
  expect(threads.map((c) => c.id).sort()).toEqual(['126988939', '20318852']);
  expect(originals.map((c) => c.id).sort()).toEqual([
    'solo-126825649',
    'solo-233464435',
    'solo-401883730',
  ]);
  // 原创单元：单条、无 root
  for (const c of originals) {
    expect(c.posts.length).toBe(1);
    expect(c.posts[0].type).toBe('original');
    expect(c.root).toBe(null);
  }
  // thread 单元：还原出最初提问
  for (const c of threads) {
    expect(c.root).not.toBe(null);
    expect(typeof c.root.user).toBe('string');
  }
});

test('[fixture] 多发言 thread 聚全，posts 按时间正序', () => {
  const convs = toConversations(sample);
  const c = convs.find((x) => x.id === '20318852');
  expect(c.reply_count).toBe(5);
  expect(c.root.user).toBe('连天雪');
  expect(c.first_at).toBe('2011-07-15T04:12:31.000Z');
  expect(c.last_at).toBe('2011-07-20T00:15:38.000Z');
  for (let i = 1; i < c.posts.length; i++) {
    expect(c.posts[i].created_at >= c.posts[i - 1].created_at).toBe(true);
  }
});

test('[fixture] 跨年对话的 years 数组按年份升序记录多个年份', () => {
  const convs = toConversations(sample);
  const c = convs.find((x) => x.id === '126988939');
  expect(c.years).toEqual([2019, 2022]);
  expect(c.first_at.slice(0, 4)).toBe('2019');
  expect(c.last_at.slice(0, 4)).toBe('2022');
  // 不跨年的单元只记一个年份
  expect(convs.find((x) => x.id === '20318852').years).toEqual([2011]);
});

test('[fixture] own_chars 是各条 own_text 长度求和，stats 逐项求和', () => {
  const convs = toConversations(sample);
  for (const c of convs) {
    expect(c.own_chars).toBe(c.posts.reduce((n, p) => n + p.own_text.length, 0));
    for (const k of ['like', 'reply', 'retweet', 'fav']) {
      expect(c.stats[k]).toBe(c.posts.reduce((n, p) => n + p.stats[k], 0));
    }
  }
  expect(convs.find((x) => x.id === '20318852').own_chars).toBe(299);
  expect(convs.find((x) => x.id === '126988939').own_chars).toBe(171);
});

test('[fixture] 标的按 symbol 去重合并，无标的时为空数组', () => {
  const convs = toConversations(sample);
  expect(convs.find((x) => x.id === 'solo-233464435').stocks.map((s) => s.name)).toEqual([
    '拼多多',
  ]);
  expect(convs.find((x) => x.id === '20318852').stocks).toEqual([]);
});

test('[fixture] conversations 按 first_at 倒序排列', () => {
  const convs = toConversations(sample);
  for (let i = 1; i < convs.length; i++) {
    expect(convs[i].first_at <= convs[i - 1].first_at).toBe(true);
  }
});

// ── 基于全量语料的断言：只在本机（有 data/）跑 ──

test.skipIf(noData)('toConversations 聚出正确的单元数', () => {
  const convs = toConversations(records);
  expect(convs.length).toBe(5174);
  expect(convs.filter((c) => c.kind === 'thread').length).toBe(4734);
  expect(convs.filter((c) => c.kind === 'original').length).toBe(440);
});

test.skipIf(noData)('独立原创单元全部是 original 类型', () => {
  const convs = toConversations(records);
  for (const c of convs.filter((x) => x.kind === 'original')) {
    expect(c.posts.length).toBe(1);
    expect(c.posts[0].type).toBe('original');
    expect(c.root).toBe(null);
  }
});

test.skipIf(noData)('每场 thread 都还原出最初提问', () => {
  const convs = toConversations(records);
  const missing = convs.filter((c) => c.kind === 'thread' && !c.root);
  expect(missing.length).toBe(0);
});

test.skipIf(noData)('最长的一场对话完整聚成一场', () => {
  const convs = toConversations(records);
  const c = convs.find((x) => x.id === '209473011');
  expect(c).toBeDefined();
  expect(c.reply_count).toBe(97);
  expect(c.own_chars).toBe(5358);
  expect(c.root.user).toBe('价值投资日志刘文权');
  expect(c.first_at.slice(0, 10)).toBe('2022-01-20');
  expect(c.last_at.slice(0, 10)).toBe('2022-02-04');
});

test.skipIf(noData)('posts 按时间正序，跨年对话记录多个年份', () => {
  const convs = toConversations(records);
  for (const c of convs) {
    for (let i = 1; i < c.posts.length; i++) {
      expect(c.posts[i].created_at >= c.posts[i - 1].created_at).toBe(true);
    }
  }
  expect(convs.filter((c) => c.years.length > 1).length).toBe(100);
});

test.skipIf(noData)('conversations 按 first_at 倒序排列', () => {
  const convs = toConversations(records);
  for (let i = 1; i < convs.length; i++) {
    expect(convs[i].first_at <= convs[i - 1].first_at).toBe(true);
  }
});

test.skipIf(noData)('own_chars 与 stats 是各条求和/取值', () => {
  const convs = toConversations(records);
  const c = convs.find((x) => x.id === '209473011');
  const manual = c.posts.reduce((n, p) => n + p.own_text.length, 0);
  expect(c.own_chars).toBe(manual);
  expect(c.stats.like).toBe(c.posts.reduce((n, p) => n + p.stats.like, 0));
});
