import { test, expect } from 'bun:test';
import {
  isFeatured,
  buildIndexEntry,
  buildYearShards,
  topicSlug,
  canonicalCompanyName,
  buildCompanyIndex,
  likeThreshold,
} from '../build/lib/shard.mjs';

const base = {
  id: '99', kind: 'thread', first_at: '2024-05-01T03:00:00.000Z', last_at: '2024-05-01T04:00:00.000Z',
  years: [2024], reply_count: 1, own_chars: 100, stocks: [],
  root: { id: 99, user: '提问者', text_plain: '问题' },
  posts: [{ id: 100, created_at: '2024-05-01T03:00:00.000Z', own_text: '回答', url: 'https://xueqiu.com/1247347556/100',
    conversation: { chain: [{ speaker: '段永平', text: '回答', replying_to: '提问者' }] }, stats: { like: 10, reply: 0, retweet: 0, fav: 0 } }],
  stats: { like: 10, reply: 0, retweet: 0, fav: 0 },
};
const enr = { topics: [{ path: '投资理念/能力圈', confidence: 0.9 }], companies: [], summary: '摘要', quotes: [], substantive: true };

test('非 substantive 一律不进精华', () => {
  const big = { ...base, own_chars: 9999, reply_count: 20, stats: { ...base.stats, like: 5000 } };
  expect(isFeatured(big, { ...enr, substantive: false }, 677)).toBe(false);
});

test('substantive 且长文进精华', () => {
  expect(isFeatured({ ...base, own_chars: 501 }, enr, 677)).toBe(true);
});

test('substantive 且深度对话进精华', () => {
  expect(isFeatured({ ...base, reply_count: 5 }, enr, 677)).toBe(true);
});

test('substantive 且高赞进精华', () => {
  expect(isFeatured({ ...base, stats: { ...base.stats, like: 677 } }, enr, 677)).toBe(true);
});

test('substantive 的原创一律进精华', () => {
  expect(isFeatured({ ...base, kind: 'original' }, enr, 677)).toBe(true);
});

test('substantive 但各项都不达标不进精华', () => {
  expect(isFeatured(base, enr, 677)).toBe(false);
});

test('索引条目只含轻量字段，不含正文', () => {
  const e = buildIndexEntry(base, enr, 677);
  expect(e.id).toBe('99');
  expect(e.date).toBe('2024-05-01');
  expect(e.kind).toBe('thread');
  expect(e.summary).toBe('摘要');
  expect(e.topics).toEqual(['投资理念/能力圈']);
  expect(e.reply_count).toBe(1);
  expect(e.like).toBe(10);
  expect(e.featured).toBe(false);
  expect(e.posts).toBeUndefined();
  expect(e.text_html).toBeUndefined();
});

test('缺标注时索引条目仍可生成', () => {
  const e = buildIndexEntry(base, undefined, 677);
  expect(e.summary).toBe('');
  expect(e.topics).toEqual([]);
  expect(e.featured).toBe(false);
});

test('年份分片按首条时间归年，正文只留净文本与对话链', () => {
  const shards = buildYearShards([base], { 99: enr });
  expect([...shards.keys()]).toEqual([2024]);
  const c = shards.get(2024)[0];
  expect(c.id).toBe('99');
  expect(c.root.user).toBe('提问者');
  expect(c.posts[0].own_text).toBe('回答');
  expect(c.posts[0].url).toBe('https://xueqiu.com/1247347556/100');
  expect(c.posts[0].text_html).toBeUndefined();
});

test('topicSlug 把话题路径转成文件名安全的 slug', () => {
  expect(topicSlug('投资理念/能力圈')).toBe('投资理念-能力圈');
  expect(topicSlug('投机批判')).toBe('投机批判');
});

// ── 公司名归一化（canonicalCompanyName）──

test('canonicalCompanyName 把 AI 写的别名收到 COMPANY_KEYWORDS 的规范键', () => {
  expect(canonicalCompanyName('贵州茅台')).toBe('茅台');
  expect(canonicalCompanyName('茅台')).toBe('茅台');
  expect(canonicalCompanyName('腾讯控股')).toBe('腾讯');
  expect(canonicalCompanyName('腾讯控股ADR')).toBe('腾讯');
  expect(canonicalCompanyName('伯克希尔-哈撒韦B')).toBe('伯克希尔');
  expect(canonicalCompanyName('谷歌C')).toBe('谷歌');
  expect(canonicalCompanyName('阿里巴巴-W')).toBe('阿里巴巴');
});

test('canonicalCompanyName 认代码与别名，且 ASCII 关键词仍走边界校验', () => {
  expect(canonicalCompanyName('AAPL')).toBe('苹果');
  expect(canonicalCompanyName('PDD')).toBe('拼多多');
  expect(canonicalCompanyName('OPPO')).toBe('步步高系');
  expect(canonicalCompanyName('vivo')).toBe('步步高系');
  expect(canonicalCompanyName('OPPO/vivo')).toBe('步步高系');
  // survivor 里的 vivo 前面是字母，边界校验拦下，不该被收成步步高系
  expect(canonicalCompanyName('Survivor Corp')).toBe('Survivor Corp');
});

test('canonicalCompanyName 命中多个规范键时取匹配到的关键词更长的那个', () => {
  // '小霸王'(3) 现在是独立规范键（不再并入步步高系），'谷歌'(2) 属于谷歌 —— 更长者优先
  expect(canonicalCompanyName('小霸王谷歌联名')).toBe('小霸王');
  // '拼多多'(3) 比 '苹果'(2) 长
  expect(canonicalCompanyName('苹果与拼多多')).toBe('拼多多');
});

test('canonicalCompanyName 小霸王归一到自身而非步步高系（同名不同实体，见 COMPANY_KEYWORDS 注释）', () => {
  expect(canonicalCompanyName('小霸王')).toBe('小霸王');
  expect(canonicalCompanyName('OPPO')).toBe('步步高系');
  expect(canonicalCompanyName('vivo')).toBe('步步高系');
  expect(canonicalCompanyName('步步高')).toBe('步步高系');
});

test('canonicalCompanyName 没命中规范键就原样返回（长尾留到阶段 B）', () => {
  expect(canonicalCompanyName('Palantir')).toBe('Palantir');
  expect(canonicalCompanyName('海底捞')).toBe('海底捞');
  expect(canonicalCompanyName('  可口可乐  ')).toBe('可口可乐');
  expect(canonicalCompanyName(123)).toBe(123);
  expect(canonicalCompanyName('')).toBe('');
});

// ── 公司索引（buildCompanyIndex）──

const conv = (id, stocks = []) => ({ ...base, id, stocks });
const enr2 = (companies) => ({ topics: [], companies, summary: '', quotes: [], substantive: true });

test('buildCompanyIndex 把同一家公司的多种写法合并成一条', () => {
  const convs = [conv('1'), conv('2'), conv('3')];
  const enriched = {
    1: enr2([{ name: '茅台', stance: 'holds' }]),
    2: enr2([{ name: '贵州茅台', stance: 'holds' }]),
    3: enr2([{ name: '茅台集团', stance: 'admires' }]),
  };
  const { companies } = buildCompanyIndex(convs, enriched);
  expect(Object.keys(companies)).toEqual(['茅台']);
  expect(companies['茅台'].holds).toEqual(['1', '2']);
  expect(companies['茅台'].admires).toEqual(['3']);
});

test('buildCompanyIndex 对未归一的长尾名做大小写合并：Zara 与 ZARA 归一到同一条', () => {
  const { companies } = buildCompanyIndex([conv('1'), conv('2')], {
    1: enr2([{ name: 'Zara', stance: 'admires' }]),
    2: enr2([{ name: 'ZARA', stance: 'neutral' }]),
  });
  expect(Object.keys(companies)).toEqual(['Zara']); // 展示名取先出现的写法
  expect(companies['Zara'].admires).toEqual(['1']);
  expect(companies['Zara'].neutral).toEqual(['2']);
});

test('buildCompanyIndex 五个桶齐全，非法 stance 兜到 unknown 而不是崩溃', () => {
  const { companies } = buildCompanyIndex([conv('1'), conv('2'), conv('3')], {
    1: enr2([{ name: '网易', stance: 'bullish' }]), // 不在 CLEAN_STANCES
    2: enr2([{ name: '网易', stance: undefined }]),
    3: enr2([{ name: '网易', stance: 'holds' }]),
  });
  expect(Object.keys(companies['网易']).sort()).toEqual(
    ['admires', 'criticizes', 'holds', 'name', 'neutral', 'unknown'].sort()
  );
  expect(companies['网易'].unknown).toEqual(['1', '2']);
  expect(companies['网易'].holds).toEqual(['3']);
});

test('buildCompanyIndex 对 __proto__ / constructor 这类公司名不崩溃', () => {
  const { companies } = buildCompanyIndex([conv('1'), conv('2')], {
    1: enr2([{ name: '__proto__', stance: 'neutral' }]),
    2: enr2([{ name: 'constructor', stance: 'criticizes' }]),
  });
  expect(companies['__proto__'].neutral).toEqual(['1']);
  expect(companies['constructor'].criticizes).toEqual(['2']);
  expect(Object.keys(companies).sort()).toEqual(['__proto__', 'constructor']);
});

test('buildCompanyIndex 并入 conv.stocks，记为 neutral', () => {
  const { companies } = buildCompanyIndex([conv('1', [{ symbol: '09992', name: '泡泡玛特' }])], {});
  expect(companies['泡泡玛特'].neutral).toEqual(['1']);
  expect(companies['泡泡玛特'].holds).toEqual([]);
});

test('buildCompanyIndex 中 AI 的 stance 优先于 stocks 带来的 neutral', () => {
  const { companies } = buildCompanyIndex(
    [conv('1', [{ symbol: 'SH600519', name: '贵州茅台' }])],
    { 1: enr2([{ name: '茅台', stance: 'holds' }]) }
  );
  expect(companies['茅台'].holds).toEqual(['1']);
  expect(companies['茅台'].neutral).toEqual([]);
});

test('buildCompanyIndex 同一场里同名公司只进一个桶，不重复计数', () => {
  const { companies } = buildCompanyIndex([conv('1')], {
    1: enr2([
      { name: '腾讯', stance: 'holds' },
      { name: '腾讯控股', stance: 'admires' },
    ]),
  });
  expect(companies['腾讯'].holds).toEqual(['1']);
  expect(companies['腾讯'].admires).toEqual([]);
});

test('buildCompanyIndex 丢弃缺 name 的脏元素，缺标注的对话不报错', () => {
  const { companies } = buildCompanyIndex([conv('1'), conv('2')], {
    1: enr2([{ stance: 'holds' }, { name: '   ', stance: 'holds' }, null]),
  });
  expect(Object.keys(companies)).toEqual([]);
});

// ── 指数/ETF 分流（instruments）──

test('buildCompanyIndex 把指数/ETF 分流到 instruments，不混进 companies', () => {
  const convs = [conv('1'), conv('2')];
  const enriched = {
    1: enr2([{ name: '标普500ETF', stance: 'admires' }]),
    2: enr2([
      { name: '三倍杠杆基金', stance: 'criticizes' },
      { name: '茅台', stance: 'holds' },
    ]),
  };
  const { companies, instruments } = buildCompanyIndex(convs, enriched);
  expect(Object.keys(companies)).toEqual(['茅台']);
  expect(Object.keys(instruments).sort()).toEqual(['三倍杠杆基金', '标普500ETF'].sort());
  expect(instruments['标普500ETF'].admires).toEqual(['1']);
  expect(instruments['三倍杠杆基金'].criticizes).toEqual(['2']);
});

test('buildCompanyIndex 裸 ticker（SPY/UNG）走 symbol 判定也分流到 instruments', () => {
  const { companies, instruments } = buildCompanyIndex([conv('1', [{ symbol: 'SPY', name: 'SPY' }])], {});
  expect(companies['SPY']).toBeUndefined();
  expect(instruments['SPY'].neutral).toEqual(['1']);
});

test('buildCompanyIndex instruments 桶格式与 companies 一致（五个 stance 桶齐全）', () => {
  const { instruments } = buildCompanyIndex([conv('1')], {
    1: enr2([{ name: '沪深300', stance: 'holds' }]),
  });
  expect(Object.keys(instruments['沪深300']).sort()).toEqual(
    ['admires', 'criticizes', 'holds', 'name', 'neutral', 'unknown'].sort()
  );
});

// ── 高赞阈值（likeThreshold）──

test('likeThreshold 空数组返回 0，不返回 undefined', () => {
  expect(likeThreshold([])).toBe(0);
  expect(likeThreshold(undefined)).toBe(0);
});

test('likeThreshold 单元素返回该元素赞数', () => {
  expect(likeThreshold([{ stats: { like: 42 } }])).toBe(42);
});

test('likeThreshold 取降序分位数', () => {
  const convs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ stats: { like: n * 10 } }));
  // 降序 [100..10]，floor(10*0.1)=1 → 第 2 高
  expect(likeThreshold(convs, 0.1)).toBe(90);
  expect(likeThreshold(convs, 0.5)).toBe(50);
  // 分位数落到数组末尾之外时兜到最小值，不返回 undefined
  expect(likeThreshold(convs, 1)).toBe(10);
});

test('likeThreshold 容忍缺失的 stats', () => {
  expect(likeThreshold([{}, { stats: { like: 5 } }], 0.1)).toBe(5);
});
