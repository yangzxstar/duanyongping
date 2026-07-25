import { TOPIC_PATHS } from './taxonomy.mjs';

const STANCES = ['holds', 'admires', 'criticizes', 'neutral'];

// 清洗后（validateEnrichment 返回的 clean 数据）允许出现的 stance 取值。
// 'unknown' 特意不放进上面 STANCES / 下面 ENRICH_SCHEMA 的 enum 里：
// STANCES/ENRICH_SCHEMA 约束的是 AI 的输出，AI 只应该产出合法的四种 stance；
// 'unknown' 只是校验器在"AI 输出了不认识的 stance"时的归一化结果，
// 用来和真正的 neutral（确实持中性态度）区分开，避免把"模型瞎写"误判成"中性"，
// 供下游按 stance 分组统计时使用。
export const CLEAN_STANCES = ['holds', 'admires', 'criticizes', 'neutral', 'unknown'];

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

// confidence 必须是 [0,1] 区间内的有限 number，否则视为非法。
function isValidConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateEnrichment(entry, conv) {
  const warnings = [];
  const id = entry.conv_id;

  const topics = (entry.topics || [])
    .filter((t) => {
      if (TOPIC_PATHS.has(t.path)) return true;
      warnings.push(`[${id}] 话题不在体系内，已丢弃：${t.path}`);
      return false;
    })
    .map((t) => {
      if (isValidConfidence(t.confidence)) return t;
      warnings.push(
        `[${id}] 话题「${t.path}」的 confidence 非法（${JSON.stringify(t.confidence)}），已归一化为 0.5`
      );
      return { ...t, confidence: 0.5 };
    });

  const companies = (entry.companies || []).map((c) => {
    let company = c;
    if (!STANCES.includes(company.stance)) {
      // 归为字符串 'unknown'，而不是 'neutral'——'neutral' 应该只表示
      // "确实持中性态度"，不能和"模型输出了不认识的值"混为一谈，
      // 否则下游会把本该是批评/看好的公司误判成中性。
      warnings.push(`[${id}] 非法 stance「${company.stance}」，已归为 unknown：${company.name}`);
      company = { ...company, stance: 'unknown' };
    }
    if (company.symbol !== null && typeof company.symbol !== 'string') {
      warnings.push(
        `[${id}] symbol 非法（${JSON.stringify(company.symbol)}），已置为 null：${company.name}`
      );
      company = { ...company, symbol: null };
    }
    return company;
  });

  const byPost = new Map(conv.posts.map((p) => [p.id, p.own_text || '']));
  const quotes = (entry.quotes || []).filter((q) => {
    // 先判空/判类型，必须在 includes() 之前：''.includes('') 恒为 true，
    // 空字符串（或纯空白、非字符串）金句会被当成"逐字命中"直接放行，
    // 这是杜撰校验最容易被绕过的洞，必须在这里先拦住。
    if (typeof q.text !== 'string' || q.text.trim().length === 0) {
      const preview = typeof q.text === 'string' ? q.text : JSON.stringify(q.text);
      warnings.push(`[${id}] 金句为空或非法类型（疑似杜撰占位），已丢弃：${preview}`);
      return false;
    }
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
