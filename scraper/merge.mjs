import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DATA_DIR, pagePath, donePagesOnDisk } from './lib/progress.mjs';

const pages = [...donePagesOnDisk()].sort((a, b) => a - b);
if (pages.length === 0) {
  console.error('data/raw/ 下没有任何页，请先运行 bun run scrape');
  process.exit(1);
}

const byId = new Map();
let rawCount = 0;
for (const p of pages) {
  const j = JSON.parse(readFileSync(pagePath(p), 'utf8'));
  for (const s of j.statuses || []) {
    rawCount++;
    byId.set(s.id, s); // 同 id 后者覆盖前者
  }
}

const all = [...byId.values()].sort((a, b) => b.created_at - a.created_at);
const out = join(DATA_DIR, 'statuses.json');
writeFileSync(out, JSON.stringify(all));

console.log(`合并 ${pages.length} 页：原始 ${rawCount} 条 → 去重后 ${all.length} 条`);
console.log(
  `时间范围：${new Date(all[all.length - 1].created_at).toISOString().slice(0, 10)} ~ ${new Date(all[0].created_at).toISOString().slice(0, 10)}`
);
console.log(`写入 ${out}`);
