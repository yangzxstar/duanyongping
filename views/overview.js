import { getOverview, topicSlug } from '../data.js';
import { mdLiteCite, esc } from '../render.js';

export async function renderOverview(main) {
  const ov = await getOverview();
  main.innerHTML = `<h2>${esc(ov.title)}</h2>
<p class="ai-note">总纲由 AI 通读全部话题综述后生成，仅作导读；观点以各话题页链接的雪球原文为准。</p>
<div class="pillars">${ov.pillars
    .map(
      (p) => `<div class="pillar"><h3>${esc(p.name)}</h3><p>${esc(p.gist)}</p><div class="chips">${p.topic_paths
        .map((t) => `<a class="chip" href="#/topic/${encodeURIComponent(topicSlug(t))}">${esc(t)}</a>`)
        .join('')}</div></div>`,
    )
    .join('')}</div>
<div class="essay">${mdLiteCite(ov.essay)}</div>`;
}
