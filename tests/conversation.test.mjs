import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { parseReplyChain, buildConversation } from '../build/lib/conversation.mjs';

const page1 = JSON.parse(readFileSync(new URL('./fixtures/page1.json', import.meta.url), 'utf8'));
const byId = (id) => page1.statuses.find((s) => s.id === id);

test('parseReplyChain 把 //@ 链拆成按时间正序的对话层', () => {
  const plain = '回复@小明: 我的看法//@小明:回复@大道无形我有型:我的问题';
  const chain = parseReplyChain(plain);
  // 正序：最早的在前，段永平自己的话在最后
  expect(chain.length).toBe(2);
  expect(chain[0].speaker).toBe('小明');
  expect(chain[0].text).toBe('我的问题');
  expect(chain[0].replying_to).toBe('大道无形我有型');
  expect(chain[1].speaker).toBe('段永平');
  expect(chain[1].text).toBe('我的看法');
  expect(chain[1].replying_to).toBe('小明');
});

test('parseReplyChain 处理无 //@ 的单层回复', () => {
  const chain = parseReplyChain('回复@小明: 就这样');
  expect(chain.length).toBe(1);
  expect(chain[0].speaker).toBe('段永平');
  expect(chain[0].text).toBe('就这样');
  expect(chain[0].replying_to).toBe('小明');
});

test('parseReplyChain 处理不是回复的普通发言', () => {
  const chain = parseReplyChain('今天天气不错');
  expect(chain.length).toBe(1);
  expect(chain[0].speaker).toBe('段永平');
  expect(chain[0].text).toBe('今天天气不错');
  expect(chain[0].replying_to).toBe(null);
});

test('buildConversation 用真实数据还原出提问 + 对话链', () => {
  const conv = buildConversation(byId(401955822));
  // 最初的提问（来自 retweeted_status）
  expect(conv.root).not.toBe(null);
  expect(conv.root.id).toBe(401936842);
  expect(conv.root.user).toBe('为女儿攒嫁妆的爸爸');
  expect(conv.root.text_plain.length).toBeGreaterThan(10);
  // 对话链最后一句一定是段永平本人
  expect(conv.chain.length).toBeGreaterThanOrEqual(2);
  expect(conv.chain[conv.chain.length - 1].speaker).toBe('段永平');
  expect(conv.thread_root_id).toBe(401936842);
});

test('buildConversation 对原创发言不产生对话链噪音', () => {
  const conv = buildConversation(byId(401883730)); // 原创
  expect(conv.root).toBe(null);
  expect(conv.thread_root_id).toBe(null);
  expect(conv.chain.length).toBe(1);
  expect(conv.chain[0].speaker).toBe('段永平');
  expect(conv.chain[0].replying_to).toBe(null);
});

test('同一根帖下的多条发言共享 thread_root_id，可聚成一场对话', () => {
  const ids = page1.statuses
    .filter((s) => Number(s.retweet_status_id) === 401936842)
    .map((s) => buildConversation(s).thread_root_id);
  expect(ids.length).toBeGreaterThanOrEqual(4);
  expect(new Set(ids).size).toBe(1);
});
