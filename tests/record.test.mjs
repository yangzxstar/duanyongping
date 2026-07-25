import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { toRecord } from '../build/lib/record.mjs';

const page1 = JSON.parse(readFileSync(new URL('./fixtures/page1.json', import.meta.url), 'utf8'));
const byId = (id) => page1.statuses.find((s) => s.id === id);

test('原创发言规整出完整字段', () => {
  const r = toRecord(byId(401883730));
  expect(r.id).toBe(401883730);
  expect(r.type).toBe('original');
  expect(r.url).toBe('https://xueqiu.com/1247347556/401883730');
  expect(r.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(r.year).toBe(2026);
  expect(r.source).toBe('iPhone');
  expect(r.stocks).toEqual([{ symbol: 'SPCX', name: 'SpaceX' }]);
  expect(r.stats.like).toBe(1167);
  expect(r.stats.reply).toBe(4);
  expect(r.text_truncated).toBe(false);
  expect(r.retweet_of).toBe(null);
  expect(r.images.length).toBe(1);
});

test('回复类发言带上会话根 id 与被回复内容', () => {
  const r = toRecord(byId(401955822));
  expect(r.type).toBe('reply');
  expect(r.thread_root_id).toBe(401936842);
  expect(r.retweet_of).not.toBe(null);
  expect(typeof r.retweet_of.user).toBe('string');
  expect(r.retweet_of.text_plain.length).toBeGreaterThan(0);
  expect(r.mentions.length).toBeGreaterThan(0);
});

test('text_plain 不含任何 HTML 标签', () => {
  for (const s of page1.statuses) {
    expect(toRecord(s).text_plain).not.toMatch(/<[a-z/][^>]*>/i);
  }
});

test('每条记录都有可回溯的原帖 URL', () => {
  for (const s of page1.statuses) {
    expect(toRecord(s).url).toMatch(/^https:\/\/xueqiu\.com\/\d+\/\d+$/);
  }
});

test('char_count 统计的是纯文本长度', () => {
  const r = toRecord(byId(401883730));
  expect(r.char_count).toBe(r.text_plain.length);
});
