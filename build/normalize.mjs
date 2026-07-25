import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../scraper/lib/progress.mjs';
import { toRecord } from './lib/record.mjs';

const input = join(DATA_DIR, 'statuses.json');
if (!existsSync(input)) {
  console.error('缺少 data/statuses.json，请先运行 bun run merge');
  process.exit(1);
}

const all = JSON.parse(readFileSync(input, 'utf8'));
const records = all.map(toRecord).sort((a, b) => b.created_at.localeCompare(a.created_at));

const out = join(DATA_DIR, 'normalized.json');
writeFileSync(out, JSON.stringify(records));
console.log(`规整 ${records.length} 条 → ${out}`);
console.log(
  `时间范围：${records[records.length - 1].created_at.slice(0, 10)} ~ ${records[0].created_at.slice(0, 10)}`
);
