import { Store } from './storage.js';
import { preparePack } from './packBuilder.js';
import { exportPack, exportPortable } from './exporter.js';
import { startMobileTransfer } from './mobileTransfer.js';
export function createOfflineModule({ dataDir, adapter, onProgress }) {
  const store = new Store(dataDir);
  function validateDelivery(delivery) {
    if (!['local-file', 'attachment'].includes(delivery)) throw new Error('delivery 只能为 local-file 或 attachment');
  }
  async function deliver({ packId, output, delivery = 'local-file' }) {
    validateDelivery(delivery);
    const artifact = await exportPortable(store, packId, output);
    return { ...artifact, delivery: { route: delivery, status: delivery === 'attachment' ? 'awaiting_host_transfer' : 'file_created',
      savedOnPhone: false, requiresAgentWhileReading: false,
      nextStep: delivery === 'attachment' ? '宿主使用真实附件工具发送 viewer 文件；发送成功后再报告已交付。远程磁盘路径不是手机可下载链接。' :
        '打开 viewer 文件阅读；若在手机本机运行，使用能执行本地 HTML 脚本的文件入口。电脑运行时仍需把文件传给手机。' } };
  }
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
    export_offline: ({ packId, output, singleFile = false }) => singleFile ? exportPortable(store, packId, output) : exportPack(store, packId, output),
    deliver_offline: deliver,
    prepare_and_deliver: async ({ output, delivery = 'local-file', ...options }) => {
      validateDelivery(delivery);
      if (!adapter) throw new Error('准备内容需要 FeedAdapter');
      const prepared = await preparePack(store, adapter, options, onProgress);
      if (prepared.status === 'failed') return { ...prepared, delivery: { status: 'not_created', savedOnPhone: false } };
      try { return { ...prepared, artifact: await deliver({ packId: prepared.id, output, delivery }) }; }
      catch (error) { return { ...prepared, delivery: { status: 'failed', savedOnPhone: false, error: error.message,
        nextStep: '原始缓存已保留。修正导出路径或缩小单文件大小后重新交付。' } }; }
    },
    share_offline: ({ packId, ...options }) => startMobileTransfer(store, packId, options),
  };
}
