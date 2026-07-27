import { getOverview, topicSlug } from '../data.js';
import { mdLite, esc } from '../render.js';

export async function renderOverview(main) {
  const ov = await getOverview();
  main.innerHTML = `<h2>${esc(ov.title)}</h2>
<div class="pillars">${ov.pillars
    .map(
      (p) => `<div class="pillar"><h3>${esc(p.name)}</h3><p>${esc(p.gist)}</p><div class="chips">${p.topic_paths
        .map((t) => `<a class="chip" href="#/topic/${encodeURIComponent(topicSlug(t))}">${esc(t)}</a>`)
        .join('')}</div></div>`,
    )
    .join('')}</div>
<div class="essay">${mdLite(ov.essay)}</div>`;
}
