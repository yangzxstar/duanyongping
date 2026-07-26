const PARAM_VIEWS = new Set(['conv', 'topic', 'company', 'search']);
const PLAIN_VIEWS = new Set(['topics', 'companies', 'overview']);

export function parseRoute(hash) {
  const h = String(hash ?? '').replace(/^#\/?/, '');
  if (!h) return { view: 'timeline', param: null };
  const [head, ...rest] = h.split('/');
  if (PLAIN_VIEWS.has(head)) return { view: head, param: null };
  if (PARAM_VIEWS.has(head) && rest.length) {
    return { view: head, param: decodeURIComponent(rest.join('/')) };
  }
  return { view: 'timeline', param: null };
}

export function routeTo(view, param) {
  if (view === 'timeline') return '#/';
  return param != null ? `#/${view}/${encodeURIComponent(param)}` : `#/${view}`;
}
