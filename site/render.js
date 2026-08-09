export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 综述 essay 只用到两种标记：\n 分段 与 **粗体**。先转义再替换，防注入。
export function mdLite(text) {
  return String(text ?? '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`)
    .join('');
}

// mdLite + 引注：把综述里成串的（conv_id、conv_id…）替换成可点击的上标序号，
// 数字噪音换成导航价值。括号内混有其他文字时不动（避免误伤正常括注）。
export function mdLiteCite(text) {
  let n = 0;
  return mdLite(text).replace(/（([0-9solo\-、，\s]+)）/g, (m, inner) => {
    const ids = inner.match(/(?:solo-)?\d{6,}/g);
    if (!ids) return m;
    if (inner.replace(/(?:solo-)?\d{6,}/g, '').replace(/[、，\s]/g, '')) return m;
    return `<sup class="cites">${ids
      .map((id) => `<a href="#/conv/${encodeURIComponent(id)}" title="查看原对话 ${esc(id)}">${++n}</a>`)
      .join('')}</sup>`;
  });
}

export const topicChips = (topics) =>
  (topics ?? []).map((t) => `<a class="chip" href="#/topic/${encodeURIComponent(t.replaceAll('/', '-'))}">${esc(t)}</a>`).join('');

export const companyChips = (names) =>
  (names ?? []).map((n) => `<a class="chip chip-co" href="#/company/${encodeURIComponent(n)}">${esc(n)}</a>`).join('');

// 列表卡片里 chips 限量，余量折叠成 +n；详情页传 allChips 显示全部。
function chipsHTML(entry, allChips) {
  const topics = entry.topics ?? [];
  const companies = entry.companies ?? [];
  if (allChips) return topicChips(topics) + companyChips(companies);
  const tCut = topics.slice(0, 3);
  const cCut = companies.slice(0, 2);
  const hidden = topics.length - tCut.length + (companies.length - cCut.length);
  return topicChips(tCut) + companyChips(cCut) + (hidden > 0 ? `<span class="chip more-chip">+${hidden}</span>` : '');
}

export function dialogueItems(conv) {
  const items = [];
  if (conv.root?.text_plain) {
    items.push({ speaker: conv.root.user, text: conv.root.text_plain, isDao: false, isRoot: true });
  }
  for (const p of conv.posts ?? []) {
    const chain = p.chain?.length ? p.chain : p.own_text ? [{ speaker: '段永平', text: p.own_text }] : [];
    for (const m of chain) {
      items.push({ speaker: m.speaker, text: m.text, isDao: m.speaker === '段永平', url: p.url });
    }
  }
  return items;
}

const renderMsg = (m) =>
  `<div class="msg${m.isDao ? ' dao' : ''}${m.isRoot ? ' root' : ''}"><span class="speaker">${esc(m.speaker)}</span><span class="text">${esc(m.text)}</span></div>`;

export function dialogueHTML(conv, { collapse = true } = {}) {
  const items = dialogueItems(conv);
  const cut = collapse && items.length > 5 ? 5 : items.length;
  let html = items.slice(0, cut).map(renderMsg).join('');
  if (cut < items.length) {
    // 默认展开（open），免去逐条点击；summary 留作"收起"开关，长帖可自行折起。
    html += `<details class="fold" open><summary><span class="when-closed">展开全部 ${items.length} 条</span><span class="when-open">收起</span></summary>${items.slice(cut).map(renderMsg).join('')}</details>`;
  }
  return html;
}

// 原文优先：有 conv 时对话正文置顶，AI 摘要降为底部小字导读行；
// 只有拿不到正文时才退回摘要当标题。
export function convCard(entry, conv, { collapse = true, link = true, allChips = false } = {}) {
  const url = conv?.posts?.[0]?.url ?? '';
  const summary = esc(entry.summary || '');
  const detailHref = `#/conv/${encodeURIComponent(entry.id)}`;
  const meta = `<div class="meta">
    <span class="date">${esc(entry.date)}</span>
    ${entry.kind === 'original' ? '<span class="tag">原创</span>' : ''}
    ${entry.featured ? '<span class="tag star">精华</span>' : ''}
    <span class="likes">赞 ${esc(String(entry.like ?? 0))}</span>
    ${url ? `<a class="src" href="${esc(url)}" target="_blank" rel="noopener">雪球原帖 ↗</a>` : ''}
  </div>`;
  const chips = `<div class="chips">${chipsHTML(entry, allChips)}</div>`;
  if (conv) {
    const summaryLine = summary
      ? link
        ? `<p class="summary dim"><a href="${detailHref}"><span class="ai-tag">AI 摘要</span>${summary}</a></p>`
        : `<p class="summary dim"><span class="ai-tag">AI 摘要</span>${summary}</p>`
      : '';
    return `<article class="card" data-id="${esc(entry.id)}">
  ${meta}
  <div class="dialogue lead">${dialogueHTML(conv, { collapse })}</div>
  ${summaryLine}
  ${chips}
</article>`;
  }
  const title = link ? `<a href="${detailHref}">${summary || '（无摘要）'}</a>` : summary || '（无摘要）';
  return `<article class="card" data-id="${esc(entry.id)}">
  ${meta}
  <h3 class="summary">${title}</h3>
  ${chips}
</article>`;
}

export const GAP_NOTE = '2013–2017 近乎空白：五年间雪球上仅 4 条发言，原因未知（停更、平台清理或换号皆有可能）。';

// entries 须为日期倒序；在最后一条 ≥2018 与第一条 <2018 之间插一次 {gap:true}。
export function withGapMarker(entries) {
  const out = [];
  let seenModern = false;
  let marked = false;
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4));
    if (y >= 2018) seenModern = true;
    if (!marked && seenModern && y < 2018) {
      out.push({ gap: true });
      marked = true;
    }
    out.push(e);
  }
  return out;
}
