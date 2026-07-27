import { parseRoute } from './router.js';
import { renderTimeline } from './views/timeline.js';
import { renderConv } from './views/conv.js';
import { renderTopics, renderTopic } from './views/topics.js';
import { renderCompanies, renderCompany } from './views/companies.js';

const routes = {
  timeline: renderTimeline,
  conv: renderConv,
  topics: renderTopics,
  topic: renderTopic,
  companies: renderCompanies,
  company: renderCompany,
};

const main = document.getElementById('main');

async function route() {
  const { view, param } = parseRoute(location.hash);
  const handler = routes[view] ?? routes.timeline;
  main.innerHTML = '<p class="hint">加载中…</p>';
  try {
    await handler(main, param);
  } catch (err) {
    main.innerHTML = `<p class="hint">加载失败：${err?.message ?? err}</p>`;
  }
  const active = view === 'timeline' ? '#/' : `#/${view}`;
  for (const a of document.querySelectorAll('header nav a')) {
    a.classList.toggle('active', a.getAttribute('href') === active);
  }
}

window.addEventListener('hashchange', route);
route();
