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
