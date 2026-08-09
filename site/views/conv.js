import { getConv, getIndex } from '../data.js';
import { convCard } from '../render.js';

export async function renderConv(main, id) {
  const conv = await getConv(id);
  if (!conv) {
    main.innerHTML = '<p class="hint">未找到这场对话。</p>';
    return;
  }
  const index = await getIndex();
  const entry = index.find((e) => e.id === id);
  main.innerHTML = `<button class="back" id="back">← 返回</button>` + convCard(entry, conv, { collapse: false, link: false, allChips: true });
  // 深链直达时没有站内历史，back() 会退出本站，退回时间线兜底。
  main.querySelector('#back').onclick = () => {
    if (history.length > 1) history.back();
    else location.hash = '#/';
  };
}
