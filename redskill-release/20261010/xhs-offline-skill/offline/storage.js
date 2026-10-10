import { mkdir, readFile, writeFile, rename, readdir, lstat, rm, open } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const packPattern = /^xhs-offline-\d{8}T\d{6}-[a-f0-9]{8}$/;
export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function atomicJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { flag: 'wx' });
  try { await rename(temp, file); } catch (error) { await rm(temp, { force: true }); throw error; }
}
export async function noSymlink(file) {
  const stat = await lstat(file);
  if (stat.isSymbolicLink()) throw new Error(`拒绝使用符号链接：${file}`);
  return stat;
}
export class Store {
  constructor(root) { this.root = path.resolve(root); this.packs = path.join(this.root, 'packs'); }
  async init() {
    await mkdir(this.root, { recursive: true }); await noSymlink(this.root);
    await mkdir(this.packs, { recursive: true }); await noSymlink(this.packs);
    await writeFile(path.join(this.root, '.xhs-offline'), 'XHS Offline Skill data v1\n');
  }
  packPath(id) {
    if (!packPattern.test(id)) throw new Error('无效的 Pack ID');
    const result = path.resolve(this.packs, id);
    if (path.dirname(result) !== this.packs) throw new Error('Pack 路径越界');
    return result;
  }
  async get(id) {
    const dir = this.packPath(id); await noSymlink(dir); await noSymlink(path.join(dir, 'manifest.json'));
    const pack = await readJson(path.join(dir, 'manifest.json'));
    if (pack.id !== id || pack.schemaVersion !== 1) throw new Error('Pack 格式不正确');
    return pack;
  }
  async list() {
    await this.init();
    const names = await readdir(this.packs);
    const packs = [];
    for (const name of names.filter(n => packPattern.test(n))) packs.push(await this.get(name));
    return packs.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async seen() {
    const history = await readJson(path.join(this.root, 'history.json'), []);
    const seen = new Set(history.map(item => `${item.source}:${item.feedId}`));
    // Recover dedup knowledge if a process stopped before history.json was committed.
    for (const pack of await this.list()) {
      const feed = await readJson(path.join(this.packPath(pack.id), 'feed.json'), []);
      for (const item of feed) seen.add(`${item.source}:${item.id}`);
    }
    return seen;
  }
  async addHistory(items, packId) {
    const file = path.join(this.root, 'history.json');
    const history = await readJson(file, []);
    const keys = new Set(history.map(h => `${h.source}:${h.feedId}`));
    for (const item of items) {
      const key = `${item.source}:${item.id}`;
      if (!keys.has(key)) { history.push({ source: item.source, feedId: item.id, cachedAt: item.cachedAt, packId }); keys.add(key); }
    }
    await atomicJson(file, history);
  }
  async withLock(work) {
    await this.init();
    const file = path.join(this.root, '.offline.lock');
    let handle;
    try { handle = await open(file, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('另一个离线操作正在执行；如上次异常中断，请按 README 处理锁文件'); throw error; }
    try { await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await work(); }
    finally { await handle.close(); await rm(file, { force: true }); }
  }
  async clear(id, { all = false, resetHistory = false } = {}) {
    return this.withLock(async () => {
      if (!all && !id) throw new Error('请指定 Pack ID 或 all');
      if (resetHistory && !all) throw new Error('只有清理全部时才能重置历史');
      const packs = all ? await this.list() : [await this.get(id)];
      for (const pack of packs) {
        const dir = this.packPath(pack.id); await this.get(pack.id);
        await rm(dir, { recursive: true });
      }
      if (resetHistory) {
        await atomicJson(path.join(this.root, 'history.json'), []);
      }
      return { deleted: packs.map(p => p.id), historyRetained: !resetHistory, note: '已导出的副本不受影响' };
    });
  }
}
