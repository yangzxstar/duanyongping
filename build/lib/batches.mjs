import { matchCompanies } from './taxonomy.mjs';

// 只保留 AI 判断需要的字段。原始记录带 text_html 等大字段，
// 全塞进去会让 130 批的输入量翻好几倍。
export function toAiPayload(conv) {
  const posts = conv.posts
    .map((p) => ({ post_id: p.id, text: p.own_text || '' }))
    .filter((p) => p.text.length > 0);

  const allText = [conv.root?.text_plain || '', ...posts.map((p) => p.text)].join('\n');

  return {
    conv_id: conv.id,
    date: conv.first_at.slice(0, 10),
    kind: conv.kind,
    root_question: conv.root ? conv.root.text_plain : null,
    posts,
    hint_companies: matchCompanies(allText),
  };
}

// 雪球对"原贴被删"场景会把 root 文本填成这类占位语，本身不含可标注信息。
const EMPTY_ROOT_PLACEHOLDERS = new Set(['原帖已删除', '原帖已被作者删除']);

// posts 全空、且没有可供 AI 判断的 root_question（null / 空白 / 删帖占位）时，
// 这场对话除了时间和类型之外没有任何内容，应在切批前排除。
export function isEmptyPayload(payload) {
  if (payload.posts.length > 0) return false;
  const rq = payload.root_question;
  if (rq == null) return true;
  const trimmed = rq.trim();
  if (trimmed.length === 0) return true;
  return EMPTY_ROOT_PLACEHOLDERS.has(trimmed);
}

export function splitBatches(convs, size) {
  const out = [];
  for (let i = 0; i < convs.length; i += size) {
    out.push({ batch_no: out.length + 1, items: convs.slice(i, i + size) });
  }
  return out;
}

export function batchFileName(n) {
  return `batch-${String(n).padStart(3, '0')}.json`;
}

export function missingBatches(total, doneNos) {
  const done = new Set(doneNos);
  const out = [];
  for (let i = 1; i <= total; i++) if (!done.has(i)) out.push(i);
  return out;
}
