// 扫码登录 + 自动跑完流水线。适合人不在电脑旁：
// 脚本把二维码背后的链接写到 /tmp/xq_qr_url.txt 并打印出来，
// 你在手机上打开该链接（会唤起雪球 App 确认登录）即可。
// 二维码会在过期前自动刷新，文件里永远是当前有效的那个。
// 检测到登录成功后，自动依次跑 scrape → merge → backfill → normalize → stats。
//
//   bun scraper/qr-login-and-run.mjs
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { openContext, warmUp, isLoggedIn } from './lib/browser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const URL_FILE = '/tmp/xq_qr_url.txt';

const MAX_WAIT_MS = 12 * 60 * 60 * 1000; // 最多等 12 小时
const POLL_MS = 3000;
const QR_REFRESH_MS = 100 * 1000; // 二维码通常 2 分钟左右过期，提前刷新

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn('bun', [script, ...args], { cwd: ROOT, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} 退出码 ${code}`))));
    p.on('error', reject);
  });
}

// 直接调 generate-qr-code 会 404（缺反爬签名参数），
// 所以改为监听页面自己发出的请求，把最新的二维码链接截下来。
let latestQr = { url: '', code: '', at: 0 };

// 把新二维码直接推到 Telegram，避免「等人转发时码已过期」的死循环。
// 凭据从 channel 的 .env 读，不写入本仓库。
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let pushCount = 0;

async function pushQrToTelegram(url) {
  if (!TG_CHAT || !TG_TOKEN) return;
  pushCount++;
  const png = '/tmp/xq_qr.png';
  await QRCode.toFile(png, url, { width: 600, margin: 2 });
  const form = new FormData();
  form.append('chat_id', TG_CHAT);
  form.append('caption', `雪球登录二维码（第 ${pushCount} 张，约 2 分钟有效）\n扫码或点开：${url}`);
  form.append('photo', new Blob([await Bun.file(png).arrayBuffer()]), 'qr.png');
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: form });
  console.log(`  📤 已推送第 ${pushCount} 张二维码到 Telegram`);
}

function watchQrTraffic(page) {
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('generate-qr-code')) return;
    try {
      const j = JSON.parse(await r.text());
      const url = j?.data?.qr_code || '';
      if (!url) return;
      const m = /code=([0-9a-f]+)/i.exec(url);
      latestQr = { url, code: m ? m[1] : '', at: Date.now() };
      writeFileSync(URL_FILE, url);
      console.log('  🔗 二维码链接：' + url);
      pushQrToTelegram(url).catch(() => {});
    } catch {
      /* 忽略解析失败 */
    }
  });
}

// 让页面重新生成一张二维码：刷新首页并重新进入二维码页签
async function refreshQr(page) {
  await warmUp(page).catch(() => {});
  await page.locator('a:has-text("二维码登录")').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

// status: 0=未扫描，非 0 表示已扫描/已确认
async function queryQrState(page, code) {
  if (!code) return -1;
  return page.evaluate(async (c) => {
    try {
      const r = await fetch(`/snb/provider/query-qr-code-state?code=${c}`, { credentials: 'include' });
      const j = await r.json();
      return j?.data?.status ?? -1;
    } catch {
      return -1;
    }
  }, code);
}

const { ctx, page } = await openContext({ headless: false });
await warmUp(page);

if (await isLoggedIn(page)) {
  console.log('✅ 已是登录状态，直接开始抓取。');
  await ctx.close();
} else {
  watchQrTraffic(page);
  await refreshQr(page);

  if (!latestQr.url) {
    console.log('❌ 没能截获二维码链接，请改用 bun run auto（人工拖滑块）。');
    await ctx.close().catch(() => {});
    process.exit(1);
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log(' 📱 在手机上打开下面这个链接，会唤起雪球 App 确认登录：');
  console.log('');
  console.log('   ' + latestQr.url);
  console.log('');
  console.log(' 链接也写在 ' + URL_FILE + '（过期会自动换新）。');
  console.log(' 确认登录后什么都不用管，脚本会自动抓完全部发言。');
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  const deadline = Date.now() + MAX_WAIT_MS;
  let ok = false;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      if (await isLoggedIn(page)) {
        ok = true;
        break;
      }
      const st = await queryQrState(page, latestQr.code);
      if (st !== lastStatus) {
        lastStatus = st;
        console.log(`  二维码状态变化：status=${st}`);
      }
      // status 0=未扫描 4=已过期；这两种情况都该换新码。
      // 其它非零状态多为「已扫描待确认」，不要打断。
      const stale = Date.now() - latestQr.at > QR_REFRESH_MS;
      if (st === 4 || (stale && st === 0)) {
        await refreshQr(page);
      }
    } catch {
      console.log('浏览器已关闭，脚本退出。');
      process.exit(1);
    }
  }

  if (!ok) {
    console.log('❌ 等待超时，未检测到登录。');
    await ctx.close().catch(() => {});
    process.exit(1);
  }
  console.log('✅ 扫码登录成功！会话已保存，开始自动抓取。');
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
