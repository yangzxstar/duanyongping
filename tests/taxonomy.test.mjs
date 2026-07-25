import { test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  TOPICS,
  TOPIC_PATHS,
  COMPANY_KEYWORDS,
  matchCompanies,
  matchesKeyword,
} from '../build/lib/taxonomy.mjs';

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

test('matchCompanies 对所有 ASCII 字母/数字/点关键词（不分大小写）做边界校验：前不能是字母数字、后不能是字母，且关键词以数字结尾时后面也不能是数字', () => {
  // 前面是数字 → 不命中
  expect(matchCompanies('这个项目今年花了1007000元预算')).toEqual([]);
  // 关键词以数字结尾，后面又是数字 → 不命中
  expect(matchCompanies('007001')).toEqual([]);
  // 前后是合法边界（括号）→ 命中腾讯
  expect(matchCompanies('$腾讯控股(00700)$ 微信生态很强')).toEqual(['腾讯']);
  // 前面是字母 → 不命中
  expect(matchCompanies('XAAPLY 不是一个真实代码')).toEqual([]);
  // 前后合法 → 命中苹果
  expect(matchCompanies('AAPL 今天涨了')).toEqual(['苹果']);
  // 关键词以字母结尾，后面跟数字型号，边界规则放行 → 命中苹果
  expect(matchCompanies('iPhone13 销量不错')).toEqual(['苹果']);
  expect(matchCompanies('iPhone5')).toEqual(['苹果']);
  // 前面是字母（survivor 里的 vivo）→ 不命中，纯小写关键词也要走边界校验
  expect(matchCompanies('他是个 survivor')).toEqual([]);
  // 前后合法 → 命中步步高系
  expect(matchCompanies('vivo 手机')).toEqual(['步步高系']);
  // 以数字结尾且后面紧跟数字 → 不命中
  expect(matchCompanies('SH6005191 不是真实代码')).toEqual([]);
  // 中文关键词不做边界校验，继续用普通 includes
  expect(matchCompanies('我觉得苹果这个生意很好')).toEqual(['苹果']);
});

test('matchCompanies 显式识别 GOOGLE 别名，修复此前边界校验对全大写变体引入的假阴性', () => {
  // GOOGLE 本身现在是显式别名，前后合法边界即可命中，不再依赖 GOOG 子串巧合
  expect(matchCompanies('GOOGLE 不是股票代码')).toEqual(['谷歌']);
  expect(matchCompanies('比GOOGLE要复杂很多')).toEqual(['谷歌']);
});

test('matchesKeyword 单关键词判据与 matchCompanies 一致：ASCII 走边界校验，中文走 includes', () => {
  expect(matchesKeyword('AAPL 今天涨了', 'AAPL')).toBe(true);
  expect(matchesKeyword('XAAPLY 不是一个真实代码', 'AAPL')).toBe(false);
  expect(matchesKeyword('他是个 survivor', 'vivo')).toBe(false);
  expect(matchesKeyword('vivo 手机', 'vivo')).toBe(true);
  expect(matchesKeyword('我觉得苹果这个生意很好', '苹果')).toBe(true);
  expect(matchesKeyword('', '苹果')).toBe(false);
  expect(matchesKeyword('苹果', '')).toBe(false);
});

// data/ 未入版本库，干净 clone 上这条要显式 skip 而不是在测试体里 return
// （return 会被报告成"通过"，把"根本没跑"伪装成"断言全过"）。
const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'normalized.json');

test.skipIf(!existsSync(CORPUS))('关键词法在真实语料上的覆盖率显著高于纯标签', () => {
  const rs = JSON.parse(readFileSync(CORPUS, 'utf8'));
  const tagged = rs.filter((r) => r.stocks.length > 0).length;
  const matched = rs.filter((r) => matchCompanies(r.own_text || r.text_plain).length > 0).length;
  // 实测：标签 387 条(3.6%)，关键词 1561 条(14.36%)
  expect(matched).toBeGreaterThan(tagged * 3);
});
