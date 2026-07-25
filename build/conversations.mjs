import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../scraper/lib/progress.mjs';
import { toConversations } from './lib/conversations.mjs';

const input = join(DATA_DIR, 'normalized.json');
if (!existsSync(input)) {
  console.error('缺少 data/normalized.json，请先完成子项目一');
  process.exit(1);
}

const records = JSON.parse(readFileSync(input, 'utf8'));
const convs = toConversations(records);
const out = join(DATA_DIR, 'conversations.json');
writeFileSync(out, JSON.stringify(convs));

const threads = convs.filter((c) => c.kind === 'thread').length;
console.log(`${records.length} 条发言 → ${convs.length} 个展示单元（对话 ${threads} / 原创 ${convs.length - threads}）`);
console.log(`时间范围：${convs[convs.length - 1].first_at.slice(0, 10)} ~ ${convs[0].first_at.slice(0, 10)}`);
console.log(`写入 ${out}`);
