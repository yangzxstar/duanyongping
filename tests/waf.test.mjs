import { test, expect } from 'bun:test';
import { classifyResponse } from '../scraper/lib/waf.mjs';

test('识别正常 JSON 响应', () => {
  const raw = JSON.stringify({ count: 20, statuses: [{ id: 1 }], total: 11209, maxPage: 561 });
  const r = classifyResponse(raw);
  expect(r.kind).toBe('json');
  expect(r.data.statuses.length).toBe(1);
});

test('识别 WAF 挑战页', () => {
  const raw =
    '<textarea id="renderData" style="display:none">{"_waf_bd8ce2ce37":"abc"}</textarea><!doctype html><html>';
  expect(classifyResponse(raw).kind).toBe('waf');
});

test('识别未登录错误', () => {
  const raw = JSON.stringify({
    error_description: '请登录雪球查看更多内容',
    error_code: '400016',
  });
  const r = classifyResponse(raw);
  expect(r.kind).toBe('login');
  expect(r.message).toContain('请登录');
});

test('识别其他 JSON 错误为 invalid', () => {
  const raw = JSON.stringify({ error_description: '参数错误', error_code: '400' });
  expect(classifyResponse(raw).kind).toBe('invalid');
});

test('识别非 JSON 非 WAF 的垃圾响应为 invalid', () => {
  expect(classifyResponse('<html>502 Bad Gateway</html>').kind).toBe('invalid');
});
