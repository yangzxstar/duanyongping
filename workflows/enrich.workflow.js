export const meta = {
  name: 'dyp-enrich',
  description: '对段永平对话逐场做话题标注、公司立场、摘要与金句提炼',
  phases: [{ title: 'Enrich', detail: '每批 40 场对话' }],
}

const TOPIC_LIST = `
投资理念 — 价值投资的基本原则与世界观层面的讨论
投资理念/能力圈 — 懂与不懂的边界、不懂不做、如何判断自己是否真懂
投资理念/生意模式与护城河 — 什么是好生意、差异化、竞争壁垒、长期竞争力
投资理念/估值与安全边际 — 现金流折现、买入价格、贵与便宜的判断
投资理念/长期与复利 — 持有期限、时间的价值、复利思维
操作与心态 — 实际买卖决策与面对市场时的心理
操作与心态/买卖决策 — 什么时候买、什么时候卖、加仓减仓
操作与心态/逆向与波动 — 面对下跌与恐慌、市场先生、逆向买入
操作与心态/集中与分散 — 仓位集中度、几只股票合适
操作与心态/期权与杠杆 — 卖put、期权工具、对杠杆和借钱的态度
投机批判 — 对赌博式交易、追热点、做空、量化、短线的批评
企业经营 — 从经营者视角谈企业该怎么做
企业经营/本分 — 本分、做对的事情、敢为天下后
企业经营/消费者导向 — 以消费者为中心、产品与用户价值
企业经营/管理层与文化 — 企业文化、管理者品性、激励与治理
企业经营/产品与研发 — 产品定义、研发投入、技术路线选择
对大师的回应 — 谈巴菲特、芒格及其他投资人的观点与做法
行业判断 — 对具体行业生意特性的判断，如白酒、消费电子、互联网、AI
答疑与方法论 — 如何学投资、怎么读财报、给年轻人和普通投资者的建议
生活与人生 — 高尔夫、读书、家庭、慈善、教育、人生观
`.trim()

const SCHEMA = {
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
                stance: { type: 'string', enum: ['holds', 'admires', 'criticizes', 'neutral'] },
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
}

const DIR = '/Users/seal/duanyongping/data/enrich'

// 由 args 指定要跑哪些批次：{ batches: [1,2] } 或 { total: 130 }
const nums =
  args && Array.isArray(args.batches)
    ? args.batches
    : Array.from({ length: (args && args.total) || 130 }, (_, i) => i + 1)

function prompt(n) {
  const f = String(n).padStart(3, '0')
  return `你在为一个段永平（雪球用户「大道无形我有型」）公开发言的归档站做数据标注。

读取文件 ${DIR}/in/batch-${f}.json，它是一个数组，每个元素是一场对话：
- conv_id: 对话 id（字符串）
- root_question: 最初的提问（原创发言为 null）
- posts: 段永平在这场对话里说的话，按时间正序，每条有 post_id 和 text
- hint_companies: 关键词初筛出的可能相关公司，仅供参考，不要盲信

对每一场对话产出标注。要求：

1. topics：从下面这份固定体系里选，**只能用这些 path，一字不差**，可多选（通常 1-3 个），confidence 0-1：
${TOPIC_LIST}

2. companies：这场讨论真正涉及的公司。name 必须是非空字符串。**stance 必须准确区分**：
   - holds       他持有或明确表示会买
   - admires     他欣赏这个生意但未必持有
   - criticizes  他拿来当反面教材批评（如游戏驿站、三倍做空 ETF 这类投机标的）
   - neutral     只是提及
   把「他关注的公司」和「他批评的公司」搞混是严重错误。

3. summary：一句话（30-60 字）说明这场在谈什么、他的结论是什么。用中文。

4. quotes：0-3 条最值得引用的原话。**必须逐字复制 posts 里某条 text 的片段，一个字都不能改、不能拼接、不能润色、不能补标点**。post_id 必须是该片段所在那条的 id。宁可一条都不给，也绝不能杜撰——系统会逐字校验，对不上就丢弃并记为告警。空字符串和纯空白不是有效的 quote。

5. substantive：这场是否包含实质观点。像「哈哈」「同意」「是的」这类没有信息量的应答给 false。

只依据文件里的内容判断，**不要引入你自己知道的关于段永平的任何信息**。

把结果作为 results 数组返回，元素顺序与输入一致，conv_id 必须与输入一一对应。同时把完整结果写入 ${DIR}/out/batch-${f}.json，格式为 {"results": [...]}。`
}

phase('Enrich')
const done = await pipeline(nums, (n) =>
  agent(prompt(n), {
    label: `batch-${String(n).padStart(3, '0')}`,
    phase: 'Enrich',
    schema: SCHEMA,
  })
)

const ok = done.filter(Boolean).length
log(`完成 ${ok}/${nums.length} 批`)
return { completed: ok, requested: nums.length }
