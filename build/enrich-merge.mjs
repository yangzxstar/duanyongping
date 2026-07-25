import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../scraper/lib/progress.mjs';
import { missingBatches } from './lib/batches.mjs';
import { mergeBatchResults, addEmptyConvDefaults } from './lib/merge.mjs';

const TOTAL_BATCHES = 130;

const enrichDir = join(DATA_DIR, 'enrich');
const outDir = join(enrichDir, 'out');
const convsPath = join(DATA_DIR, 'conversations.json');
const emptyConvsPath = join(enrichDir, 'empty-convs.json');
const enrichedPath = join(DATA_DIR, 'enriched.json');
const warningsPath = join(DATA_DIR, 'enrich-warnings.txt');

for (const [label, path] of [
  ['data/conversations.json', convsPath],
  ['data/enrich/empty-convs.json', emptyConvsPath],
]) {
  if (!existsSync(path)) {
    console.error(`缺少 ${label}`);
    process.exit(1);
  }
}

// ---- 1. 检查 130 批是否齐全 ----
if (!existsSync(outDir)) {
  console.error(`缺少目录 ${outDir}`);
  process.exit(1);
}

const batchFileRe = /^batch-(\d{3})\.json$/;
const doneNos = readdirSync(outDir)
  .map((f) => batchFileRe.exec(f))
  .filter(Boolean)
  .map((m) => Number(m[1]));

const missing = missingBatches(TOTAL_BATCHES, doneNos);
if (missing.length > 0) {
  console.error(
    `批次不全：${TOTAL_BATCHES} 批中缺 ${missing.length} 批 → [${missing.join(', ')}]`
  );
  process.exit(1);
}

// ---- 2. 读 conversations.json，建 id → conv 映射 ----
const convs = JSON.parse(readFileSync(convsPath, 'utf8'));
const convMap = new Map(convs.map((c) => [c.id, c]));

// ---- 3. 逐批读取、逐条校验、合并 ----
const batches = [];
for (let n = 1; n <= TOTAL_BATCHES; n++) {
  const fileName = `batch-${String(n).padStart(3, '0')}.json`;
  const raw = JSON.parse(readFileSync(join(outDir, fileName), 'utf8'));
  batches.push({ label: fileName, results: raw.results });
}

const {
  enriched,
  warnings,
  stats: { mergedResultCount, orphanCount, duplicateCount },
} = mergeBatchResults(batches, convMap);

// ---- 4. 补空内容对话的默认标注 ----
const emptyIds = JSON.parse(readFileSync(emptyConvsPath, 'utf8'));
const { added: emptyAdded, warnings: emptyWarnings } = addEmptyConvDefaults(
  enriched,
  emptyIds,
  convMap
);
warnings.push(...emptyWarnings);
const emptyMissingCount = emptyIds.length - emptyAdded;

// ---- 5. 写出产物 ----
writeFileSync(enrichedPath, JSON.stringify(enriched, null, 1));
writeFileSync(warningsPath, warnings.join('\n') + (warnings.length > 0 ? '\n' : ''));

// ---- 6. 汇总统计 ----
const coverage = Object.keys(enriched).length;
const total = convs.length;
const values = Object.values(enriched);
const substantiveCount = values.filter((v) => v.substantive).length;
const quoteCount = values.reduce((n, v) => n + v.quotes.length, 0);

console.log(`合并批次：${TOTAL_BATCHES}/${TOTAL_BATCHES}`);
console.log(`标注条数（原始 results 累计）：${mergedResultCount}`);
console.log(`  其中孤儿标注（conv_id 不存在，已丢弃）：${orphanCount}`);
console.log(`  其中跨批重复 conv_id：${duplicateCount}`);
console.log(`空内容对话补默认标注：${emptyIds.length}（不存在于 conversations.json：${emptyMissingCount}）`);

const coverageLine = `覆盖：${coverage}/${total}`;
console.log(coverage === total ? coverageLine : `⚠ ${coverageLine}（覆盖不完整！）`);

console.log(`有实质内容（substantive=true）：${substantiveCount} 场`);
console.log(`金句：${quoteCount} 条`);
console.log(`告警：${warnings.length} 条（详见 ${warningsPath}）`);
