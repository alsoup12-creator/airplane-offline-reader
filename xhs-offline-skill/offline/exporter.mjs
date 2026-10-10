import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { atomicJson, noSymlink, readJson } from './storage.mjs';
const viewerDir = fileURLToPath(new URL('../viewer/', import.meta.url));
export const safeJson = data => JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export async function writeViewer(dir, pack, feed) {
  await writeFile(path.join(dir, 'index.html'), await renderViewer(pack, feed));
}
async function renderViewer(pack, feed, embeddedAssets) {
  const [template, css, js] = await Promise.all(['index.html', 'viewer.css', 'viewer.js'].map(name => readFile(path.join(viewerDir, name), 'utf8')));
  // Embedded JSON allows file:// opening without fetch, modules or a local server.
  return template.replace('/*VIEWER_CSS*/', () => css).replace('/*PACK_DATA*/', () => safeJson({ pack, feed, embeddedAssets })).replace('/*VIEWER_JS*/', () => js);
}
const assetPattern = /^assets\/[a-zA-Z0-9_-]+\.(svg|png|jpg|webp|gif|avif)$/;
const mimeTypes = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
// Single HTML avoids mobile ZIP extraction and linked-file permission problems.
export async function portableDocument(store, id) {
  const pack = await store.get(id);
  if (!['ready', 'partial'].includes(pack.status)) throw new Error('只有包含可读内容的完成包可以传到手机');
  const dir = store.packPath(id);
  await noSymlink(path.join(dir, 'feed.json')); await noSymlink(path.join(dir, 'assets'));
  const feed = await readJson(path.join(dir, 'feed.json'));
  const assets = new Set(['assets/placeholder.svg', ...feed.flatMap(item => item.localImages)]);
  const embeddedAssets = {}; let bytes = 0;
  for (const asset of assets) {
    if (!assetPattern.test(asset)) throw new Error('包内资源路径不合法');
    const info = await noSymlink(path.join(dir, asset)); bytes += info.size;
    if (bytes > 64 * 1024 ** 2) throw new Error('图片超过 64 MB，单文件过大；请减少每包条数，或使用文件夹导出');
  }
  for (const asset of assets) {
    const image = await readFile(path.join(dir, asset));
    embeddedAssets[asset] = `data:${mimeTypes[asset.split('.').pop()]};base64,${image.toString('base64')}`;
  }
  const html = await renderViewer(pack, feed, embeddedAssets);
  if (Buffer.byteLength(html) > 100 * 1024 ** 2) throw new Error('阅读文件超过 100 MB，请减少每包条数');
  return { html, pack, feed, fileName: `${pack.id}.html` };
}
export async function exportPortable(store, id, output) {
  return store.withLock(async () => {
    const { html, pack, feed, fileName } = await portableDocument(store, id);
    const target = path.resolve(output ?? path.join(store.root, 'exports', fileName));
    const source = store.packPath(id);
    if (target === source || target.startsWith(source + path.sep)) throw new Error('导出不得覆盖源包');
    if (path.extname(target).toLowerCase() !== '.html') throw new Error('单文件导出路径必须以 .html 结尾');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html, { flag: 'wx' });
    const comments = { cachedCount: 0, completeNotes: 0, partialNotes: 0, unavailableNotes: 0 };
    for (const item of feed) {
      const status = item.commentSnapshot?.status;
      comments.cachedCount += (item.comments || []).reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);
      if (status === 'complete') comments.completeNotes++;
      else if (status === 'partial') comments.partialNotes++;
      else comments.unavailableNotes++;
    }
    return { id, viewer: target, fileName: path.basename(target), singleFile: true, status: pack.status,
      mode: pack.mode, itemCount: pack.itemCount, imageCount: pack.imageCount, failedImages: pack.failedImages,
      estimatedMinutes: pack.estimatedMinutes, comments, sizeBytes: Buffer.byteLength(html),
      sha256: createHash('sha256').update(html).digest('hex') };
  });
}
export async function directoryBytes(dir) {
  let size = 0;
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name); const info = await noSymlink(full);
    size += info.isDirectory() ? await directoryBytes(full) : info.size;
  }
  return size;
}
export async function finalizePack(dir, pack, feed) {
  await atomicJson(path.join(dir, 'feed.json'), feed);
  // sizeBytes includes metadata and the self-contained Viewer, not just pictures.
  for (let i = 0; i < 6; i++) {
    await atomicJson(path.join(dir, 'manifest.json'), pack);
    await writeViewer(dir, pack, feed);
    const bytes = await directoryBytes(dir);
    if (bytes === pack.sizeBytes) return;
    pack.sizeBytes = bytes;
  }
  await atomicJson(path.join(dir, 'manifest.json'), pack);
  await writeViewer(dir, pack, feed);
}
export async function exportPack(store, id, output) {
  return store.withLock(async () => {
    const pack = await store.get(id);
    if (pack.status === 'building') throw new Error('构建中的包不能导出');
    const dir = store.packPath(id);
    await noSymlink(path.join(dir, 'feed.json'));
    const feed = await readJson(path.join(dir, 'feed.json'));
    const target = path.resolve(output ?? path.join(store.root, 'exports', id));
    if (target === dir || target.startsWith(dir + path.sep) || dir.startsWith(target + path.sep)) throw new Error('导出目录不得与源包重叠');
    try { await stat(target); throw new Error('导出目录已存在，请选择新目录'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const assets = new Set(['assets/placeholder.svg', ...feed.flatMap(item => item.localImages)]);
    for (const asset of assets) {
      if (!/^assets\/[a-zA-Z0-9_-]+\.(svg|png|jpg|webp|gif|avif)$/.test(asset)) throw new Error('包内资源路径不合法');
      await noSymlink(path.join(dir, 'assets')); await noSymlink(path.join(dir, asset));
    }
    await mkdir(path.dirname(target), { recursive: true });
    await mkdir(target); await mkdir(path.join(target, 'assets'));
    for (const asset of assets) await copyFile(path.join(dir, asset), path.join(target, asset));
    const exported = { ...pack };
    await finalizePack(target, exported, feed);
    return { id, directory: target, viewer: path.join(target, 'index.html'), status: exported.status, sizeBytes: exported.sizeBytes };
  });
}
