const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(s) {
  return s.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

const FACE_RE = /assets\.imedao\.com\/[^"']*\/face\//;

export function htmlToPlain(html) {
  if (!html) return '';
  let s = String(html);
  // 表情图片 → alt 文本，如 [笑]
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    if (FACE_RE.test(tag)) {
      const alt = /alt="([^"]*)"/i.exec(tag) || /title="([^"]*)"/i.exec(tag);
      return alt ? alt[1] : '';
    }
    return '';
  });
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ''); // 其余标签只去壳，保留链接文字
  return decodeEntities(s).trim();
}

// 匹配形如 <a href=".../S/SPCX">$SpaceX(SPCX)$</a>
const STOCK_RE = /<a\b[^>]*href="[^"]*xueqiu\.com\/S\/[^"]*"[^>]*>\$([^$()<>]+)\(([^)<>]+)\)\$<\/a>/gi;

export function extractStocks(html) {
  if (!html) return [];
  const out = [];
  const seen = new Set();
  for (const m of String(html).matchAll(STOCK_RE)) {
    const name = m[1].trim();
    const symbol = m[2].trim();
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol, name });
  }
  return out;
}

const MENTION_RE = /<a\b[^>]*href="[^"]*xueqiu\.com\/n\/([^"?]+)"[^>]*>/gi;

export function extractMentions(html) {
  if (!html) return [];
  const seen = new Set();
  for (const m of String(html).matchAll(MENTION_RE)) {
    seen.add(decodeURIComponent(m[1]).trim());
  }
  return [...seen];
}

const HREF_RE = /<a\b[^>]*href="([^"]+)"/gi;

export function extractLinks(html) {
  if (!html) return [];
  const seen = new Set();
  for (const m of String(html).matchAll(HREF_RE)) {
    const href = m[1];
    if (/xueqiu\.com\/(S|n)\//.test(href)) continue; // 标的与用户链接单独抽取
    seen.add(href);
  }
  return [...seen];
}

const IMG_SRC_RE = /<img\b[^>]*src="([^"]+)"/gi;

export function extractImages(html) {
  if (!html) return [];
  const seen = new Set();
  for (const m of String(html).matchAll(IMG_SRC_RE)) {
    const src = m[1];
    if (FACE_RE.test(src)) continue; // 表情不算图片
    seen.add(src.startsWith('//') ? 'https:' + src : src);
  }
  return [...seen];
}

export function detectType(status) {
  const hasRt = !!status.retweeted_status || Number(status.retweet_status_id) > 0;
  if (!hasRt) return 'original';
  const body = htmlToPlain(status.text || status.description || '');
  return body.startsWith('回复') ? 'reply' : 'retweet';
}
