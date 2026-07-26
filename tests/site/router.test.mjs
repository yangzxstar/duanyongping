import { test, expect } from 'bun:test';
import { parseRoute, routeTo } from '../../site/router.js';

test.each([
  ['', 'timeline', null],
  ['#/', 'timeline', null],
  ['#/conv/solo-401883730', 'conv', 'solo-401883730'],
  ['#/topics', 'topics', null],
  ['#/topic/%E4%BC%81%E4%B8%9A%E7%BB%8F%E8%90%A5-%E6%9C%AC%E5%88%86', 'topic', '企业经营-本分'],
  ['#/companies', 'companies', null],
  ['#/company/%E8%8B%B9%E6%9E%9C', 'company', '苹果'],
  ['#/overview', 'overview', null],
  ['#/search/%E8%8C%85%E5%8F%B0', 'search', '茅台'],
  ['#/garbage/x/y', 'timeline', null],
  ['#/conv', 'timeline', null],
])('parseRoute(%s) → %s / %s', (hash, view, param) => {
  expect(parseRoute(hash)).toEqual({ view, param });
});

test('routeTo 与 parseRoute 互逆', () => {
  expect(parseRoute(routeTo('company', '苹果'))).toEqual({ view: 'company', param: '苹果' });
  expect(routeTo('timeline')).toBe('#/');
  expect(routeTo('topics')).toBe('#/topics');
});
