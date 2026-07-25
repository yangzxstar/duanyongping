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
//
// 「小霸王」独立成条，不并入「步步高系」：段永平早年经营过小霸王，但语料里
// 2020 年后出现的「小霸王」指的是另一家借用了这个名字的游戏机公司（他在
// conv 155952478 里明确撇清关系：那家公司成了被执行人，他不认识背后的
// "领先科技有限公司"）。两者是同名不同实体，合并会把针对那家陌生公司的
// 负面评价张冠李戴算到步步高系（他的核心持仓）头上。
export const COMPANY_KEYWORDS = {
  苹果: ['苹果', 'AAPL', 'iPhone', '库克', '乔布斯'],
  茅台: ['茅台', 'SH600519'],
  腾讯: ['腾讯', '00700', 'TCEHY', '微信'],
  伯克希尔: ['伯克希尔', 'BRK.A', 'BRK.B'],
  拼多多: ['拼多多', 'PDD'],
  特斯拉: ['特斯拉', 'TSLA', '马斯克'],
  谷歌: ['谷歌', 'GOOG', 'Google', 'GOOGLE'],
  英伟达: ['英伟达', 'NVDA', '黄仁勋'],
  阿里巴巴: ['阿里巴巴', 'BABA'],
  泡泡玛特: ['泡泡玛特', '09992', 'Labubu', '拉布布'],
  网易: ['网易', 'NTES', '丁磊'],
  游戏驿站: ['游戏驿站', 'GME'],
  Moderna: ['Moderna', 'MRNA'],
  '步步高系': ['步步高', 'OPPO', 'vivo'],
  小霸王: ['小霸王'],
};

// 由 ASCII 字母/数字/点组成的关键词（不论大小写，如 '00700'、'AAPL'、'BRK.B'、
// 'iPhone'、'vivo'）用 includes 做子串匹配会误命中更长的数字/字母串（如
// "1007000" 误中 "00700"，"survivor" 误中 "vivo"），所以一律要做边界校验：
//   1. 命中位置前面那个字符不能是 ASCII 字母或数字；
//   2. 命中位置后面那个字符不能是 ASCII 字母；
//   3. 额外地，如果关键词最后一个字符是数字，那么后面那个字符也不能是数字
//      （允许 'iPhone13' 这种字母收尾的品牌名+型号写法，但不允许 'SH6005191'
//      这种数字收尾的代码被更长的数字串吞掉）。
// 纯中文关键词（如 '苹果'、'茅台'）不做边界校验，仍用原始 includes——中文没有
// 词边界概念。
const ASCII_KEYWORD_RE = /^[A-Za-z0-9.]+$/;
const isAsciiAlpha = (ch) => /[A-Za-z]/.test(ch);
const isAsciiDigit = (ch) => /[0-9]/.test(ch);
const isAsciiAlnum = (ch) => isAsciiAlpha(ch) || isAsciiDigit(ch);

function includesWithBoundary(text, keyword) {
  const endsWithDigit = isAsciiDigit(keyword[keyword.length - 1]);
  let from = 0;
  while (true) {
    const idx = text.indexOf(keyword, from);
    if (idx === -1) return false;
    const before = idx > 0 ? text[idx - 1] : '';
    const after = idx + keyword.length < text.length ? text[idx + keyword.length] : '';
    const beforeOk = !isAsciiAlnum(before);
    const afterOk = !isAsciiAlpha(after) && (!endsWithDigit || !isAsciiDigit(after));
    if (beforeOk && afterOk) return true;
    from = idx + 1;
  }
}

// 单个关键词的匹配判据（ASCII 关键词走边界校验，中文关键词走 includes）。
// 导出出去是因为下游（公司名归一化）需要知道"命中的是哪一个关键词"来做
// 长度优先的消歧，不能只拿到 matchCompanies 的规范名列表。
export function matchesKeyword(text, keyword) {
  if (!text || !keyword) return false;
  return ASCII_KEYWORD_RE.test(keyword)
    ? includesWithBoundary(text, keyword)
    : text.includes(keyword);
}

export function matchCompanies(text) {
  if (!text) return [];
  const hit = new Set();
  for (const [name, keys] of Object.entries(COMPANY_KEYWORDS)) {
    if (keys.some((k) => matchesKeyword(text, k))) hit.add(name);
  }
  return [...hit];
}

// ── 指数/ETF 判定（isInstrument）──────────────────────────────────────────
// 用户明确要求：指数和 ETF 不是公司，不能混进公司维度索引，但内容本身有价值
// （如批评三倍杠杆 ETF 的发言），要分流到独立的 instruments 维度，不能丢弃。
//
// 判据不是凭空定的，是先写一次性脚本扫描 site/data/companies.json 当时的
// 380 个公司名，把实际命中的指数/ETF 列出来后归纳的三类判据：
//   1. 名称包含基金类关键词：ETF / 指数 / 基金 / LOF / ETN / REIT
//      （命中：标普500ETF、纳指ETF、标普500指数、上证指数、纳斯达克综合指数、
//       纳指3X做空ETF、美国天然气ETF、美国天然气价ETF(UNG)、美国天然气基金、
//       三倍杠杆基金、方舟投资（木头姐基金）——symbol 为 ARKK，语境是拿她的
//       基金和巴菲特对比，非指某家实体运营公司）；
//   2. 名称匹配常见指数简称：上证/深证/创业板/沪深300/中证/恒生/标普/纳指/
//      纳斯达克/道琼斯/罗素（命中：沪深300、中证100、上证50、纳指3X做空-
//      ProShares，这几个不含"指数/ETF"字样但本身就是指数简称或指数类产品名）；
//   3. 名称或 symbol 命中已知的裸 ticker 白名单（命中：SPY、UNG——语料里这两
//      个是不带任何"ETF/指数/基金"字样的裸代码，前两条判据兜不住，只能靠
//      白名单认）。白名单只收录扫描中实际出现过的，不做未验证的扩充猜测。
const INSTRUMENT_NAME_KEYWORDS = ['ETF', '指数', '基金', 'LOF', 'ETN', 'REIT'];
const INSTRUMENT_NAME_PATTERNS = [
  '上证', '深证', '创业板', '沪深300', '中证', '恒生', '标普', '纳指', '纳斯达克', '道琼斯', '罗素',
];
const INSTRUMENT_TICKERS = new Set(['SPY', 'UNG']);

export function isInstrument(name, symbol) {
  const n = typeof name === 'string' ? name.trim() : '';
  const s = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
  if (n) {
    if (INSTRUMENT_NAME_KEYWORDS.some((k) => n.includes(k))) return true;
    if (INSTRUMENT_NAME_PATTERNS.some((k) => n.includes(k))) return true;
    if (INSTRUMENT_TICKERS.has(n.toUpperCase())) return true;
  }
  if (s && INSTRUMENT_TICKERS.has(s)) return true;
  return false;
}
