// A5 合批阶段的确定性逻辑。入口脚本 build/enrich-merge.mjs 只负责读写文件与打印，
// 判断逻辑全在这里，便于测试。
import { validateEnrichment } from './validate.mjs';

// 空内容对话（posts 全空且没有可判断的 root_question）在切批时就被排除了，
// 不会有 AI 标注，这里统一补一份"什么都没有"的默认标注，保证覆盖率是满的。
export function emptyEnrichment(id) {
  return {
    conv_id: id,
    topics: [],
    companies: [],
    summary: '',
    quotes: [],
    substantive: false,
  };
}

// batches: [{ label, results }]，label 用于告警定位（通常是 batch-NNN.json），
//          results 是该批的原始 results 字段（可能不是数组，模型偶尔会走样）。
// convById: Map<conv_id, conv>，用于判定孤儿标注与给 validateEnrichment 做逐字校验。
// 返回 { enriched, warnings, stats }，同 conv_id 后者覆盖前者。
export function mergeBatchResults(batches, convById) {
  const enriched = Object.create(null);
  const warnings = [];
  let mergedResultCount = 0;
  let orphanCount = 0;
  let duplicateCount = 0;

  for (const batch of batches || []) {
    const label = batch?.label ?? '(未命名批次)';
    const results = batch?.results;
    if (!Array.isArray(results)) {
      warnings.push(`[${label}] 顶层 results 不是数组，本批按 0 条处理`);
      continue;
    }

    for (const entry of results) {
      mergedResultCount++;
      const idCandidate = entry && typeof entry === 'object' ? entry.conv_id : undefined;
      const conv = idCandidate !== undefined ? convById.get(idCandidate) : undefined;

      if (!conv) {
        orphanCount++;
        warnings.push(
          `[${label}] 孤儿标注：conv_id ${JSON.stringify(idCandidate)} 不存在于 conversations.json，已丢弃`
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

  return {
    enriched,
    warnings,
    stats: { mergedResultCount, orphanCount, duplicateCount },
  };
}

// 就地给 enriched 补空内容对话的默认标注。
// 返回 { added, warnings }：added 是实际补上的条数，emptyIds 里不存在于
// convById 的 id 只告警不补（那说明 empty-convs.json 与 conversations.json 不同源）。
export function addEmptyConvDefaults(enriched, emptyIds, convById) {
  const warnings = [];
  let added = 0;

  for (const id of emptyIds || []) {
    if (!convById.has(id)) {
      warnings.push(`空内容对话 id ${id} 不存在于 conversations.json，数据不一致`);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(enriched, id)) {
      warnings.push(`空内容对话 id ${id} 意外已在 AI 批次结果中出现标注，仍以默认空标注覆盖`);
    }
    enriched[id] = emptyEnrichment(id);
    added++;
  }

  return { added, warnings };
}
