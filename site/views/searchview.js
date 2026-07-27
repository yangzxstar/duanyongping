import { getIndex, getYear } from '../data.js';
import { searchIndex, convMatches } from '../search.js';
import { esc, convCard } from '../render.js';
import { mountCardList } from './list.js';

// 在已渲染的卡片区内把命中词包上 <mark>，走文本节点，不碰属性与标签。
function markMatches(rootEl, q) {
  const needle = q.toLowerCase();
  if (!needle) return;
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.parentElement?.closest('mark') == null) nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    const t = node.textContent;
    if (!t.toLowerCase().includes(needle)) continue;
    const frag = document.createDocumentFragment();
    let rest = t;
    let i;
    while ((i = rest.toLowerCase().indexOf(needle)) >= 0) {
      frag.append(rest.slice(0, i));
      const mark = document.createElement('mark');
      mark.textContent = rest.slice(i, i + q.length);
      frag.append(mark);
      rest = rest.slice(i + q.length);
    }
    frag.append(rest);
    node.replaceWith(frag);
  }
}

export function initSearchBox(el) {
  el.innerHTML = `<input id="q" type="search" placeholder="搜摘要 / 话题 / 公司…"><div id="q-drop" class="drop" hidden></div>`;
  const input = el.querySelector('#q');
  const drop = el.querySelector('#q-drop');

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) {
      drop.hidden = true;
      return;
    }
    const hits = searchIndex(await getIndex(), q).slice(0, 10);
    drop.innerHTML =
      hits.map((e) => `<a href="#/conv/${encodeURIComponent(e.id)}">${esc(e.date)} · ${esc(e.summary)}</a>`).join('') +
      `<a class="fulltext" href="#/search/${encodeURIComponent(q)}">全文搜索「${esc(q)}」→</a>`;
    drop.hidden = false;
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && input.value.trim()) {
      drop.hidden = true;
      location.hash = `#/search/${encodeURIComponent(input.value.trim())}`;
    }
  });
  document.addEventListener('click', (ev) => {
    if (!el.contains(ev.target)) drop.hidden = true;
  });
  window.addEventListener('hashchange', () => {
    drop.hidden = true;
  });
}

export async function renderSearch(main, q) {
  const index = await getIndex();
  const idxHits = searchIndex(index, q);
  main.innerHTML = `<h2>搜索「${esc(q)}」</h2>
<h3>索引内命中（摘要 / 话题 / 公司）：${idxHits.length} 条</h3>
<div class="list" id="idx-hits"></div>
<h3>全文搜索</h3>
<p class="hint">逐年加载全部对话正文（约 11MB）后在原文内匹配。</p>
<button id="ft-go" class="more">开始全文搜索</button>
<div id="ft-progress" class="hint"></div>
<div id="ft-results" class="list"></div>`;

  await mountCardList(main.querySelector('#idx-hits'), idxHits, {
    onChunk: (cards) => markMatches(cards, q),
  });

  main.querySelector('#ft-go').onclick = async (ev) => {
    ev.target.disabled = true;
    const years = [...new Set(index.map((e) => e.date.slice(0, 4)))].sort().reverse();
    const byId = new Map(index.map((e) => [e.id, e]));
    const progress = main.querySelector('#ft-progress');
    const results = main.querySelector('#ft-results');
    results.innerHTML = '';
    progress.textContent = '';
    let found = 0;
    try {
      for (let i = 0; i < years.length; i++) {
        progress.textContent = `加载 ${years[i]}…（${i + 1}/${years.length}，已命中 ${found} 条）`;
        const convs = await getYear(years[i]);
        const hits = convs.filter((c) => convMatches(c, q));
        found += hits.length;
        const batch = document.createElement('div');
        batch.innerHTML = hits
          .map((c) => {
            const entry = byId.get(c.id) ?? {
              id: c.id,
              date: (c.first_at ?? '').slice(0, 10),
              kind: c.kind,
              summary: c.summary ?? '',
              topics: c.topics ?? [],
              companies: [],
              like: c.stats?.like ?? 0,
            };
            return convCard(entry, c);
          })
          .join('');
        markMatches(batch, q);
        results.append(...batch.children);
      }
      progress.textContent = `完成：全文命中 ${found} 条。`;
    } catch (err) {
      progress.textContent = '全文搜索失败：' + (err?.message ?? err) + '（可重试）';
      ev.target.disabled = false;
    }
  };
}
