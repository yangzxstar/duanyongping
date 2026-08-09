import { getYear } from '../data.js';
import { convCard } from '../render.js';

const CHUNK = 50;

// 通用的分页卡片列表：按 50 条一页懒加载年份分片，卡片以对话原文为主体。
// opts.onChunk(cardsEl) 在每一块插入后调用（搜索页用来做命中词高亮）。
export function mountCardList(el, entries, opts = {}) {
  const chunk = opts.chunk ?? CHUNK;
  let shown = 0;
  el.innerHTML = '<div class="cards"></div><button class="more">加载更多</button>';
  const cards = el.querySelector('.cards');
  const more = el.querySelector('.more');

  // 自动加载可能在上一块渲染中途触发；串行排队，避免并发重复消费同一段 slice。
  let queue = Promise.resolve();
  function renderMore() {
    const run = queue.then(renderChunk);
    queue = run.catch(() => {});
    return run;
  }

  async function renderChunk() {
    const slice = entries.slice(shown, shown + chunk);
    const years = [...new Set(slice.map((e) => e.date.slice(0, 4)))];
    // 单个分片加载失败只影响该年的正文展示（退回摘要卡），不整页报错。
    const shards = await Promise.all(years.map((y) => getYear(y).catch(() => [])));
    if (!el.isConnected) return;
    const byId = new Map(shards.flat().map((c) => [c.id, c]));
    cards.insertAdjacentHTML('beforeend', slice.map((e) => convCard(e, byId.get(e.id))).join(''));
    shown += slice.length;
    more.style.display = shown >= entries.length ? 'none' : '';
    opts.onChunk?.(cards);
  }

  more.onclick = async () => {
    more.disabled = true;
    try {
      await renderMore();
    } finally {
      more.disabled = false;
      io.unobserve(more);
      io.observe(more);
    }
  };
  // 滚近底部自动加载，按钮保留作降级入口。
  const io = new IntersectionObserver(
    (es) => {
      if (es.some((e) => e.isIntersecting) && !more.disabled && more.style.display !== 'none') more.click();
    },
    { rootMargin: '600px' },
  );
  io.observe(more);

  return renderMore();
}
