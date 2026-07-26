import { test, expect } from 'bun:test';
import { searchIndex, convMatches } from '../../site/search.js';

const entries = [
  { id: '1', summary: '谈茅台的生意模式', topics: ['投资理念'], companies: ['茅台'] },
  { id: '2', summary: '谈苹果', topics: ['企业经营/本分'], companies: ['苹果'] },
  { id: '3', summary: 'Costco 的会员制', topics: [], companies: ['Costco'] },
];

test('searchIndex 匹配摘要/话题/公司三路', () => {
  expect(searchIndex(entries, '茅台').map((e) => e.id)).toEqual(['1']);
  expect(searchIndex(entries, '本分').map((e) => e.id)).toEqual(['2']);
  expect(searchIndex(entries, 'costco').map((e) => e.id)).toEqual(['3']); // 大小写不敏感
});

test('searchIndex 空查询返回空数组', () => {
  expect(searchIndex(entries, '  ')).toEqual([]);
});

const conv = {
  root: { user: '甲', text_plain: '费德勒的演讲怎么看？' },
  posts: [
    { own_text: '很值得看看', chain: [{ speaker: '段永平', text: '很值得看看' }, { speaker: '乙', text: '谢谢大道' }] },
  ],
};

test('convMatches 匹配 root / own_text / chain', () => {
  expect(convMatches(conv, '费德勒')).toBe(true);
  expect(convMatches(conv, '值得看看')).toBe(true);
  expect(convMatches(conv, '谢谢大道')).toBe(true);
  expect(convMatches(conv, '不存在的词')).toBe(false);
  expect(convMatches(conv, '')).toBe(false);
});
