import {
  htmlToPlain,
  extractStocks,
  extractMentions,
  extractLinks,
  extractImages,
  detectType,
} from './parse.mjs';
import { buildConversation } from './conversation.mjs';

const USER_ID = '1247347556';

export function toRecord(status) {
  const html = status.text || status.description || '';
  const textPlain = htmlToPlain(html);
  const created = new Date(status.created_at);

  const rt = status.retweeted_status || null;
  const conv = buildConversation(status);

  return {
    id: status.id,
    url: `https://xueqiu.com/${USER_ID}/${status.id}`,
    created_at: created.toISOString(),
    year: created.getUTCFullYear(),
    edited_at: status.edited_at ? new Date(status.edited_at).toISOString() : null,
    type: detectType(status),
    thread_root_id: Number(status.retweet_status_id) > 0 ? Number(status.retweet_status_id) : null,
    source: status.source || '',
    title: status.rawTitle || status.title || '',
    text_html: html,
    text_plain: textPlain,
    char_count: textPlain.length,
    stocks: extractStocks(html),
    mentions: extractMentions(html),
    links: extractLinks(html),
    images: extractImages(html),
    retweet_of: rt
      ? {
          id: rt.id,
          user: (rt.user && rt.user.screen_name) || '',
          text_plain: htmlToPlain(rt.text || rt.description || ''),
        }
      : null,
    stats: {
      retweet: status.retweet_count || 0,
      reply: status.reply_count || 0,
      fav: status.fav_count || 0,
      like: status.like_count || 0,
    },
    // 对话语境：雪球上看不到「他在回谁、对方问了什么」，这里完整还原。
    // root 是最初的提问，chain 是按时间正序的往返对话（本人发言在最后）。
    conversation: { root: conv.root, chain: conv.chain },
    // 本人在这场对话里说的话（去掉引用的他人内容），做搜索和摘要时用这个
    own_text: conv.chain
      .filter((c) => c.speaker === '段永平')
      .map((c) => c.text)
      .join('\n'),
    replying_to: conv.chain.length ? conv.chain[conv.chain.length - 1].replying_to : null,
    text_truncated: !!status.truncated,
  };
}
