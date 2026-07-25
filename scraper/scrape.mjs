import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { openContext, warmUp, USER_ID } from './lib/browser.mjs';
import { fetchJson } from './lib/waf.mjs';
import { DATA_DIR, ensureDirs, pagePath, readMeta, writeMeta, donePagesOnDisk } from './lib/progress.mjs';

const args = process.argv.slice(2);

// 增量模式：bun run scrape --since-latest
// 从第 1 页往后抓，遇到「整页都是已知 id」就停——用于全量抓完后的日常补新。
const SINCE_LATEST = args.includes('--since-latest');

// 可选：bun run scrape 3  → 只抓前 3 页（冒烟验证用）
const limitArg = Number(args.find((a) => /^\d+$/.test(a)));
const PAGE_LIMIT = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 1500 + Math.floor(Math.random() * 2500);

// 增量模式下加载已知 id 集合
function knownIds() {
  const f = join(DATA_DIR, 'statuses.json');
  if (!existsSync(f)) return new Set();
  return new Set(JSON.parse(readFileSync(f, 'utf8')).map((s) => s.id));
}
const KNOWN = SINCE_LATEST ? knownIds() : new Set();
if (SINCE_LATEST) console.log(`增量模式：已知 ${KNOWN.size} 条，遇到整页已知即停止`);

ensureDirs();
const meta = readMeta();
if (!meta.started_at) meta.started_at = new Date().toISOString();

const { ctx, page } = await openContext({ headless: true });
try {
  await warmUp(page);

  // 第 1 页顺带确定总页数
  const first = await fetchJson(page, `/statuses/user_timeline.json?user_id=${USER_ID}&page=1`);
  meta.total = first.total;
  meta.maxPage = first.maxPage;
  writeFileSync(pagePath(1), JSON.stringify(first));
  console.log(`总计 ${first.total} 条 / ${first.maxPage} 页`);

  const lastPage = PAGE_LIMIT ? Math.min(PAGE_LIMIT, first.maxPage) : first.maxPage;
  const done = donePagesOnDisk();
  meta.failures = [];

  for (let p = 2; p <= lastPage; p++) {
    // 续抓：跳过已落盘的页。增量模式不跳过——新发言会让分页整体后移。
    if (!SINCE_LATEST && done.has(p)) continue;
    await sleep(jitter());
    try {
      const data = await fetchJson(page, `/statuses/user_timeline.json?user_id=${USER_ID}&page=${p}`);
      writeFileSync(pagePath(p), JSON.stringify(data));
      const list = data.statuses || [];
      const n = list.length;
      console.log(`page ${p}/${lastPage} ✓ ${n} 条`);
      if (n === 0) console.warn(`  ⚠ page ${p} 返回 0 条`);
      if (SINCE_LATEST && n > 0 && list.every((s) => KNOWN.has(s.id))) {
        console.log(`  整页均为已知发言，增量抓取到此为止（page ${p}）`);
        break;
      }
    } catch (e) {
      console.error(`page ${p} ✗ ${e.message}`);
      meta.failures.push({ page: p, error: e.message, at: new Date().toISOString() });
      if (e.message.includes('未登录')) break; // 会话失效，立即停止，保留 checkpoint
    }
    meta.updated_at = new Date().toISOString();
    writeMeta(meta);
  }
} finally {
  meta.updated_at = new Date().toISOString();
  meta.done_pages = [...donePagesOnDisk()].sort((a, b) => a - b);
  writeMeta(meta);
  await ctx.close();
}

const finalMeta = readMeta();
console.log(`\n已落盘 ${finalMeta.done_pages.length} 页，失败 ${finalMeta.failures.length} 页。`);
if (finalMeta.failures.length) console.log('失败页可重新运行 bun run scrape 自动续抓。');
