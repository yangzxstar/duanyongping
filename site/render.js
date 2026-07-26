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

export const topicChips = (topics) =>
  (topics ?? []).map((t) => `<a class="chip" href="#/topic/${encodeURIComponent(t.replaceAll('/', '-'))}">${esc(t)}</a>`).join('');

export const companyChips = (names) =>
  (names ?? []).map((n) => `<a class="chip chip-co" href="#/company/${encodeURIComponent(n)}">${esc(n)}</a>`).join('');

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
    html += `<details class="fold"><summary>展开全部 ${items.length} 条</summary>${items.slice(cut).map(renderMsg).join('')}</details>`;
  }
  return html;
}

export function convCard(entry, conv, { collapse = true, link = true } = {}) {
  const url = conv?.posts?.[0]?.url ?? '';
  const summary = esc(entry.summary || '（无摘要）');
  const title = link ? `<a href="#/conv/${encodeURIComponent(entry.id)}">${summary}</a>` : summary;
  return `<article class="card" data-id="${esc(entry.id)}">
  <div class="meta">
    <span class="date">${esc(entry.date)}</span>
    ${entry.kind === 'original' ? '<span class="tag">原创</span>' : ''}
    ${entry.featured ? '<span class="tag star">精华</span>' : ''}
    <span class="likes">赞 ${entry.like ?? 0}</span>
    ${url ? `<a class="src" href="${esc(url)}" target="_blank" rel="noopener">雪球原帖 ↗</a>` : ''}
  </div>
  <h3 class="summary">${title}</h3>
  ${conv ? `<div class="dialogue">${dialogueHTML(conv, { collapse })}</div>` : ''}
  <div class="chips">${topicChips(entry.topics)}${companyChips(entry.companies)}</div>
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
