import { getCompanies, getInstruments, getIndex } from '../data.js';
import { esc } from '../render.js';
import { mountCardList } from './list.js';

const STANCES = [
  ['holds', '持有 / 看好'],
  ['admires', '欣赏'],
  ['criticizes', '批评 / 反面教材'],
  ['neutral', '中性提及'],
  ['unknown', '立场不明'],
];
const total = (c) => STANCES.reduce((n, [k]) => n + c[k].length, 0);

function listSection(items, title, sub) {
  const rows = [...items]
    .sort((a, b) => total(b) - total(a))
    .map(
      (c) =>
        `<a class="co-row" href="#/company/${encodeURIComponent(c.name)}"><span class="co-name">${esc(c.name)}</span><span class="co-counts">${
          STANCES.filter(([k]) => c[k].length).map(([k, label]) => `${label} ${c[k].length}`).join(' · ') || '—'
        }</span></a>`,
    )
    .join('');
  return `<section><h2>${esc(title)}</h2>${sub ? `<p class="hint">${esc(sub)}</p>` : ''}<div class="co-list">${rows}</div></section>`;
}

export async function renderCompanies(main) {
  const [companiesObj, instrumentsObj] = await Promise.all([getCompanies(), getInstruments()]);
  const companies = Object.values(companiesObj);
  const instruments = Object.values(instrumentsObj);
  main.innerHTML =
    listSection(companies, `公司（${companies.length}）`) +
    listSection(instruments, `指数 / ETF（${instruments.length}）`, '指数和 ETF 不是公司，单独归档；其中不少是他批评杠杆工具时的反面教材。');
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
    sections
      .map((s) => `<section><h3>${s.label}（${s.entries.length}）</h3><div class="list" id="list-${s.key}"></div></section>`)
      .join('');
  await Promise.all(sections.map((s) => mountCardList(main.querySelector(`#list-${s.key}`), s.entries)));
}
