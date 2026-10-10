import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { request, mapLimit } from './network.js';
export const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1050"><rect width="900" height="1050" fill="#e9e6dd"/><text x="450" y="500" text-anchor="middle" fill="#65685f" font-family="sans-serif" font-size="32">这张图片未能缓存</text><text x="450" y="555" text-anchor="middle" fill="#65685f" font-family="sans-serif" font-size="22">正文和其他图片仍可离线阅读</text></svg>`;
export function validateImageUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !(url.hostname === 'xhscdn.com' || url.hostname.endsWith('.xhscdn.com'))) throw new Error('图片地址不在小红书 CDN 范围内');
  url.protocol = 'https:';
  return url.href;
}
function imageExtension(bytes, mime, mock) {
  if (mock && mime === 'image/svg+xml') return 'svg';
  if (bytes.subarray(0, 3).equals(Buffer.from([255,216,255]))) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') return 'webp';
  if (/^GIF8[79]a$/.test(bytes.subarray(0,6).toString())) return 'gif';
  if (bytes.subarray(4,8).toString() === 'ftyp' && /avif|avis/.test(bytes.subarray(8,32).toString())) return 'avif';
  throw new Error('响应不是支持的图片格式');
}
export class MediaCache {
  constructor(dir, adapter, { maxBytes = 5 * 1024 ** 3, concurrency = 4 } = {}) {
    this.dir = dir; this.adapter = adapter; this.maxBytes = maxBytes; this.concurrency = concurrency; this.sizeBytes = 0;
  }
  async init() {
    await mkdir(path.join(this.dir, 'assets'), { recursive: true });
    await writeFile(path.join(this.dir, 'assets/placeholder.svg'), placeholder);
    this.sizeBytes = Buffer.byteLength(placeholder);
  }
  async cacheItem(item) {
    let failedImages = 0;
    const localImages = await mapLimit(item.remoteImages, this.concurrency, async (url, index) => {
      try {
        const image = this.adapter.getImage ? await this.adapter.getImage(url) : await request(validateImageUrl(url), { headers: { Referer: 'https://www.xiaohongshu.com/' } });
        const bytes = Buffer.from(image.bytes);
        const ext = imageExtension(bytes, image.mime, this.adapter.mode === 'mock');
        if (bytes.length > 25 * 1024 ** 2 || this.sizeBytes + bytes.length > this.maxBytes) throw new Error('超出缓存预算');
        const name = createHash('sha256').update(`${item.source}:${item.id}:${index}`).digest('hex').slice(0,24);
        const relative = `assets/${name}.${ext}`;
        this.sizeBytes += bytes.length;
        try { await writeFile(path.join(this.dir, relative), bytes); } catch(error) { this.sizeBytes -= bytes.length; throw error; }
        return relative;
      } catch {
        failedImages++;
        return 'assets/placeholder.svg';
      }
    });
    return { ...item, localImages, failedImages, cachedAt: new Date().toISOString(), cacheStatus: failedImages ? 'partial' : 'ready' };
  }
}
