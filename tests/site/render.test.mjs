import { test, expect } from 'bun:test';
import { esc, mdLite, mdLiteCite, dialogueItems, dialogueHTML, convCard, withGapMarker, GAP_NOTE } from '../../site/render.js';

test('esc 转义 HTML 敏感字符', () => {
  expect(esc('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
});

test('mdLite 分段并渲染粗体，内容仍被转义', () => {
  expect(mdLite('**要点**：a<b\n\n第二段')).toBe('<p><strong>要点</strong>：a&lt;b</p><p>第二段</p>');
});

const thread = {
  root: { user: '提问者甲', text_plain: '请教一个问题' },
  posts: [
    { url: 'https://xueqiu.com/1/1', chain: [
      { speaker: '提问者甲', text: '问题详情' },
      { speaker: '段永平', text: '回答一' },
    ] },
    { url: 'https://xueqiu.com/1/2', chain: [
      { speaker: '段永平', text: '回答二' },
      { speaker: '提问者乙', text: '追问' },
      { speaker: '段永平', text: '回答三' },
    ] },
  ],
};

test('dialogueItems：root 在前，段永平被标 isDao', () => {
  const items = dialogueItems(thread);
  expect(items.length).toBe(6);
  expect(items[0]).toMatchObject({ speaker: '提问者甲', isRoot: true, isDao: false });
  expect(items.filter((m) => m.isDao).length).toBe(3);
});

test('dialogueItems：solo 无 chain 时回落到 own_text', () => {
  const solo = { root: null, posts: [{ own_text: '原创内容', chain: [] }] };
  expect(dialogueItems(solo)).toEqual([
    { speaker: '段永平', text: '原创内容', isDao: true, url: undefined },
  ]);
});

test('dialogueHTML：超过 5 条时余下条目进 fold，且默认展开', () => {
  const html = dialogueHTML(thread, { collapse: true });
  expect(html).toContain('<details class="fold" open>');
  expect(html).toContain('展开全部 6 条');
  expect(html).toContain('收起');
  expect((html.match(/class="msg/g) ?? []).length).toBe(6);
  expect(dialogueHTML(thread, { collapse: false })).not.toContain('展开全部');
});

test('convCard 含日期、雪球原帖链接与话题 chips', () => {
  const entry = { id: 'x1', date: '2024-01-02', kind: 'thread', summary: '摘要文本', topics: ['投资理念'], companies: ['苹果'], like: 10, featured: true };
  const html = convCard(entry, thread);
  expect(html).toContain('2024-01-02');
  expect(html).toContain('https://xueqiu.com/1/1');
  expect(html).toContain('雪球原帖');
  expect(html).toContain('#/topic/');
  expect(html).toContain('#/company/');
  expect(html).toContain('精华');
});

test('convCard 原文优先：对话在前，AI 摘要降为带标签的小字行', () => {
  const entry = { id: 'x1', date: '2024-01-02', kind: 'thread', summary: '摘要文本', topics: ['投资理念'], companies: ['苹果'], like: 10, featured: true };
  const html = convCard(entry, thread);
  expect(html.indexOf('class="dialogue')).toBeLessThan(html.indexOf('class="summary'));
  expect(html).toContain('AI 摘要');
  expect(html).toContain('summary dim');
  // 拿不到正文时退回摘要标题
  const fallback = convCard(entry, null);
  expect(fallback).toContain('<h3 class="summary">');
  expect(fallback).not.toContain('dialogue');
});

test('convCard 列表卡 chips 限量并折叠为 +n，详情页 allChips 显示全部', () => {
  const entry = {
    id: 'x1', date: '2024-01-02', kind: 'thread', summary: 's',
    topics: ['a', 'b', 'c', 'd', 'e'], companies: ['甲', '乙', '丙'], like: 0, featured: false,
  };
  const listHtml = convCard(entry, null);
  expect((listHtml.match(/<a class="chip/g) ?? []).length).toBe(5); // 3 话题 + 2 公司
  expect(listHtml).toContain('+3');
  const fullHtml = convCard(entry, null, { allChips: true });
  expect(fullHtml).not.toContain('+3');
  expect(fullHtml).toContain('>e<');
  expect(fullHtml).toContain('>丙<');
});

test('mdLiteCite 把成串 conv_id 替换成上标引注链接', () => {
  const html = mdLiteCite('立场明确（133176220、solo-126898894）。**要点**（20522378）');
  expect(html).toContain('sup class="cites"');
  expect(html).toContain('href="#/conv/133176220"');
  expect(html).toContain('href="#/conv/solo-126898894"');
  expect(html).toContain('>1</a>');
  expect(html).toContain('>2</a>');
  expect(html).toContain('>3</a>');
  expect(html).not.toContain('133176220、');
});

test('mdLiteCite 不动普通括注与混合内容', () => {
  const html = mdLiteCite('他提到（大约 2018 年）以及（见 133176220 注释）');
  expect(html).not.toContain('sup');
  expect(html).toContain('大约 2018 年');
});

test('withGapMarker 在 2018 与 2017 交界插一次标记', () => {
  const entries = [
    { date: '2019-01-01' }, { date: '2018-06-01' },
    { date: '2012-05-01' }, { date: '2011-03-23' },
  ];
  const out = withGapMarker(entries);
  expect(out.length).toBe(5);
  expect(out[2]).toEqual({ gap: true });
});

test('withGapMarker 单侧数据不插标记', () => {
  expect(withGapMarker([{ date: '2024-01-01' }]).length).toBe(1);
  expect(withGapMarker([{ date: '2011-01-01' }]).length).toBe(1);
  expect(GAP_NOTE).toContain('2013');
});
