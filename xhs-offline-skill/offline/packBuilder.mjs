import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { estimateReadSeconds } from './durationEstimator.mjs';
import { atomicJson } from './storage.mjs';
import { MediaCache } from './cacheManager.mjs';
import { finalizePack } from './exporter.mjs';
export function validateOptions(options) {
  const value = { reserveRatio: 1.25, maxItems: 300, maxPages: 30, maxBytes: 5 * 1024 ** 3, allowSeenContent: false, ...options };
  for (const [key, min, max] of [['targetMinutes', .1, 1440], ['reserveRatio', 1, 2], ['maxItems', 1, 300], ['maxPages', 1, 100], ['maxBytes', 1024, 20 * 1024 ** 3]]) {
    if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) throw new Error(`${key} 必须在 ${min} 到 ${max} 之间`);
  }
  if (!Number.isInteger(value.maxItems) || !Number.isInteger(value.maxPages)) throw new Error('maxItems 和 maxPages 必须为整数');
  return value;
}
export async function preparePack(store, adapter, options, onProgress = () => {}) {
  const settings = validateOptions(options);
  return store.withLock(async () => {
    const id = `xhs-offline-${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}-${randomUUID().slice(0,8)}`;
    const dir = store.packPath(id); await mkdir(dir);
    const pack = { schemaVersion: 1, id, mode: adapter.mode, targetMinutes: settings.targetMinutes, reserveRatio: settings.reserveRatio,
      estimatedMinutes: 0, itemCount: 0, imageCount: 0, failedImages: 0, sizeBytes: 0,
      createdAt: new Date().toISOString(), status: 'building', itemIds: [], issues: [] };
    await atomicJson(path.join(dir, 'manifest.json'), pack);
    await atomicJson(path.join(dir, 'feed.json'), []);
    const seen = settings.allowSeenContent ? new Set() : await store.seen();
    const encountered = new Set(); const cursors = new Set(); const selected = []; const cached = [];
    const target = Math.ceil(settings.targetMinutes * settings.reserveRatio * 60);
    let total = 0, cursor, attempts = 0, detailFailures = 0;
    const issue = message => { if (!pack.issues.includes(message)) pack.issues.push(message); };
    // Progress is observational; host logging failures must not corrupt a pack.
    const progress = state => { try { onProgress({ packId: id, targetSeconds: target, ...state }); } catch {} };
    try {
      for (let pageIndex = 0; pageIndex < settings.maxPages && total < target && attempts < settings.maxItems; pageIndex++) {
        let page;
        try { page = await adapter.listFeeds(cursor); }
        catch { issue('推荐流获取失败，请检查现有 MCP 服务与登录状态'); break; }
        if (!Array.isArray(page?.items)) { issue('推荐流返回格式不正确'); break; }
        progress({ phase: 'feed', page: pageIndex + 1, fetched: page.items.length });
        for (const preview of page.items) {
          if (!preview.id || !preview.source) continue;
          const key = `${preview.source}:${preview.id}`;
          if (seen.has(key) || encountered.has(key)) continue;
          encountered.add(key); attempts++;
          try {
            const item = await adapter.getFeedDetail(preview);
            if (item.id !== preview.id || item.source !== preview.source || !Array.isArray(item.remoteImages) || item.remoteImages.length > 100 || typeof (item.text ?? '') !== 'string' || (item.text ?? '').length > 100000) throw new Error('内容格式不正确');
            item.estimatedReadSeconds = estimateReadSeconds(item);
            selected.push(item); total += item.estimatedReadSeconds;
            progress({ phase: 'details', items: selected.length, estimatedSeconds: total });
          } catch { detailFailures++; }
          if (total >= target || attempts >= settings.maxItems) break;
        }
        if (!page.nextCursor || cursors.has(page.nextCursor)) break;
        cursors.add(page.nextCursor); cursor = page.nextCursor;
      }
      if (total < target) issue('可用内容不足或已达到请求上限，未达到目标时长与冗余');
      if (detailFailures) issue(`${detailFailures} 条详情未能读取`);
      const cache = new MediaCache(dir, adapter, { maxBytes: settings.maxBytes }); await cache.init();
      for (const item of selected) {
        const result = await cache.cacheItem(item); cached.push(result);
        pack.estimatedMinutes = cached.reduce((sum, entry) => sum + entry.estimatedReadSeconds, 0) / 60;
        pack.itemIds.push(`${result.source}:${result.id}`); pack.itemCount = cached.length;
        pack.failedImages += result.failedImages;
        pack.imageCount += result.localImages.length - result.failedImages;
        pack.sizeBytes = cache.sizeBytes;
        await atomicJson(path.join(dir, 'feed.json'), cached);
        await atomicJson(path.join(dir, 'manifest.json'), pack);
        progress({ phase: 'media', completed: cached.length, planned: selected.length, sizeBytes: cache.sizeBytes, failedImages: pack.failedImages, estimatedSeconds: Math.round(pack.estimatedMinutes * 60) });
      }
    } catch { issue('构建意外中断，已保存成功写入的内容'); }
    if (pack.failedImages) issue(`${pack.failedImages} 张图片未能缓存，已放入本地占位图`);
    pack.status = !cached.length ? 'failed' : pack.issues.length ? 'partial' : 'ready';
    await store.addHistory(cached, id);
    await finalizePack(dir, pack, cached);
    return { ...pack, directory: dir, viewer: path.join(dir, 'index.html') };
  });
}
