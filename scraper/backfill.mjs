import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { openContext, warmUp } from './lib/browser.mjs';
import { fetchJson } from './lib/waf.mjs';
import { DATA_DIR, readMeta, writeMeta } from './lib/progress.mjs';

// 详情端点在登录后才能验证，因此运行时自动探测：用第一条截断样本挨个试，
// 取第一个能返回更长正文的端点，之后固定用它。
const CANDIDATE_ENDPOINTS = [
  (id) => `/statuses/show/text.json?status_id=${id}`,
  (id) => `/statuses/show.json?id=${id}`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 1200 + Math.floor(Math.random() * 1800);

const file = join(DATA_DIR, 'statuses.json');
const all = JSON.parse(readFileSync(file, 'utf8'));
const targets = all.filter((s) => s.truncated && !s._backfilled);
console.log(`需要补抓 ${targets.length} 条长文`);

if (targets.length === 0) process.exit(0);

const meta = readMeta();
const { ctx, page } = await openContext({ headless: true });
let ok = 0;

// 用一条样本探测可用端点
async function pickEndpoint(sample) {
  for (const ep of CANDIDATE_ENDPOINTS) {
    try {
      const j = await fetchJson(page, ep(sample.id), { maxRetries: 1 });
      const full = j.text || j.description || '';
      if (full.length > (sample.text || '').length) {
        console.log(`使用详情端点：${ep('<id>')}`);
        return ep;
      }
      console.log(`端点 ${ep('<id>')} 返回正文未变长，试下一个`);
    } catch (e) {
      console.log(`端点 ${ep('<id>')} 不可用：${e.message.slice(0, 80)}`);
    }
  }
  return null;
}

try {
  await warmUp(page);
  const endpoint = await pickEndpoint(targets[0]);
  if (!endpoint) {
    console.error('没有可用的详情端点，保留截断标记，规整时会置 text_truncated: true');
    meta.failures.push({
      backfill: 'no_endpoint',
      error: '所有候选详情端点均不可用',
      at: new Date().toISOString(),
    });
    writeMeta(meta);
    await ctx.close();
    process.exit(0);
  }

  for (const [i, s] of targets.entries()) {
    await sleep(jitter());
    try {
      const j = await fetchJson(page, endpoint(s.id));
      const full = j.text || j.description || '';
      if (full.length > (s.text || '').length) {
        s.text = full;
        s.truncated = false;
        s._backfilled = true;
        ok++;
      } else {
        meta.failures.push({
          backfill_id: s.id,
          error: '详情返回未变长',
          at: new Date().toISOString(),
        });
      }
    } catch (e) {
      meta.failures.push({ backfill_id: s.id, error: e.message, at: new Date().toISOString() });
    }
    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${targets.length}，成功 ${ok}`);
      writeFileSync(file, JSON.stringify(all)); // 阶段性落盘
    }
  }
} finally {
  writeFileSync(file, JSON.stringify(all));
  meta.updated_at = new Date().toISOString();
  writeMeta(meta);
  await ctx.close();
}
console.log(`补抓完成：成功 ${ok}/${targets.length}，失败见 data/meta.json 的 failures`);
