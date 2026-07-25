import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../scraper/lib/progress.mjs';

const input = join(DATA_DIR, 'normalized.json');
if (!existsSync(input)) {
  console.error('缺少 data/normalized.json，请先运行 bun run normalize');
  process.exit(1);
}
const rs = JSON.parse(readFileSync(input, 'utf8'));

const tally = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) for (const k of [].concat(keyFn(x))) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const byType = tally(rs, (r) => r.type);
const byYear = tally(rs, (r) => r.year).sort((a, b) => a[0] - b[0]);
const byStock = tally(rs, (r) => r.stocks.map((s) => `${s.name}(${s.symbol})`));
const bySource = tally(rs, (r) => r.source || '(未知)');
const lens = rs.map((r) => r.char_count).sort((a, b) => a - b);
const pct = (p) => lens[Math.floor((lens.length - 1) * p)];
const topLiked = [...rs].sort((a, b) => b.stats.like - a.stats.like).slice(0, 20);

const stats = {
  generated_at: new Date().toISOString(),
  total: rs.length,
  date_range: [rs[rs.length - 1].created_at.slice(0, 10), rs[0].created_at.slice(0, 10)],
  by_type: Object.fromEntries(byType),
  by_year: Object.fromEntries(byYear),
  by_source: Object.fromEntries(bySource.slice(0, 15)),
  top_stocks: byStock.slice(0, 50).map(([k, v]) => ({ stock: k, count: v })),
  char_count: { p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: lens[lens.length - 1] },
  long_posts_over_500: rs.filter((r) => r.char_count > 500).length,
  still_truncated: rs.filter((r) => r.text_truncated).length,
  with_images: rs.filter((r) => r.images.length > 0).length,
  top_liked: topLiked.map((r) => ({
    date: r.created_at.slice(0, 10),
    like: r.stats.like,
    chars: r.char_count,
    url: r.url,
    preview: r.text_plain.slice(0, 60),
  })),
};

writeFileSync(join(DATA_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

console.log(`总计 ${stats.total} 条，${stats.date_range[0]} ~ ${stats.date_range[1]}`);
console.log('\n按类型：', stats.by_type);
console.log('\n按年份：');
for (const [y, n] of byYear) console.log(`  ${y}: ${'█'.repeat(Math.ceil(n / 50))} ${n}`);
console.log('\n提及最多的标的（Top 20）：');
for (const { stock, count } of stats.top_stocks.slice(0, 20)) console.log(`  ${stock}: ${count}`);
console.log('\n篇幅分布（字符）：', stats.char_count);
console.log(`超过 500 字的长文：${stats.long_posts_over_500} 条`);
console.log(`仍被截断未补全：${stats.still_truncated} 条`);
console.log(`带图片：${stats.with_images} 条`);
console.log('\n写入 data/stats.json');
