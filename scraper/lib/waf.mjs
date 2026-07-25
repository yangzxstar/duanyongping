import { warmUp } from './browser.mjs';

export function classifyResponse(rawText) {
  if (typeof rawText !== 'string' || rawText.length === 0) {
    return { kind: 'invalid', message: '空响应' };
  }
  if (rawText.includes('renderData') || rawText.includes('aliyun_waf')) {
    return { kind: 'waf', message: 'WAF 挑战页' };
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return { kind: 'invalid', message: rawText.slice(0, 120) };
  }
  if (Array.isArray(data.statuses)) return { kind: 'json', data };
  const desc = data.error_description || '';
  if (desc.includes('请登录')) return { kind: 'login', message: desc };
  if (desc) return { kind: 'invalid', message: desc };
  return { kind: 'json', data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(page, path, { maxRetries = 4 } = {}) {
  let lastMessage = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const raw = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { headers: { Accept: 'application/json' }, credentials: 'include' });
        return await r.text();
      } catch (e) {
        return 'FETCH_ERROR ' + e.message;
      }
    }, path);

    const res = classifyResponse(raw);
    if (res.kind === 'json') return res.data;
    lastMessage = res.message || res.kind;

    if (res.kind === 'login') {
      throw new Error(`未登录或会话已过期：${res.message}。请运行 bun run login 重新登录。`);
    }
    // waf / invalid：重新预热后重试，退避递增
    const backoff = 3000 * (attempt + 1);
    console.warn(
      `  ⚠ ${res.kind}（${lastMessage.slice(0, 60)}），${backoff}ms 后重新预热重试 ${attempt + 1}/${maxRetries}`
    );
    await sleep(backoff);
    await warmUp(page).catch(() => {});
  }
  throw new Error(`取数失败（已重试 ${maxRetries} 次）：${path} — ${lastMessage.slice(0, 200)}`);
}
