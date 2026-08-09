import { getIndex, getYear } from '../data.js';
import { convCard, withGapMarker, GAP_NOTE, esc } from '../render.js';

const CHUNK = 50;
const GAP_YEARS = new Set(['2013', '2014', '2015', '2016', '2017']);
const state = { year: '', topic: '', company: '', featuredOnly: true, shown: 0 };
let gen = 0;

// 筛选状态进 URL（#/?year=…&topic=…&company=…&all=1），可深链分享、刷新不丢。
// replaceState 不触发 hashchange，改筛选不会引起整页重渲染。
function readStateFromHash() {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
  return {
    year: p.get('year') ?? '',
    topic: p.get('topic') ?? '',
    company: p.get('company') ?? '',
    featuredOnly: p.get('all') !== '1',
    shown: 0,
  };
}

function writeStateToHash() {
  const p = new URLSearchParams();
  if (state.year) p.set('year', state.year);
  if (state.topic) p.set('topic', state.topic);
  if (state.company) p.set('company', state.company);
  if (!state.featuredOnly) p.set('all', '1');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `#/?${qs}` : '#/');
}

export async function renderTimeline(main) {
  Object.assign(state, readStateFromHash());
  gen += 1;
  const index = await getIndex();

  const yearCounts = new Map();
  for (const e of index) {
    const y = e.date.slice(0, 4);
    yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
  }
  const years = [...yearCounts.keys()].sort().reverse();
  const topics = [...new Set(index.flatMap((e) => e.topics))].sort();
  const compCount = new Map();
  for (const n of index.flatMap((e) => e.companies)) compCount.set(n, (compCount.get(n) ?? 0) + 1);
  const companies = [...compCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n]) => n);
  // 深链里的公司可能不在前 40，补进选项以免选中态丢失。
  if (state.company && !companies.includes(state.company)) companies.push(state.company);

  main.innerHTML = `
<div class="filters">
  <select id="f-year" aria-label="按年份筛选"><option value="">全部年份</option>${years
    .map((y) => `<option value="${y}">${y}（${yearCounts.get(y)} 场${GAP_YEARS.has(y) ? '，空窗年' : ''}）</option>`)
    .join('')}</select>
  <select id="f-topic" aria-label="按话题筛选"><option value="">全部话题</option>${topics.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
  <select id="f-company" aria-label="按公司筛选"><option value="">全部公司</option>${companies.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
  <label class="toggle"><input type="checkbox" id="f-featured" checked> 只看精华</label>
</div>
<div id="cards"></div>
<button id="more" class="more">加载更多</button>`;

  main.querySelector('#f-year').value = state.year;
  main.querySelector('#f-topic').value = state.topic;
  main.querySelector('#f-company').value = state.company;
  main.querySelector('#f-featured').checked = state.featuredOnly;

  const cards = main.querySelector('#cards');
  const more = main.querySelector('#more');

  function filteredList() {
    return withGapMarker(
      index.filter(
        (e) =>
          (!state.featuredOnly || e.featured) &&
          (!state.year || e.date.startsWith(state.year)) &&
          (!state.topic || e.topics.includes(state.topic)) &&
          (!state.company || e.companies.includes(state.company)),
      ),
    );
  }

  async function renderMore() {
    const myGen = gen;
    const list = filteredList();
    const slice = list.slice(state.shown, state.shown + CHUNK);
    const yearsNeeded = [...new Set(slice.filter((x) => !x.gap).map((e) => e.date.slice(0, 4)))];
    const shards = await Promise.all(yearsNeeded.map((y) => getYear(y)));
    if (myGen !== gen) return;
    const byId = new Map(shards.flat().map((c) => [c.id, c]));
    cards.insertAdjacentHTML(
      'beforeend',
      slice.map((x) => (x.gap ? `<div class="gap">${GAP_NOTE}</div>` : convCard(x, byId.get(x.id)))).join(''),
    );
    state.shown += slice.length;
    more.style.display = state.shown >= list.length ? 'none' : '';
  }

  async function applyFilters() {
    gen += 1;
    state.shown = 0;
    writeStateToHash();
    cards.innerHTML = '';
    await renderMore();
  }

  main.querySelector('#f-year').onchange = (ev) => { state.year = ev.target.value; applyFilters(); };
  main.querySelector('#f-topic').onchange = (ev) => { state.topic = ev.target.value; applyFilters(); };
  main.querySelector('#f-company').onchange = (ev) => { state.company = ev.target.value; applyFilters(); };
  main.querySelector('#f-featured').onchange = (ev) => { state.featuredOnly = ev.target.checked; applyFilters(); };
  more.onclick = async () => {
    more.disabled = true;
    try {
      await renderMore();
    } finally {
      more.disabled = false;
    }
  };

  await renderMore();
}
