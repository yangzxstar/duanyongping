import { test, expect } from 'bun:test';
import { pagePath, readMeta } from '../scraper/lib/progress.mjs';

test('pagePath 用 4 位补零', () => {
  expect(pagePath(1).endsWith('data/raw/page-0001.json')).toBe(true);
  expect(pagePath(561).endsWith('data/raw/page-0561.json')).toBe(true);
});

test('readMeta 在无 meta 文件时返回默认结构', () => {
  const m = readMeta();
  expect(Array.isArray(m.done_pages)).toBe(true);
  expect(Array.isArray(m.failures)).toBe(true);
});
