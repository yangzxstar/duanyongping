import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import {
  htmlToPlain,
  extractStocks,
  extractMentions,
  extractLinks,
  extractImages,
  detectType,
} from '../build/lib/parse.mjs';

const page1 = JSON.parse(readFileSync(new URL('./fixtures/page1.json', import.meta.url), 'utf8'));
const byId = (id) => page1.statuses.find((s) => s.id === id);

test('htmlToPlain 把 @链接还原成纯文本', () => {
  const html = '回复<a href="https://xueqiu.com/n/钰头" target="_blank">@钰头</a>: 你好';
  expect(htmlToPlain(html)).toBe('回复@钰头: 你好');
});

test('htmlToPlain 把 <br/> 转成换行', () => {
  expect(htmlToPlain('第一行<br/>第二行')).toBe('第一行\n第二行');
});

test('htmlToPlain 把表情图片转成 [笑] 文本', () => {
  const html =
    '好的<img src="//assets.imedao.com/ugc/images/face/emoji_01_smile.png?v=1" title="[笑]" alt="[笑]" height="24" />';
  expect(htmlToPlain(html)).toBe('好的[笑]');
});

test('htmlToPlain 解码 HTML 实体', () => {
  expect(htmlToPlain('A&amp;B &lt;tag&gt; &quot;q&quot; &nbsp;x')).toBe('A&B <tag> "q"  x');
});

test('extractStocks 从 $名称(代码)$ 链接解析标的', () => {
  const html = '<a href="https://xueqiu.com/S/SPCX" target="_blank">$SpaceX(SPCX)$</a>支持一下';
  expect(extractStocks(html)).toEqual([{ symbol: 'SPCX', name: 'SpaceX' }]);
});

test('extractStocks 支持港股代码并去重', () => {
  const html =
    '<a href="https://xueqiu.com/S/09992">$泡泡玛特(09992)$</a> 又提一次 <a href="https://xueqiu.com/S/09992">$泡泡玛特(09992)$</a>';
  expect(extractStocks(html)).toEqual([{ symbol: '09992', name: '泡泡玛特' }]);
});

test('extractMentions 抓出被提及的昵称并去重', () => {
  const html =
    '回复<a href="https://xueqiu.com/n/阿宝">@阿宝</a>: 好//<a href="https://xueqiu.com/n/阿宝">@阿宝</a>:原话';
  expect(extractMentions(html)).toEqual(['阿宝']);
});

test('extractLinks 只保留站外链接', () => {
  const html =
    '看这个 <a href="https://www.apple.com/newsroom">新闻</a> 和 <a href="https://xueqiu.com/S/AAPL">$苹果(AAPL)$</a>';
  expect(extractLinks(html)).toEqual(['https://www.apple.com/newsroom']);
});

test('extractImages 排除表情、保留真实图片', () => {
  const html =
    '<img src="//assets.imedao.com/ugc/images/face/emoji_01_smile.png?v=1" alt="[笑]" /><img src="https://xqimg.imedao.com/19f8fe17255b570b3fe9cfe9.jpg!custom.jpg" />';
  expect(extractImages(html)).toEqual([
    'https://xqimg.imedao.com/19f8fe17255b570b3fe9cfe9.jpg!custom.jpg',
  ]);
});

// 以下用真实 fixture 校验类型判定
test('detectType 识别原创发言', () => {
  const s = byId(401883730); // 无 retweeted_status，retweet_status_id = 0
  expect(detectType(s)).toBe('original');
});

test('detectType 识别回复', () => {
  const s = byId(401955822); // 有 retweeted_status，正文以「回复」开头
  expect(detectType(s)).toBe('reply');
});

test('detectType 识别带评论的转发', () => {
  const s = byId(401939809); // 有 retweeted_status，正文不以「回复」开头
  expect(detectType(s)).toBe('retweet');
});

test('真实原创发言能解析出标的 SPCX', () => {
  const s = byId(401883730);
  expect(extractStocks(s.text)).toEqual([{ symbol: 'SPCX', name: 'SpaceX' }]);
});
