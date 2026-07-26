const cache = new Map();

async function getJSON(path) {
  if (!cache.has(path)) {
    const p = fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        cache.delete(path);
        throw err;
      });
    cache.set(path, p);
  }
  return cache.get(path);
}

export const getIndex = () => getJSON('data/index.json');
export const getYear = (year) => getJSON(`data/convs/${year}.json`);
export const getTopic = (slug) => getJSON(`data/topics/${encodeURIComponent(slug)}.json`);
export const getCompanies = () => getJSON('data/companies.json');
export const getInstruments = () => getJSON('data/instruments.json');
export const getOverview = () => getJSON('data/overview.json');

export const topicSlug = (path) => path.replaceAll('/', '-');

// 对话正文按 index 条目 date 的年份归片（跨年对话只在首年分片）。
export async function getConv(id) {
  const index = await getIndex();
  const entry = index.find((e) => e.id === id);
  if (!entry) return null;
  const convs = await getYear(entry.date.slice(0, 4));
  return convs.find((c) => c.id === id) ?? null;
}

export function _resetCache() {
  cache.clear();
}
