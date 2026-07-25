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

// topics/companies/quotes 本该是数组，但模型偶尔会返回字符串、单个对象等走样结果。
// `|| []` 只兜得住 null/undefined，兜不住这些真值非数组——这里显式校验类型，
// 不是数组就当空数组处理，并告警（模型返回非数组本身就是值得记录的异常，不该静默吞掉）。
function ensureArray(value, id, field, warnings) {
  if (Array.isArray(value)) return value;
  if (value !== undefined && value !== null) {
    warnings.push(
      `[${id}] ${field} 应为数组，实际是 ${typeof value}（${JSON.stringify(value)}），已按空数组处理`
    );
  }
  return [];
}

// 数组内的元素也可能被模型塞进 null/undefined 等非对象垃圾值，
// 后续逻辑（如 t.path、c.stance、q.text）都要求元素是对象，先在这里统一拦截丢弃。
function isDroppableElement(value) {
  return typeof value !== 'object' || value === null;
}

function dropInvalidElements(list, id, field, warnings) {
  return list.filter((item) => {
    if (isDroppableElement(item)) {
      warnings.push(`[${id}] ${field} 中存在非法元素（${JSON.stringify(item)}），已丢弃`);
      return false;
    }
    return true;
  });
}

export function validateEnrichment(entry, conv) {
  const warnings = [];

  // entry 本身也可能是畸形的：AI 返回的 results 数组里混入 null/undefined/非对象
  // 元素时，上游若直接透传每一项调用本函数，entry 会是 null/undefined/字符串等。
  // 这是和 topics/companies/quotes 数组里混入 null 完全同类的失败模式（只是高了一层），
  // 同样不该 throw，直接清洗成空标注并告警。
  if (typeof entry !== 'object' || entry === null) {
    warnings.push(`entry 不是合法对象（${typeof entry}），已按空标注处理`);
    return {
      clean: {
        conv_id: undefined,
        topics: [],
        companies: [],
        summary: '',
        quotes: [],
        substantive: false,
      },
      warnings,
    };
  }

  const id = entry.conv_id;

  const topics = dropInvalidElements(ensureArray(entry.topics, id, 'topics', warnings), id, 'topics', warnings)
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

  const companies = dropInvalidElements(
    ensureArray(entry.companies, id, 'companies', warnings),
    id,
    'companies',
    warnings
  )
    .filter((c) => {
      // isDroppableElement 只拦住了非对象/null，但 typeof [] === 'object'，
      // 数组元素会漏过去，被当成合法公司对象做字段修复，产出带数字键、
      // 没有 name 的垃圾记录（如 [1,2,3] → {"0":1,"1":2,"2":3,stance,symbol}）。
      // 这里补上整条校验：元素必须是非数组的普通对象，且 name 必须是非空字符串
      // （trim 后非空）。不满足就整条丢弃并告警，不修补——因为连 name 都没有，
      // 没有可修复的基础，下游按 name 建索引会被污染。
      if (Array.isArray(c)) {
        warnings.push(`[${id}] companies 中存在非法元素（数组），已丢弃：${JSON.stringify(c)}`);
        return false;
      }
      if (typeof c.name !== 'string' || c.name.trim().length === 0) {
        warnings.push(`[${id}] companies 中存在非法元素（缺少合法 name），已丢弃：${JSON.stringify(c)}`);
        return false;
      }
      return true;
    })
    .map((c) => {
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
  const quotes = dropInvalidElements(ensureArray(entry.quotes, id, 'quotes', warnings), id, 'quotes', warnings).filter(
    (q) => {
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
    }
  );

  // summary 本该是字符串，但模型偶尔会返回数字、对象等走样结果——真值非字符串同样
  // 会在 .trim() 上崩溃，这里先归一化为字符串（非法值按空字符串处理并告警），
  // 再走"summary 为空"的既有告警逻辑。
  let summary = entry.summary;
  if (summary !== undefined && summary !== null && typeof summary !== 'string') {
    warnings.push(
      `[${id}] summary 不是字符串（${typeof summary}，${JSON.stringify(summary)}），已按空字符串处理`
    );
    summary = '';
  }

  if (!summary || summary.trim().length === 0) {
    warnings.push(`[${id}] summary 为空`);
  }

  return {
    clean: {
      conv_id: id,
      topics,
      companies,
      summary: (summary || '').trim(),
      quotes,
      substantive: !!entry.substantive,
    },
    warnings,
  };
}
