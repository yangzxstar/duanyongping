import { parseRoute } from './router.js';
import { renderTimeline } from './views/timeline.js';
import { renderConv } from './views/conv.js';
import { renderTopics, renderTopic } from './views/topics.js';
import { renderCompanies, renderCompany } from './views/companies.js';
import { renderOverview } from './views/overview.js';
import { renderSearch, initSearchBox } from './views/searchview.js';
import { esc } from './render.js';

const routes = {
  timeline: renderTimeline,
  conv: renderConv,
  topics: renderTopics,
  topic: renderTopic,
  companies: renderCompanies,
  company: renderCompany,
  overview: renderOverview,
  search: renderSearch,
};

const main = document.getElementById('main');

async function route() {
  const { view, param } = parseRoute(location.hash);
  const handler = routes[view] ?? routes.timeline;
  main.innerHTML = '<p class="hint">加载中…</p>';
  try {
    await handler(main, param);
  } catch (err) {
    main.innerHTML = `<p class="hint">加载失败：${esc(err?.message ?? String(err))}</p>`;
  }
  // 详情类视图归到所属导航项，保持"我在哪"的定向。
  const NAV_OF = {
    timeline: '#/', conv: '#/', search: '#/',
    topics: '#/topics', topic: '#/topics',
    companies: '#/companies', company: '#/companies',
    overview: '#/overview',
  };
  const active = NAV_OF[view] ?? '#/';
  for (const a of document.querySelectorAll('header nav a')) {
    a.classList.toggle('active', a.getAttribute('href') === active);
  }
}

window.addEventListener('hashchange', route);
route();
initSearchBox(document.getElementById('searchbox'));

// 手机上顶栏占了太多可视空间：下滑阅读时隐藏，上滑或回到顶部即恢复。
const header = document.querySelector('header');
const narrow = window.matchMedia('(max-width: 640px)');
let lastY = window.scrollY;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (narrow.matches && y > lastY && y > header.offsetHeight) {
    header.classList.add('hide');
  } else if (y < lastY || y <= 0) {
    header.classList.remove('hide');
  }
  lastY = y;
}, { passive: true });
window.addEventListener('hashchange', () => header.classList.remove('hide'));
