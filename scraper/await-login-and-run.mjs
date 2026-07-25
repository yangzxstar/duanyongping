// 无人值守流程：打开浏览器并把登录表单填好、提交到「拖动滑块」这一步，
// 然后一直等你回到电脑前拖那一下。检测到登录成功后，自动跑完整条流水线。
//
//   XUEQIU_PHONE=... XUEQIU_PASSWORD=... bun scraper/await-login-and-run.mjs
//
// 想中止：关掉浏览器窗口，或 Ctrl-C / kill 掉本进程。
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { openContext, warmUp, isLoggedIn } from './lib/browser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const PHONE = process.env.XUEQIU_PHONE || '';
const PASSWORD = process.env.XUEQIU_PASSWORD || '';

const MAX_WAIT_MS = 12 * 60 * 60 * 1000; // 最多等 12 小时
const POLL_MS = 5000;

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn('bun', [script, ...args], { cwd: ROOT, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} 退出码 ${code}`))));
    p.on('error', reject);
  });
}

const { ctx, page } = await openContext({ headless: false });
await warmUp(page);

if (await isLoggedIn(page)) {
  console.log('✅ 已是登录状态，直接开始抓取。');
  await ctx.close();
} else {
  // 把密码登录表单填好并提交，停在滑块那一步
  if (PHONE && PASSWORD) {
    const tab = page.locator('a:has-text("账号密码登录")').first();
    if (await tab.count()) {
      await tab.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await page.locator('input[name="username"]').first().fill(PHONE).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('input[name="password"]').first().fill(PASSWORD).catch(() => {});
    await page.waitForTimeout(300);
    const agree = page.locator('i[class*="newLogin_nochecked"]').first();
    if (await agree.count()) {
      await agree.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await page
      .locator('[class*="newLogin_modal__login__btn"]')
      .first()
      .click({ timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(3000);
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log(' 浏览器已打开，账号密码都填好了，只差最后一步人机验证。');
  console.log(' 👉 请把滑块拖到拼图缺口处（大约 3 秒的事）。');
  console.log('');
  console.log(' 拖完之后什么都不用管：本脚本会自动开始抓取全部约 11,209 条');
  console.log(' 发言，并依次完成合并、长文补抓、规整、统计。');
  console.log(' 想中止就关掉浏览器窗口或结束本进程。');
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  const deadline = Date.now() + MAX_WAIT_MS;
  let ok = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      if (await isLoggedIn(page)) {
        ok = true;
        break;
      }
    } catch {
      // 浏览器被关掉了
      console.log('浏览器已关闭，脚本退出。');
      process.exit(1);
    }
  }

  if (!ok) {
    console.log('❌ 等待超时，未检测到登录。');
    await ctx.close().catch(() => {});
    process.exit(1);
  }

  console.log('✅ 登录成功！会话已保存，开始自动抓取。');
  await ctx.close().catch(() => {});
}

const started = Date.now();
try {
  console.log('\n▶ 1/5 抓取全部分页（约半小时）…');
  await run('scraper/scrape.mjs');
  console.log('\n▶ 2/5 合并去重…');
  await run('scraper/merge.mjs');
  console.log('\n▶ 3/5 补抓截断长文…');
  await run('scraper/backfill.mjs');
  console.log('\n▶ 4/5 规整数据集…');
  await run('build/normalize.mjs');
  console.log('\n▶ 5/5 生成统计概览…');
  await run('build/stats.mjs');
  const mins = Math.round((Date.now() - started) / 60000);
  console.log(`\n🎉 全部完成，用时 ${mins} 分钟。数据在 data/normalized.json，概览在 data/stats.json`);
} catch (e) {
  console.error(`\n❌ 流水线中断：${e.message}`);
  console.error('可单独重跑失败的那一步，抓取支持断点续抓。');
  process.exit(1);
}
