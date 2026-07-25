// 预设话题体系：8 个一级 + 12 个二级 = 20 个节点。
// hint 是给 AI 归类时看的判据说明，不在界面展示。
export const TOPICS = [
  { path: '投资理念', label: '投资理念', hint: '价值投资的基本原则与世界观层面的讨论' },
  { path: '投资理念/能力圈', label: '能力圈', hint: '懂与不懂的边界、不懂不做、如何判断自己是否真懂' },
  { path: '投资理念/生意模式与护城河', label: '生意模式与护城河', hint: '什么是好生意、差异化、竞争壁垒、长期竞争力' },
  { path: '投资理念/估值与安全边际', label: '估值与安全边际', hint: '现金流折现、买入价格、贵与便宜的判断' },
  { path: '投资理念/长期与复利', label: '长期与复利', hint: '持有期限、时间的价值、复利思维' },

  { path: '操作与心态', label: '操作与心态', hint: '实际买卖决策与面对市场时的心理' },
  { path: '操作与心态/买卖决策', label: '买卖决策', hint: '什么时候买、什么时候卖、加仓减仓' },
  { path: '操作与心态/逆向与波动', label: '逆向与波动', hint: '面对下跌与恐慌、市场先生、逆向买入' },
  { path: '操作与心态/集中与分散', label: '集中与分散', hint: '仓位集中度、几只股票合适' },
  { path: '操作与心态/期权与杠杆', label: '期权与杠杆', hint: '卖put、期权工具、对杠杆和借钱的态度' },

  { path: '投机批判', label: '投机批判', hint: '对赌博式交易、追热点、做空、量化、短线的批评' },

  { path: '企业经营', label: '企业经营', hint: '从经营者视角谈企业该怎么做' },
  { path: '企业经营/本分', label: '本分', hint: '本分、做对的事情、敢为天下后' },
  { path: '企业经营/消费者导向', label: '消费者导向', hint: '以消费者为中心、产品与用户价值' },
  { path: '企业经营/管理层与文化', label: '管理层与文化', hint: '企业文化、管理者品性、激励与治理' },
  { path: '企业经营/产品与研发', label: '产品与研发', hint: '产品定义、研发投入、技术路线选择' },

  { path: '对大师的回应', label: '对大师的回应', hint: '谈巴菲特、芒格及其他投资人的观点与做法' },
  { path: '行业判断', label: '行业判断', hint: '对具体行业生意特性的判断，如白酒、消费电子、互联网、AI' },
  { path: '答疑与方法论', label: '答疑与方法论', hint: '如何学投资、怎么读财报、给年轻人和普通投资者的建议' },
  { path: '生活与人生', label: '生活与人生', hint: '高尔夫、读书、家庭、慈善、教育、人生观' },
];

export const TOPIC_PATHS = new Set(TOPICS.map((t) => t.path));

// 公司维度：只有 3.6% 的发言带可解析标签，绝大多数是直接写公司名，
// 所以必须用关键词补。实测覆盖率因此从 3.6% 提到 14.9%。
export const COMPANY_KEYWORDS = {
  苹果: ['苹果', 'AAPL', 'iPhone', '库克', '乔布斯'],
  茅台: ['茅台', 'SH600519'],
  腾讯: ['腾讯', '00700', 'TCEHY', '微信'],
  伯克希尔: ['伯克希尔', 'BRK.A', 'BRK.B'],
  拼多多: ['拼多多', 'PDD'],
  特斯拉: ['特斯拉', 'TSLA', '马斯克'],
  谷歌: ['谷歌', 'GOOG', 'Google'],
  英伟达: ['英伟达', 'NVDA', '黄仁勋'],
  阿里巴巴: ['阿里巴巴', 'BABA'],
  泡泡玛特: ['泡泡玛特', '09992', 'Labubu', '拉布布'],
  网易: ['网易', 'NTES', '丁磊'],
  游戏驿站: ['游戏驿站', 'GME'],
  Moderna: ['Moderna', 'MRNA'],
  '步步高系': ['步步高', 'OPPO', 'vivo', '小霸王'],
};

export function matchCompanies(text) {
  if (!text) return [];
  const hit = new Set();
  for (const [name, keys] of Object.entries(COMPANY_KEYWORDS)) {
    if (keys.some((k) => text.includes(k))) hit.add(name);
  }
  return [...hit];
}
