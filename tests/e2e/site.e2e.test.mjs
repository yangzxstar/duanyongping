import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';

const RUN = process.env.E2E === '1';

function startServer() {
  return Bun.serve({
    port: 0,
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p === '/') p = '/index.html';
      const f = Bun.file('site' + p);
      return (await f.exists()) ? new Response(f) : new Response('not found', { status: 404 });
    },
  });
}

describe.skipIf(!RUN)('站点端到端', () => {
  let server, browser, page, base;

  beforeAll(async () => {
    server = startServer();
    base = `http://localhost:${server.port}`;
    browser = await chromium.launch();
    page = await browser.newPage();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    server?.stop(true);
  });

  test('时间线首屏：渲染精华卡片，他的话高亮，可回雪球', async () => {
    await page.goto(base + '/');
    await page.waitForSelector('#cards article.card');
    expect(await page.locator('#cards article.card').count()).toBeGreaterThan(10);
    expect(await page.locator('#cards .msg.dao').count()).toBeGreaterThan(0);
    expect(await page.locator('.src[href^="https://xueqiu.com/"]').count()).toBeGreaterThan(0);
  }, 30_000);

  test('取消「只看精华」后仍可分页加载全部', async () => {
    await page.goto(base + '/');
    await page.waitForSelector('#cards article.card');
    await page.uncheck('#f-featured');
    await page.waitForSelector('#cards article.card');
    // 全部 5174 > 精华 806：加载更多按钮必然可见
    expect(await page.locator('#more').isVisible()).toBe(true);
    const before = await page.locator('#cards article.card').count();
    await page.click('#more');
    await page.waitForFunction(
      (n) => document.querySelectorAll('#cards article.card').length > n,
      before,
    );
    expect(await page.locator('#cards article.card').count()).toBeGreaterThan(before);
  }, 30_000);

  test('年份下拉标注空窗年', async () => {
    await page.goto(base + '/');
    await page.waitForSelector('#f-year');
    const options = await page.locator('#f-year option').allTextContents();
    expect(options.some((t) => t.includes('空窗年'))).toBe(true);
  }, 30_000);
});
