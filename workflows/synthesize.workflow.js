export const meta = {
  name: 'dyp-synthesize',
  description: '按话题综述段永平的观点，并写一篇投资体系总纲',
  phases: [
    { title: 'Topics', detail: '每个话题一篇综述' },
    { title: 'Overview', detail: '投资体系总纲' },
  ],
}

const ALL_TOPICS = [
  '投资理念',
  '投资理念/能力圈',
  '投资理念/生意模式与护城河',
  '投资理念/估值与安全边际',
  '投资理念/长期与复利',
  '操作与心态',
  '操作与心态/买卖决策',
  '操作与心态/逆向与波动',
  '操作与心态/集中与分散',
  '操作与心态/期权与杠杆',
  '投机批判',
  '企业经营',
  '企业经营/本分',
  '企业经营/消费者导向',
  '企业经营/管理层与文化',
  '企业经营/产品与研发',
  '对大师的回应',
  '行业判断',
  '答疑与方法论',
  '生活与人生',
]

const DATA = '/Users/seal/duanyongping/data'

// args.topics 指定要跑哪些话题；args.overview 为 false 则跳过总纲
const topicPaths = args && Array.isArray(args.topics) ? args.topics : ALL_TOPICS
const wantOverview = !(args && args.overview === false)

const TOPIC_SCHEMA = {
  type: 'object',
  required: ['topic_path', 'essay', 'key_points', 'best_quotes', 'conv_count'],
  properties: {
    topic_path: { type: 'string' },
    essay: { type: 'string' },
    key_points: {
      type: 'array',
      items: {
        type: 'object',
        required: ['point', 'conv_ids'],
        properties: {
          point: { type: 'string' },
          conv_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    best_quotes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text', 'conv_id', 'date'],
        properties: {
          text: { type: 'string' },
          conv_id: { type: 'string' },
          date: { type: 'string' },
        },
      },
    },
    conv_count: { type: 'number' },
  },
}

const OVERVIEW_SCHEMA = {
  type: 'object',
  required: ['title', 'essay', 'pillars'],
  properties: {
    title: { type: 'string' },
    essay: { type: 'string' },
    pillars: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'gist', 'topic_paths'],
        properties: {
          name: { type: 'string' },
          gist: { type: 'string' },
          topic_paths: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

function slug(p) {
  return p.replace(/\//g, '-')
}

function topicPrompt(path) {
  return `你在为段永平（雪球用户「大道无形我有型」）的公开发言归档站撰写话题综述。

数据在两个文件里：
- ${DATA}/enriched.json：对象，键是对话 id，值含 topics（话题数组，每个有 path）、summary（一句话摘要）、quotes（金句，每条有 text 和 post_id）、companies、substantive
- ${DATA}/conversations.json：数组，每个元素含 id、first_at（ISO 时间）、reply_count、own_chars 等元信息

请用脚本或工具筛出 enriched.json 中 topics 里存在 path 恰好等于「${path}」的全部对话，据此写综述。注意只匹配完全相等的 path，不要把子话题（如「${path}/xxx」）算进来。

产出四项：

1. essay：中文综述，**篇幅按语料量伸缩**——不足 20 场写 300-600 字，20-200 场写 600-1200 字，超过 200 场可写到 1200-2000 字。讲清他在这个话题上的核心主张、这些主张之间的逻辑关系、以及有没有随时间演变。要有结构和判断，不要罗列流水账。在论断后用括号标注支撑它的 conv_id。

2. key_points：3-8 条要点。每条含 point（一句话）和 conv_ids（支撑该要点的对话 id 数组，至少 1 个，必须是真实存在于 enriched.json 里的键）。

3. best_quotes：3-10 条最有代表性的原话。**只能从这些对话的 quotes 字段里挑现成的，原样照抄 text，一个字都不要改**。每条附 conv_id 和 date（从 conversations.json 里查该对话的 first_at 取前 10 位）。如果可选的 quotes 不足 3 条，就有几条给几条，不要为了凑数而自己编写或改写。

4. conv_count：这个话题下的对话总数（实际筛出的数量）。

**硬性要求：**
- 只依据上述两个文件里的内容。**绝对不要引入你自己知道的任何关于段永平的信息**——哪怕你确信他说过某句名言、或知道他的某段经历，语料里没有就不能写进去。这一条最重要。
- 每个论点都要能追溯到具体 conv_id。
- 如果这个话题下的对话少于 3 场，essay 就如实说明「语料中这一话题讨论较少」并简要概括，不要硬凑篇幅。

完成后把结果写入 ${DATA}/topics/${slug(path)}.json，然后把同样的内容作为结构化结果返回。`
}

phase('Topics')
const topics = (
  await parallel(
    topicPaths.map((p) => () => agent(topicPrompt(p), { label: p, phase: 'Topics', schema: TOPIC_SCHEMA }))
  )
).filter(Boolean)

log(`完成 ${topics.length}/${topicPaths.length} 篇话题综述`)

let overview = null
if (wantOverview) {
  phase('Overview')
  overview = await agent(
    `你在为段永平（雪球用户「大道无形我有型」）公开发言归档站写一篇「投资体系总纲」。

请读取 ${DATA}/topics/ 目录下全部 20 个 JSON 文件，每个是一篇话题综述，含 topic_path、essay、key_points、best_quotes、conv_count。

据此写三项：

1. title：总纲标题
2. essay：1500-2500 字。讲清他这套投资体系的整体结构——有哪几根支柱、支柱之间怎么咬合、什么是根上的东西什么是从根上长出来的。要让读者读完知道「他到底是怎么想的」，而不是看到一堆观点罗列。
3. pillars：3-6 根支柱，每根含 name、gist（一两句话说透这根支柱）、topic_paths（关联的话题路径数组，必须是那 20 个话题里真实存在的 path）。

**只依据这 20 篇综述的内容，不要引入任何外部信息**——不要写他的生平经历、不要引用综述里没出现过的话。

完成后把结果写入 ${DATA}/overview.json，然后把同样的内容作为结构化结果返回。`,
    { label: 'overview', phase: 'Overview', schema: OVERVIEW_SCHEMA }
  )
}

// Workflow 脚本本身没有文件系统权限，落盘一律由 agent 完成（见上面提示词）
return { topics: topics.length, overview: overview ? overview.title : null }
