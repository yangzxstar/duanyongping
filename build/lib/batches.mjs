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
