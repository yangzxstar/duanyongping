import { COMPANY_KEYWORDS, matchesKeyword, isInstrument } from './taxonomy.mjs';
import { CLEAN_STANCES } from './validate.mjs';

// 精华 = AI 认为有实质内容，且满足任一结构信号。
// 单靠赞数会漏掉冷门但有料的长文；单靠 AI 会放进太多短应答。
export function isFeatured(conv, enrichment, likeThreshold) {
  if (!enrichment || !enrichment.substantive) return false;
  return (
    conv.kind === 'original' ||
    conv.own_chars > 500 ||
    conv.reply_count >= 5 ||
    conv.stats.like >= likeThreshold
  );
}

export function buildIndexEntry(conv, enrichment, likeThreshold) {
  const e = enrichment || { topics: [], companies: [], summary: '', substantive: false };
  return {
    id: conv.id,
    date: conv.first_at.slice(0, 10),
    kind: conv.kind,
    summary: e.summary || '',
    topics: (e.topics || []).map((t) => t.path),
    companies: (e.companies || []).map((c) => c.name),
    reply_count: conv.reply_count,
    own_chars: conv.own_chars,
    like: conv.stats.like,
    featured: isFeatured(conv, enrichment, likeThreshold),
  };
}

// 年份分片只保留渲染需要的字段。原始记录带 text_html，
// 全量带上会让分片从 8.7MB 涨到 26MB。
export function buildYearShards(convs, enriched) {
  const byYear = new Map();
  for (const c of convs) {
    const year = Number(c.first_at.slice(0, 4));
    if (!byYear.has(year)) byYear.set(year, []);
    const e = enriched[c.id];
    byYear.get(year).push({
      id: c.id,
      kind: c.kind,
      first_at: c.first_at,
      last_at: c.last_at,
      root: c.root,
      summary: e?.summary || '',
      topics: (e?.topics || []).map((t) => t.path),
      companies: e?.companies || [],
      quotes: e?.quotes || [],
      stats: c.stats,
      posts: c.posts.map((p) => ({
        id: p.id,
        created_at: p.created_at,
        own_text: p.own_text,
        chain: p.conversation.chain,
        url: p.url,
        stats: p.stats,
      })),
    });
  }
  for (const [, list] of byYear) list.sort((a, b) => b.first_at.localeCompare(a.first_at));
  return byYear;
}

export function topicSlug(path) {
  return path.replace(/\//g, '-');
}

// ── 公司维度 ────────────────────────────────────────────────────────────────
// AI 是自由书写公司名的，同一家会写出「茅台 / 贵州茅台」「腾讯 / 腾讯控股」
// 「伯克希尔 / 伯克希尔哈撒韦 / Berkshire」这样的多种形态，直接按字符串建索引
// 会把一家公司拆成好几家。这里把 AI 写的名字往 COMPANY_KEYWORDS 的规范键上收：
// 判据是「名字本身就是规范键」或「名字命中了某个规范键的关键词表」；命中多个
// 规范键时取匹配到的关键词最长的那个（更具体者优先，如「小霸王」比「vivo」长）。
// 没命中任何规范键就原样返回——长尾公司的归一留到阶段 B 再做，此处只保证
// 核心标的不被拆散。
export function canonicalCompanyName(name) {
  if (typeof name !== 'string') return name;
  const trimmed = name.trim();
  if (trimmed.length === 0) return name;
  if (Object.prototype.hasOwnProperty.call(COMPANY_KEYWORDS, trimmed)) return trimmed;

  let best = null;
  let bestLen = 0;
  for (const [canon, keys] of Object.entries(COMPANY_KEYWORDS)) {
    for (const k of keys) {
      if (k.length > bestLen && matchesKeyword(trimmed, k)) {
        best = canon;
        bestLen = k.length;
      }
    }
  }
  return best === null ? trimmed : best;
}

// 赞数分位阈值。空输入返回 0（旧写法 likes[0] 会是 undefined，
// 下游 conv.stats.like >= undefined 恒为 false，静默失效）。
export function likeThreshold(convs, pct = 0.1) {
  if (!Array.isArray(convs) || convs.length === 0) return 0;
  const likes = convs.map((c) => c?.stats?.like ?? 0).sort((a, b) => b - a);
  const idx = Math.floor(likes.length * pct);
  return likes[idx] ?? likes[likes.length - 1];
}

// 公司索引：两路合并 —— AI 标注的 companies + 正文 $名称(代码)$ 解析出的 conv.stocks。
// 规则：
//   1. 两路的名字都先过 canonicalCompanyName；
//   2. 规范化后仅大小写不同的名字（ZARA / Zara）合并到同一条，展示名取先出现的那个
//      ——纯函数没法知道哪种写法更常见，先到先得是确定性最强的选择；
//   3. 同一场对话里同一家公司只进一个桶（AI 的第一个 stance 为准）；
//   4. stocks 带来的标的记 neutral，但若该场 AI 已经给这家公司定过 stance，
//      不覆盖（AI 的判断比"正文提到了这个标签"信息量大）；
//   5. stance 不在 CLEAN_STANCES 里的一律兜到 unknown 桶，不再直接 push 到
//      undefined 上崩溃（enrich-merge 补的默认标注是绕过 validate 构造的，
//      不能假定 stance 一定已经归一化过）；
//   6. 容器用 Object.create(null)，避免出现名为 constructor / __proto__ 的公司时
//      走进原型链上的假分支；
//   7. 指数/ETF 不是公司（用户明确要求）：canonicalCompanyName 之后过
//      isInstrument(canon, symbol)，命中的分流进独立的 instruments 容器，
//      与 companies 同样的 stance 分桶格式，但不混进 companies——内容本身
//      （如批评三倍杠杆 ETF）仍保留，只是不出现在公司维度里。
export function buildCompanyIndex(convs, enriched) {
  const companies = Object.create(null);
  const instruments = Object.create(null);
  const byFoldCompanies = new Map(); // 小写名 → 实际使用的键
  const byFoldInstruments = new Map();

  const bucketIn = (container, byFold, canon) => {
    const fold = canon.toLowerCase();
    let key = byFold.get(fold);
    if (key === undefined) {
      key = canon;
      byFold.set(fold, key);
      const rec = { name: canon };
      for (const s of CLEAN_STANCES) rec[s] = [];
      container[key] = rec;
    }
    return container[key];
  };

  const bucketFor = (rawName, symbol) => {
    const canon = canonicalCompanyName(rawName);
    return isInstrument(canon, symbol)
      ? bucketIn(instruments, byFoldInstruments, canon)
      : bucketIn(companies, byFoldCompanies, canon);
  };

  for (const c of convs) {
    const seen = new Set(); // 本场已定桶的公司/指数（用展示名）
    for (const co of enriched?.[c.id]?.companies || []) {
      if (!co || typeof co.name !== 'string' || co.name.trim().length === 0) continue;
      const rec = bucketFor(co.name, co.symbol);
      if (seen.has(rec.name)) continue;
      seen.add(rec.name);
      const stance = CLEAN_STANCES.includes(co.stance) ? co.stance : 'unknown';
      rec[stance].push(c.id);
    }
    for (const s of c.stocks || []) {
      if (!s || typeof s.name !== 'string' || s.name.trim().length === 0) continue;
      const rec = bucketFor(s.name, s.symbol);
      if (seen.has(rec.name)) continue;
      seen.add(rec.name);
      rec.neutral.push(c.id);
    }
  }

  return { companies, instruments };
}
