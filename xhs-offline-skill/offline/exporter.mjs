import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicJson, noSymlink, readJson } from './storage.mjs';
const viewerDir = fileURLToPath(new URL('../viewer/', import.meta.url));
export const safeJson = data => JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export async function writeViewer(dir, pack, feed) {
  const [template, css, js] = await Promise.all(['index.html', 'viewer.css', 'viewer.js'].map(name => readFile(path.join(viewerDir, name), 'utf8')));
  // Embedded JSON allows file:// opening without fetch, modules or a local server.
  const html = template.replace('/*VIEWER_CSS*/', () => css).replace('/*PACK_DATA*/', () => safeJson({ pack, feed })).replace('/*VIEWER_JS*/', () => js);
  await writeFile(path.join(dir, 'index.html'), html);
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
