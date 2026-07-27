import { getIndex, getTopic, topicSlug } from '../data.js';
import { mdLite, esc, convCard } from '../render.js';

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
<div class="essay">${mdLite(t.essay)}</div>
<h3>关键要点</h3>
<ul class="points">${t.key_points
    .map((p) => `<li>${esc(p.point)}${p.conv_ids.map((id) => ` <a class="ref" href="#/conv/${encodeURIComponent(id)}">↗</a>`).join('')}</li>`)
    .join('')}</ul>
<h3>金句</h3>
${t.best_quotes
    .map((q) => `<blockquote>「${esc(q.text)}」<footer><a href="#/conv/${encodeURIComponent(q.conv_id)}">${esc(q.date)} · 原对话</a></footer></blockquote>`)
    .join('')}
<h3>全部对话</h3>
<div class="list">${entries.map((e) => convCard(e, null)).join('')}</div>`;
}
