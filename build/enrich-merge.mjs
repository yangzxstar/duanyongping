import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../scraper/lib/progress.mjs';
import { missingBatches } from './lib/batches.mjs';
import { validateEnrichment } from './lib/validate.mjs';

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
const enriched = {};
const warnings = [];
let mergedResultCount = 0;
let orphanCount = 0;
let duplicateCount = 0;

for (let n = 1; n <= TOTAL_BATCHES; n++) {
  const fileName = `batch-${String(n).padStart(3, '0')}.json`;
  const filePath = join(outDir, fileName);
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  const results = Array.isArray(raw.results) ? raw.results : [];
  if (!Array.isArray(raw.results)) {
    warnings.push(`[${fileName}] 顶层 results 不是数组，本批按 0 条处理`);
  }

  for (const entry of results) {
    mergedResultCount++;
    const idCandidate = entry && typeof entry === 'object' ? entry.conv_id : undefined;
    const conv = idCandidate !== undefined ? convMap.get(idCandidate) : undefined;

    if (!conv) {
      orphanCount++;
      warnings.push(
        `[${fileName}] 孤儿标注：conv_id ${JSON.stringify(idCandidate)} 不存在于 conversations.json，已丢弃`
      );
      continue;
    }

    const { clean, warnings: w } = validateEnrichment(entry, conv);
    warnings.push(...w);

    if (Object.prototype.hasOwnProperty.call(enriched, clean.conv_id)) {
      duplicateCount++;
      warnings.push(`conv_id ${clean.conv_id} 出现多条标注（跨批重复），以最后一条为准`);
    }
    enriched[clean.conv_id] = clean;
  }
}

// ---- 4. 补空内容对话的默认标注 ----
const emptyIds = JSON.parse(readFileSync(emptyConvsPath, 'utf8'));
let emptyMissingCount = 0;

for (const id of emptyIds) {
  if (!convMap.has(id)) {
    emptyMissingCount++;
    warnings.push(`空内容对话 id ${id} 不存在于 conversations.json，数据不一致`);
    continue;
  }
  if (Object.prototype.hasOwnProperty.call(enriched, id)) {
    warnings.push(
      `空内容对话 id ${id} 意外已在 AI 批次结果中出现标注，仍以默认空标注覆盖`
    );
  }
  enriched[id] = {
    conv_id: id,
    topics: [],
    companies: [],
    summary: '',
    quotes: [],
    substantive: false,
  };
}

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
