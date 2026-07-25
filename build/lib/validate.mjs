import { TOPIC_PATHS } from './taxonomy.mjs';

const STANCES = ['holds', 'admires', 'criticizes', 'neutral'];

// 给 Workflow agent 用的强约束 schema
export const ENRICH_SCHEMA = {
  type: 'object',
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['conv_id', 'topics', 'companies', 'summary', 'quotes', 'substantive'],
        properties: {
          conv_id: { type: 'string' },
          topics: {
            type: 'array',
            items: {
              type: 'object',
              required: ['path', 'confidence'],
              properties: {
                path: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          companies: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'stance'],
              properties: {
                name: { type: 'string' },
                symbol: { type: ['string', 'null'] },
                stance: { type: 'string', enum: STANCES },
              },
            },
          },
          summary: { type: 'string' },
          quotes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['text', 'post_id'],
              properties: { text: { type: 'string' }, post_id: { type: 'number' } },
            },
          },
          substantive: { type: 'boolean' },
        },
      },
    },
  },
};

export function validateEnrichment(entry, conv) {
  const warnings = [];
  const id = entry.conv_id;

  const topics = (entry.topics || []).filter((t) => {
    if (TOPIC_PATHS.has(t.path)) return true;
    warnings.push(`[${id}] 话题不在体系内，已丢弃：${t.path}`);
    return false;
  });

  const companies = (entry.companies || []).map((c) => {
    if (STANCES.includes(c.stance)) return c;
    warnings.push(`[${id}] 非法 stance「${c.stance}」，已归为 neutral：${c.name}`);
    return { ...c, stance: 'neutral' };
  });

  const byPost = new Map(conv.posts.map((p) => [p.id, p.own_text || '']));
  const quotes = (entry.quotes || []).filter((q) => {
    const text = byPost.get(q.post_id);
    if (text === undefined) {
      warnings.push(`[${id}] 金句引用了不属于本场的 post_id ${q.post_id}，已丢弃`);
      return false;
    }
    if (!text.includes(q.text)) {
      warnings.push(`[${id}] 金句非逐字原文（疑似杜撰），已丢弃：${q.text.slice(0, 30)}`);
      return false;
    }
    return true;
  });

  if (!entry.summary || entry.summary.trim().length === 0) {
    warnings.push(`[${id}] summary 为空`);
  }

  return {
    clean: {
      conv_id: id,
      topics,
      companies,
      summary: (entry.summary || '').trim(),
      quotes,
      substantive: !!entry.substantive,
    },
    warnings,
  };
}
