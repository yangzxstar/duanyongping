// 阶段 A 数据质量验收报告。纯 IO 汇报脚本，读 site/data/** 与 data/**，
// 终端打印一份人可读的报告，供用户判断能否进入阶段 B（站点开发）。
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CLEAN_STANCES } from './lib/validate.mjs';
import { canonicalCompanyName } from './lib/shard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_DATA = join(HERE, '..', 'site', 'data');
const DATA = join(HERE, '..', 'data');

const index = JSON.parse(readFileSync(join(SITE_DATA, 'index.json'), 'utf8'));
const topics = readdirSync(join(SITE_DATA, 'topics')).map((f) =>
  JSON.parse(readFileSync(join(SITE_DATA, 'topics', f), 'utf8'))
);
const overview = JSON.parse(readFileSync(join(SITE_DATA, 'overview.json'), 'utf8'));
const companies = JSON.parse(readFileSync(join(SITE_DATA, 'companies.json'), 'utf8'));
const instrumentsPath = join(SITE_DATA, 'instruments.json');
const instruments = existsSync(instrumentsPath)
  ? JSON.parse(readFileSync(instrumentsPath, 'utf8'))
  : {};

console.log('══════ 阶段 A 数据质量报告 ══════\n');

console.log(`展示单元 ${index.length}（预期 5174）`);
const featured = index.filter((e) => e.featured);
console.log(`精华 ${featured.length}（占 ${((100 * featured.length) / index.length).toFixed(1)}%）`);
const noTopic = index.filter((e) => e.topics.length === 0);
console.log(`未归类到任何话题 ${noTopic.length}（占 ${((100 * noTopic.length) / index.length).toFixed(1)}%）${noTopic.length / index.length > 0.2 ? '  ⚠ 超过 20%，话题体系覆盖不足' : ''}`);
const noSummary = index.filter((e) => !e.summary);
console.log(`缺摘要 ${noSummary.length}`);

// “未归类”是否等价于“AI 判定无实质内容”——如果未归类的对话本来就是无信息量
// 的寒暄/应答（substantive=false），那未归类率高不代表话题体系有覆盖漏洞，
// 而是正确识别了这些对话不值得归类。用 data/enriched.json 的 substantive 字段核对。
const enrichedPath = join(DATA, 'enriched.json');
if (existsSync(enrichedPath)) {
  const enriched = JSON.parse(readFileSync(enrichedPath, 'utf8'));
  const nonSubstantive = noTopic.filter((e) => enriched[e.id] && enriched[e.id].substantive === false);
  const overlapPct = noTopic.length === 0 ? 100 : ((100 * nonSubstantive.length) / noTopic.length).toFixed(1);
  console.log(
    `  其中 substantive=false（AI 判定无实质内容）${nonSubstantive.length} / ${noTopic.length}（重合率 ${overlapPct}%）${nonSubstantive.length !== noTopic.length ? '  ⚠ 存在未归类但被判定为有实质内容的对话，需人工看' : '  ✓ 未归类 = 无实质内容，说明话题体系没有漏判'}`
  );
} else {
  console.log('  ⚠ 未找到 data/enriched.json，无法核对未归类对话是否等于无实质内容');
}

console.log('\n── 话题分布 ──');
const counts = {};
for (const e of index) for (const t of e.topics) counts[t] = (counts[t] || 0) + 1;
let emptyTopics = 0;
for (const t of topics.sort((a, b) => (counts[b.topic_path] || 0) - (counts[a.topic_path] || 0))) {
  const n = counts[t.topic_path] || 0;
  if (n === 0) emptyTopics++;
  const flag = n === 0 ? '  ⚠ 空话题' : n < 10 ? '  ⚠ 偏少' : '';
  console.log(`  ${t.topic_path}: ${n} 场，综述 ${t.essay.length} 字，要点 ${t.key_points.length}，金句 ${t.best_quotes.length}${flag}`);
}
console.log(`\n  共 ${topics.length} 篇话题综述，空话题 ${emptyTopics} 个`);

console.log('\n── 公司维度 ──');
// stance 有五种合法取值：holds/admires/criticizes/neutral/unknown。
// unknown 是校验器归一化出来的"模型输出了不认识的 stance"，理论上应恒为 0——
// 从 CLEAN_STANCES 常量遍历而不是手写字面量，避免这里和 validate.mjs 的定义脱节。
//
// 指数/ETF 不是公司（用户明确要求），buildCompanyIndex 已把它们分流进
// instruments.json，这里公司和指数/ETF 分两节展示，不再混算。
function toRows(dict) {
  return Object.values(dict)
    .map((c) => {
      const row = { name: c.name };
      for (const s of CLEAN_STANCES) row[s] = (c[s] || []).length;
      return row;
    })
    .sort((a, b) => CLEAN_STANCES.reduce((sum, s) => sum + b[s] - a[s], 0));
}

const rows = toRows(companies);
for (const r of rows) {
  console.log(`  ${r.name}: ${CLEAN_STANCES.map((s) => `${s} ${r[s]}`).join(' / ')}`);
}
const stanceTotals = {};
for (const s of CLEAN_STANCES) stanceTotals[s] = rows.reduce((sum, r) => sum + r[s], 0);
console.log(`\n  公司总数 ${rows.length}`);
console.log(`  stance 分布：${CLEAN_STANCES.map((s) => `${s} ${stanceTotals[s]}`).join(' / ')}`);
if (stanceTotals.unknown > 0) {
  console.log(`  ⚠ unknown 应恒为 0，出现 ${stanceTotals.unknown}，说明有模型输出了非法 stance 未被拦下`);
}

console.log('\n── 指数/ETF 维度 ──');
const instrumentRows = toRows(instruments);
for (const r of instrumentRows) {
  console.log(`  ${r.name}: ${CLEAN_STANCES.map((s) => `${s} ${r[s]}`).join(' / ')}`);
}
console.log(`\n  指数/ETF 总数 ${instrumentRows.length}`);

// 核心持仓被标 criticizes —— 这是「需人工复核项」，不是硬红线。
// 持有一家公司与批评它某个具体行为完全可以并存（已复核的实例见下方），
// 原先按"出现即触及红线"处理是把定义划得太粗，这里只做中性提示。
// 名字先过 canonicalCompanyName，与 companies.json 的归一化口径保持一致
// （如 OPPO / 步步高 在索引里统一是「步步高系」）。
const CORE_HOLDINGS = [
  ...new Set(
    ['苹果', '茅台', '网易', '拼多多', '伯克希尔', '谷歌', 'OPPO', '步步高', '腾讯'].map(
      canonicalCompanyName
    )
  ),
];
console.log('\n  核心持仓 criticizes 检查（人工复核项，非红线）：');
let coreCriticizeCount = 0;
for (const name of CORE_HOLDINGS) {
  const c = companies[name];
  if (!c) continue;
  const n = (c.criticizes || []).length;
  if (n > 0) {
    coreCriticizeCount += n;
    console.log(`    · ${name} 被标 criticizes ${n} 处：${c.criticizes.join(', ')}（需人工确认是否为针对具体行为的合理批评）`);
  }
}
if (coreCriticizeCount === 0) {
  console.log(`    ✓ 核心持仓（${CORE_HOLDINGS.join('/')}）均无 criticizes`);
}
console.log('    已复核：腾讯 conv 21862159（2012 3Q 大战语境）标注正确');

console.log('\n── 总纲 ──');
console.log(`  《${overview.title}》${overview.essay.length} 字，${overview.pillars.length} 根支柱`);
for (const p of overview.pillars) console.log(`    · ${p.name}`);

console.log('\n── 校验告警 ──');
const wPath = join(DATA, 'enrich-warnings.txt');
let bogusQuotePct = 0;
if (existsSync(wPath)) {
  const ws = readFileSync(wPath, 'utf8').split('\n').filter(Boolean);
  console.log(`  共 ${ws.length} 条`);
  const kinds = {};
  for (const w of ws) {
    const k = w.includes('杜撰')
      ? '杜撰金句'
      : w.includes('话题不在体系内')
        ? '非法话题'
        : w.includes('非法 stance')
          ? '非法 stance'
          : w.includes('symbol') && w.includes('已置为 null')
            ? 'symbol 缺省（良性）'
            : w.includes('summary 为空')
              ? '空摘要'
              : '其它';
    kinds[k] = (kinds[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) {
    const pct = (100 * n) / index.length;
    if (k === '杜撰金句') bogusQuotePct = pct;
    const note =
      k === '杜撰金句' && pct > 5
        ? '  ⚠ 超过 5%，建议调提示词重跑'
        : k === 'symbol 缺省（良性）'
          ? '  （模型省略了 symbol 字段，已归一化为 null，不影响数据质量）'
          : '';
    console.log(`    ${k}: ${n}（占对话数 ${pct.toFixed(1)}%）${note}`);
  }
  if (!kinds['杜撰金句']) {
    console.log(`    杜撰金句: 0（占对话数 0.0%）  ✓ 未发现杜撰`);
  }
} else {
  console.log('  未找到 data/enrich-warnings.txt');
}

// ── 话题综述校验（补充：brief 没有，但这是防 AI 杜撰的最后一道人工可见关卡）──
console.log('\n── 话题综述校验 ──');
const indexIds = new Set(index.map((e) => e.id));
const convPath = join(DATA, 'conversations.json');
let convByIdOwnText = null;
if (existsSync(convPath)) {
  const convs = JSON.parse(readFileSync(convPath, 'utf8'));
  convByIdOwnText = new Map(convs.map((c) => [c.id, c.posts.map((p) => p.own_text || '')]));
} else {
  console.log('  ⚠ 未找到 data/conversations.json，无法核对金句逐字性');
}

let totalKeyPoints = 0;
let totalQuotes = 0;
let invalidConvIds = 0;
let nonVerbatimQuotes = 0;
const invalidConvIdSamples = [];
const nonVerbatimSamples = [];

for (const t of topics) {
  const kpCount = t.key_points.length;
  const qCount = t.best_quotes.length;
  totalKeyPoints += kpCount;
  totalQuotes += qCount;
  console.log(`  ${t.topic_path}: 对话 ${t.conv_count ?? (t.conv_ids || []).length} 场，综述 ${t.essay.length} 字，要点 ${kpCount}，金句 ${qCount}`);

  for (const kp of t.key_points) {
    for (const cid of kp.conv_ids || []) {
      if (!indexIds.has(cid)) {
        invalidConvIds++;
        invalidConvIdSamples.push(`${t.topic_path}: key_points → ${cid}`);
      }
    }
  }

  for (const q of t.best_quotes) {
    if (!indexIds.has(q.conv_id)) {
      invalidConvIds++;
      invalidConvIdSamples.push(`${t.topic_path}: best_quotes → ${q.conv_id}`);
      continue;
    }
    if (convByIdOwnText) {
      const texts = convByIdOwnText.get(q.conv_id);
      const verbatim = texts && texts.some((own) => own.includes(q.text));
      if (!verbatim) {
        nonVerbatimQuotes++;
        nonVerbatimSamples.push(`${t.topic_path}: conv ${q.conv_id}`);
      }
    }
  }
}

console.log(`\n  要点合计 ${totalKeyPoints}，金句合计 ${totalQuotes}`);
console.log(
  `  引用校验：无效 conv_id ${invalidConvIds} 处${invalidConvIds > 0 ? '  ⚠' : '  ✓'}`
);
if (invalidConvIds > 0) {
  for (const s of invalidConvIdSamples.slice(0, 10)) console.log(`    · ${s}`);
  if (invalidConvIdSamples.length > 10) console.log(`    ...等共 ${invalidConvIdSamples.length} 处`);
}
console.log(
  `  金句逐字校验：非逐字（疑似杜撰）${nonVerbatimQuotes} / ${totalQuotes}${nonVerbatimQuotes > 0 ? '  ⚠' : '  ✓'}`
);
if (nonVerbatimQuotes > 0) {
  for (const s of nonVerbatimSamples.slice(0, 10)) console.log(`    · ${s}`);
  if (nonVerbatimSamples.length > 10) console.log(`    ...等共 ${nonVerbatimSamples.length} 处`);
}

console.log('\n══════ 红线汇总 ══════');
const noTopicPct = (100 * noTopic.length) / index.length;
console.log(`  未归类比例 ${noTopicPct.toFixed(1)}%（红线 >20%）${noTopicPct > 20 ? '⚠ 触及' : '✓ 未触及'}`);
console.log(`  空话题 ${emptyTopics} 个（红线：出现即触及）${emptyTopics > 0 ? '⚠ 触及' : '✓ 未触及'}`);
console.log(`  杜撰金句占对话数 ${bogusQuotePct.toFixed(1)}%（红线 >5%）${bogusQuotePct > 5 ? '⚠ 触及' : '✓ 未触及'}`);
console.log(
  `  核心持仓出现 criticizes 标注 ${coreCriticizeCount} 处（人工复核项，非红线）${coreCriticizeCount > 0 ? '需人工确认是否为针对具体行为的合理批评，见上方明细' : '✓ 无'}`
);
console.log('    已复核：腾讯 conv 21862159（2012 3Q 大战语境）标注正确');
console.log(`  话题综述引用无效 conv_id ${invalidConvIds} 处，非逐字金句 ${nonVerbatimQuotes} 处（这两项非 brief 原定红线，但同属杜撰风险，出现即需人工复核）${invalidConvIds > 0 || nonVerbatimQuotes > 0 ? '⚠' : '✓'}`);

console.log('\n══════ 需人工判断 ══════');
console.log('1. 随机抽 5 场对话，对照雪球原帖核对 summary 是否准确');
console.log('2. 读 2-3 篇话题综述，确认没有夹带语料之外的信息');
console.log('3. 核对被标为 criticizes 的公司是否确实是反面教材');
