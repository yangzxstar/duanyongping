import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, '..', '..');
export const PROFILE_DIR = join(PROJECT_ROOT, 'scraper', '.profile');

// 需要完整 Chromium（headless shell 缺可执行文件，不能用）；
// 默认用 Playwright 自带的，可用 CHROMIUM_PATH 环境变量指定本机缓存的浏览器
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || undefined;

export const XUEQIU_HOME = 'https://xueqiu.com/';
export const USER_ID = '1247347556';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

export async function openContext({ headless = true } = {}) {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    executablePath: CHROMIUM_PATH,
    args: ['--disable-blink-features=AutomationControlled'],
    userAgent: UA,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1400, height: 900 },
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  return { ctx, page };
}

// 只导航首页：直连 /u/{id} 会被 WAF 判 405
export async function warmUp(page) {
  await page.goto(XUEQIU_HOME, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
}

export async function isLoggedIn(page) {
  return page.evaluate(async () => {
    try {
      const r = await fetch('/statuses/user_timeline.json?user_id=1247347556&page=2', {
        credentials: 'include',
      });
      const t = await r.text();
      const j = JSON.parse(t);
      return Array.isArray(j.statuses);
    } catch {
      return false;
    }
  });
}
