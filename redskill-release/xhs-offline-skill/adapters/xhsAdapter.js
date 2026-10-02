import { jsonRequest } from '../offline/network.js';
const count = value => {
  if (value == null) return undefined;
  const str = String(value).replaceAll(',', '');
  const number = Number.parseFloat(str);
  return Number.isFinite(number) ? Math.round(number * (str.includes('万') ? 10000 : /[wW]/.test(str) ? 10000 : /[kK]/.test(str) ? 1000 : 1)) : undefined;
};
function unwrap(result) {
  if (result?.isError || result?.success === false) throw new Error('小红书服务返回失败，请检查现有服务与登录状态');
  if (result?.content) {
    const text = result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    result = JSON.parse(text);
  }
  if (result?.success === false) throw new Error('小红书服务返回失败');
  return result?.data ?? result;
}
export function normalizeDetail(result, preview) {
  const data = unwrap(result);
  const note = data?.data?.note ?? data?.note ?? data;
  if (!note || note.type !== 'normal' || !note.noteId || note.noteId !== preview.id) throw new Error('详情不匹配或不是图文笔记');
  const images = (note.imageList ?? []).map(image => image.urlDefault || image.urlPre).filter(Boolean);
  if (!note.desc && !note.title && !images.length) throw new Error('笔记为空');
  return {
    id: note.noteId, source: 'xiaohongshu', title: note.title ?? '', text: note.desc ?? '',
    author: { id: note.user?.userId, name: note.user?.nickname ?? note.user?.nickName ?? '未知作者' },
    remoteImages: images, localImages: [],
    stats: { likes: count(note.interactInfo?.likedCount), comments: count(note.interactInfo?.commentCount), collects: count(note.interactInfo?.collectedCount) },
    publishedAt: Number.isFinite(note.time) && note.time > 0 ? new Date(note.time).toISOString() : undefined,
    sourceUrl: `https://www.xiaohongshu.com/explore/${encodeURIComponent(note.noteId)}`,
    estimatedReadSeconds: 0, cachedAt: '', cacheStatus: 'pending',
  };
}
/** Existing MCP may inject callTool(name, args). Default uses its documented local REST facade. */
export class XhsAdapter {
  mode = 'xhs';
  constructor({ baseUrl = 'http://127.0.0.1:18060', callTool, requestOptions } = {}) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('MCP 地址必须为本机服务');
    this.baseUrl = url.origin; this.callTool = callTool; this.requestOptions = requestOptions;
  }
  async listFeeds() {
    const raw = this.callTool ? await this.callTool('list_feeds', {}) : await jsonRequest(`${this.baseUrl}/api/v1/feeds/list`, {}, this.requestOptions);
    const data = unwrap(raw);
    if (!Array.isArray(data?.feeds)) throw new Error('推荐流格式不符合预期');
    return { items: data.feeds.filter(f => f.id && f.noteCard?.type === 'normal').map(f => ({ id: f.id, source: 'xiaohongshu', token: f.xsecToken })) };
    // Upstream list_feeds has no cursor contract. Do not invent pagination or loop the same feed.
  }
  async getFeedDetail(preview) {
    const args = { feed_id: preview.id, xsec_token: preview.token ?? '', load_all_comments: false };
    const raw = this.callTool ? await this.callTool('get_feed_detail', args) : await jsonRequest(`${this.baseUrl}/api/v1/feeds/detail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }, this.requestOptions);
    return normalizeDetail(raw, preview);
  }
}
