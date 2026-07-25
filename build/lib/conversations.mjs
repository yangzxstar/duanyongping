export function convKey(record) {
  const root = Number(record.thread_root_id);
  return root > 0 ? String(root) : `solo-${record.id}`;
}

export function toConversations(records) {
  const groups = new Map();
  for (const r of records) {
    const k = convKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const out = [];
  for (const [id, raw] of groups) {
    const posts = [...raw].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const isThread = !id.startsWith('solo-');

    // root 取本场任意一条带 conversation.root 的发言（同一场的 root 相同）
    const root = posts.find((p) => p.conversation && p.conversation.root)?.conversation.root ?? null;

    // 标的按 symbol 去重合并
    const stockMap = new Map();
    for (const p of posts) for (const s of p.stocks) stockMap.set(s.symbol, s);

    const sum = (f) => posts.reduce((n, p) => n + f(p), 0);

    out.push({
      id,
      kind: isThread ? 'thread' : 'original',
      root: isThread ? root : null,
      posts,
      first_at: posts[0].created_at,
      last_at: posts[posts.length - 1].created_at,
      years: [...new Set(posts.map((p) => p.year))].sort((a, b) => a - b),
      reply_count: posts.length,
      own_chars: sum((p) => p.own_text.length),
      stocks: [...stockMap.values()],
      stats: {
        like: sum((p) => p.stats.like),
        reply: sum((p) => p.stats.reply),
        retweet: sum((p) => p.stats.retweet),
        fav: sum((p) => p.stats.fav),
      },
    });
  }

  return out.sort((a, b) => b.first_at.localeCompare(a.first_at));
}
