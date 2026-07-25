import { htmlToPlain } from './parse.mjs';

const SELF = '段永平'; // 雪球昵称「大道无形我有型」

// 雪球把整条对话链内嵌在回复正文里，用 //@ 分层，形如：
//   回复@A: 我的话//@A:回复@段永平:A的话//@B:B更早的话
// 第 0 段是本人发言，其后每段是一位对话者，越靠后越早。
// 返回按时间正序（最早在前，本人发言在最后）的 [{speaker, text, replying_to}]。
export function parseReplyChain(plainText) {
  const raw = String(plainText || '').trim();
  const segments = raw.split('//@');

  const parsed = segments.map((seg, i) => {
    let speaker;
    let body;
    if (i === 0) {
      // 本人发言，可能以「回复@某人:」开头
      speaker = SELF;
      body = seg;
    } else {
      // 形如「昵称:内容」
      const m = /^([^:：]+)[:：]([\s\S]*)$/.exec(seg);
      speaker = m ? m[1].trim() : '';
      body = m ? m[2] : seg;
    }
    // 剥掉「回复@某人:」前缀，记下被回复者
    let replyingTo = null;
    const rm = /^回复\s*@([^:：]+)[:：]\s*/.exec(body.trim());
    if (rm) {
      replyingTo = rm[1].trim();
      body = body.trim().slice(rm[0].length);
    }
    return { speaker, text: body.trim(), replying_to: replyingTo };
  });

  // 后面的段落是更早的发言，反转成时间正序
  return parsed.reverse();
}

// 还原一条发言的完整语境：最初的提问 + 对话链
export function buildConversation(status) {
  const rt = status.retweeted_status || null;
  const rootId = Number(status.retweet_status_id) > 0 ? Number(status.retweet_status_id) : null;

  return {
    thread_root_id: rootId,
    root: rt
      ? {
          id: rt.id,
          user: (rt.user && rt.user.screen_name) || '',
          text_plain: htmlToPlain(rt.text || rt.description || ''),
        }
      : null,
    chain: parseReplyChain(htmlToPlain(status.text || status.description || '')),
  };
}
