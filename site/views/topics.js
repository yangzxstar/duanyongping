import { getIndex, getTopic, topicSlug } from '../data.js';
import { mdLiteCite, esc } from '../render.js';
import { mountCardList } from './list.js';

export async function renderTopics(main) {
  const index = await getIndex();
  const counts = new Map();
  for (const e of index) for (const t of e.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tops = [...counts.keys()].filter((t) => !t.includes('/')).sort((a, b) => counts.get(b) - counts.get(a));
  main.innerHTML =
    `<h2>话题</h2><div class="topic-tree">` +
    tops
      .map((top) => {
        const subs = [...counts.keys()].filter((t) => t.startsWith(top + '/')).sort((a, b) => counts.get(b) - counts.get(a));
        return `<section class="topic-node">
  <a class="topic-top" href="#/topic/${encodeURIComponent(topicSlug(top))}">${esc(top)} <span class="n">${counts.get(top)} 场</span></a>
  <div>${subs
    .map((s) => `<a class="topic-sub" href="#/topic/${encodeURIComponent(topicSlug(s))}">${esc(s.split('/')[1])} <span class="n">${counts.get(s)}</span></a>`)
    .join('')}</div>
</section>`;
      })
      .join('') +
    `</div>`;
}

export async function renderTopic(main, slug) {
  const [t, index] = await Promise.all([getTopic(slug), getIndex()]);
  const byId = new Map(index.map((e) => [e.id, e]));
  const entries = t.conv_ids.map((id) => byId.get(id)).filter(Boolean);
  main.innerHTML = `
<h2>${esc(t.topic_path)} <span class="n">${t.conv_count} 场对话</span></h2>
<nav class="secnav">
  <button data-sec="sec-quotes">金句</button>
  <button data-sec="sec-essay">AI 综述</button>
  <button data-sec="sec-points">要点</button>
  <button data-sec="sec-convs">全部对话</button>
</nav>
<section id="sec-quotes">
<h3>金句 <span class="n">逐字摘自原文</span></h3>
${t.best_quotes
    .map((q) => `<blockquote>「${esc(q.text)}」<footer><a href="#/conv/${encodeURIComponent(q.conv_id)}">${esc(q.date)} · 原对话</a></footer></blockquote>`)
    .join('')}
</section>
<section id="sec-essay">
<h3>AI 综述</h3>
<p class="ai-note">以下综述与要点由 AI 基于本话题 ${t.conv_count} 场对话生成，仅作导读，内容以引注链接的原文为准。</p>
<div class="essay">${mdLiteCite(t.essay)}</div>
</section>
<section id="sec-points">
<h3>关键要点</h3>
<ul class="points">${t.key_points
    .map((p) => `<li>${esc(p.point)}<span class="refs">${p.conv_ids
      .map((id, i) => `<a class="ref" href="#/conv/${encodeURIComponent(id)}" title="查看原对话">${i + 1}</a>`)
      .join('')}</span></li>`)
    .join('')}</ul>
</section>
<section id="sec-convs">
<h3>全部对话 <span class="n">${entries.length} 场</span></h3>
<div class="list" id="conv-list"></div>
</section>`;
  for (const b of main.querySelectorAll('.secnav button')) {
    b.onclick = () => document.getElementById(b.dataset.sec)?.scrollIntoView({ behavior: 'smooth' });
  }
  await mountCardList(main.querySelector('#conv-list'), entries);
}
