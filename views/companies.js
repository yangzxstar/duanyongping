import { getCompanies, getInstruments, getIndex } from '../data.js';
import { esc } from '../render.js';
import { mountCardList } from './list.js';

const STANCES = [
  ['holds', '持有 / 看好', '持有'],
  ['admires', '欣赏', '欣赏'],
  ['criticizes', '批评 / 反面教材', '批评'],
  ['neutral', '中性提及', '中性'],
  ['unknown', '立场不明', '不明'],
];
const total = (c) => STANCES.reduce((n, [k]) => n + c[k].length, 0);

// 对齐的数字列（tabular-nums）竖向可扫描比较；长文本串做不到。
function listSection(items, title, sub) {
  const head =
    `<div class="co-row co-head"><span class="co-name">名称</span>` +
    STANCES.map(([, , short]) => `<span class="co-n">${short}</span>`).join('') +
    `</div>`;
  const rows = [...items]
    .sort((a, b) => total(b) - total(a))
    .map(
      (c) =>
        `<a class="co-row" href="#/company/${encodeURIComponent(c.name)}"><span class="co-name">${esc(c.name)}</span>${STANCES.map(
          ([k]) => `<span class="co-n${c[k].length ? '' : ' zero'}">${c[k].length || '·'}</span>`,
        ).join('')}</a>`,
    )
    .join('');
  return `<section><h2>${esc(title)}</h2>${sub ? `<p class="hint">${esc(sub)}</p>` : ''}<div class="co-list">${head}${rows}</div></section>`;
}

export async function renderCompanies(main) {
  const [companiesObj, instrumentsObj] = await Promise.all([getCompanies(), getInstruments()]);
  const companies = Object.values(companiesObj);
  const instruments = Object.values(instrumentsObj);
  main.innerHTML =
    `<input id="co-filter" type="search" placeholder="筛选名称，如：苹果" aria-label="按名称筛选公司">
<p class="hint">列：持有 / 看好 · 欣赏 · 批评 / 反面教材 · 中性提及 · 立场不明</p>` +
    listSection(companies, `公司（${companies.length}）`) +
    listSection(instruments, `指数 / ETF（${instruments.length}）`, '指数和 ETF 不是公司，单独归档；其中不少是他批评杠杆工具时的反面教材。');
  const rows = [...main.querySelectorAll('a.co-row')];
  main.querySelector('#co-filter').addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    for (const r of rows) {
      r.style.display = !q || r.querySelector('.co-name').textContent.toLowerCase().includes(q) ? '' : 'none';
    }
  });
}

export async function renderCompany(main, name) {
  const [companiesObj, instrumentsObj, index] = await Promise.all([getCompanies(), getInstruments(), getIndex()]);
  const companies = Object.values(companiesObj);
  const instruments = Object.values(instrumentsObj);
  const co = companies.find((c) => c.name === name) ?? instruments.find((c) => c.name === name);
  if (!co) {
    main.innerHTML = '<p class="hint">未找到该公司或指数。</p>';
    return;
  }
  const byId = new Map(index.map((e) => [e.id, e]));
  const sections = STANCES.map(([k, label]) => ({
    key: k,
    label,
    entries: co[k]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date)),
  })).filter((s) => s.entries.length);
  main.innerHTML =
    `<h2>${esc(co.name)}</h2>` +
    (sections.length > 1
      ? `<nav class="secnav">${sections
          .map((s) => `<button data-sec="sec-${s.key}">${s.label}（${s.entries.length}）</button>`)
          .join('')}</nav>`
      : '') +
    sections
      .map((s) => `<section id="sec-${s.key}"><h3>${s.label}（${s.entries.length}）</h3><div class="list" id="list-${s.key}"></div></section>`)
      .join('');
  const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  for (const b of main.querySelectorAll('.secnav button')) {
    b.onclick = () => document.getElementById(b.dataset.sec)?.scrollIntoView({ behavior: smooth });
  }
  await Promise.all(sections.map((s) => mountCardList(main.querySelector(`#list-${s.key}`), s.entries)));
}
