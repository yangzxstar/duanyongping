import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../scraper/lib/progress.mjs';
import { toAiPayload, splitBatches, batchFileName, isEmptyPayload } from './lib/batches.mjs';

const BATCH_SIZE = 40;
const input = join(DATA_DIR, 'conversations.json');
if (!existsSync(input)) {
  console.error('缺少 data/conversations.json，请先运行 bun run conversations');
  process.exit(1);
}

const convs = JSON.parse(readFileSync(input, 'utf8'));
const enrichDir = join(DATA_DIR, 'enrich');
const inDir = join(enrichDir, 'in');
mkdirSync(inDir, { recursive: true });
mkdirSync(join(enrichDir, 'out'), { recursive: true });

const allPayloads = convs.map(toAiPayload);
const emptyIds = allPayloads.filter(isEmptyPayload).map((p) => p.conv_id);
const payloads = allPayloads.filter((p) => !isEmptyPayload(p));

const emptyConvsPath = join(enrichDir, 'empty-convs.json');
writeFileSync(emptyConvsPath, JSON.stringify(emptyIds, null, 1));

const batches = splitBatches(payloads, BATCH_SIZE);
for (const b of batches) {
  writeFileSync(join(inDir, batchFileName(b.batch_no)), JSON.stringify(b.items, null, 1));
}

const chars = batches.reduce(
  (n, b) => n + b.items.reduce((m, i) => m + (i.root_question || '').length + i.posts.reduce((k, p) => k + p.text.length, 0), 0),
  0
);
console.log(`${convs.length} 场 → ${batches.length} 批（每批 ${BATCH_SIZE}），写入 ${inDir}`);
console.log(`排除空内容对话 ${emptyIds.length} 场（无可标注正文/提问），已写入 ${emptyConvsPath}`);
console.log(`喂 AI 总字符 ${chars.toLocaleString()} ≈ ${Math.round(chars / 1.6 / 1000)}K tokens`);
