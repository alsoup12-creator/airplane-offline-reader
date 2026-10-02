import { Store } from './storage.js';
import { preparePack } from './packBuilder.js';
import { exportPack } from './exporter.js';
export function createOfflineModule({ dataDir, adapter, onProgress }) {
  const store = new Store(dataDir);
  return {
    prepare_offline: options => {
      if (!adapter) throw new Error('准备内容需要 FeedAdapter');
      return preparePack(store, adapter, options, onProgress);
    },
    list_offline_packs: () => store.list(),
    offline_status: async () => {
      const packs = await store.list(); const usable = packs.filter(p => p.status === 'ready' || p.status === 'partial');
      return { packCount: packs.length, itemCount: usable.reduce((n,p) => n + p.itemCount, 0), estimatedMinutes: usable.reduce((n,p) => n + p.estimatedMinutes, 0), sizeBytes: packs.reduce((n,p) => n + p.sizeBytes, 0), latest: packs[0] ?? null, note: '按包累计，未扣除已读内容；允许重复时会重复计数' };
    },
    clear_offline: ({ packId, all = false, resetHistory = false }) => store.clear(packId, { all, resetHistory }),
    export_offline: ({ packId, output }) => exportPack(store, packId, output),
  };
}
