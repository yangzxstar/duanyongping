import { test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { TOPICS, TOPIC_PATHS, COMPANY_KEYWORDS, matchCompanies } from '../build/lib/taxonomy.mjs';

test('话题体系是 20 个节点：8 个一级 + 12 个二级', () => {
  expect(TOPICS.length).toBe(20);
  const top = TOPICS.filter((t) => !t.path.includes('/'));
  const sub = TOPICS.filter((t) => t.path.includes('/'));
  expect(top.length).toBe(8);
  expect(sub.length).toBe(12);
});

test('每个二级话题的父级都存在', () => {
  const paths = new Set(TOPICS.map((t) => t.path));
  for (const t of TOPICS.filter((x) => x.path.includes('/'))) {
    expect(paths.has(t.path.split('/')[0])).toBe(true);
  }
});

test('每个话题都有给 AI 看的 hint', () => {
  for (const t of TOPICS) {
    expect(typeof t.hint).toBe('string');
    expect(t.hint.length).toBeGreaterThan(5);
  }
});

test('TOPIC_PATHS 可用于校验合法话题', () => {
  expect(TOPIC_PATHS.has('投资理念/能力圈')).toBe(true);
  expect(TOPIC_PATHS.has('不存在的话题')).toBe(false);
});

test('matchCompanies 命中公司名与代码与别名', () => {
  expect(matchCompanies('我觉得苹果这个生意很好')).toEqual(['苹果']);
  expect(matchCompanies('$贵州茅台(SH600519)$ 还是好生意')).toEqual(['茅台']);
  expect(matchCompanies('库克做得不错')).toEqual(['苹果']);
});

test('matchCompanies 去重且可命中多家', () => {
  const r = matchCompanies('苹果和腾讯都不错，苹果尤其好');
  expect(r.sort()).toEqual(['腾讯', '苹果']);
});

test('matchCompanies 对无关文本返回空数组', () => {
  expect(matchCompanies('今天天气不错')).toEqual([]);
});

test('纯数字/字母数字关键词加边界校验，避免子串误命中', () => {
  // 正常带代码的正文仍能命中（不能修过头）
  expect(matchCompanies('$腾讯控股(00700)$ 微信生态很强')).toEqual(['腾讯']);
  // 更长数字串包含 00700 子串，不应误命中
  expect(matchCompanies('这个项目今年花了1007000元预算')).toEqual([]);
  // 中文关键词不受影响，继续用 includes
  expect(matchCompanies('我觉得苹果这个生意很好')).toEqual(['苹果']);
  // 纯字母代码：边界内命中，边界外的更长字母串不命中
  expect(matchCompanies('AAPL 今天涨了')).toEqual(['苹果']);
  expect(matchCompanies('XAAPLY 不是一个真实代码')).toEqual([]);
});

test('关键词法在真实语料上的覆盖率显著高于纯标签', () => {
  const PATH = '/Users/seal/duanyongping/data/normalized.json';
  if (!existsSync(PATH)) return;
  const rs = JSON.parse(readFileSync(PATH, 'utf8'));
  const tagged = rs.filter((r) => r.stocks.length > 0).length;
  const matched = rs.filter((r) => matchCompanies(r.own_text || r.text_plain).length > 0).length;
  // 实测：标签 387 条(3.6%)，关键词 1617 条(14.9%)
  expect(matched).toBeGreaterThan(tagged * 3);
});
