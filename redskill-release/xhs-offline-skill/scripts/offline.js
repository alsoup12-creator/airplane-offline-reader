#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createOfflineModule } from '../offline/index.js';
import { MockXhsAdapter } from '../adapters/mockXhsAdapter.js';
import { XhsAdapter } from '../adapters/xhsAdapter.js';
const help = `XHS Offline Skill（Node.js 22.12+，无需构建）
  prepare_offline --target-minutes 30 --adapter mock|xhs
  offline_status
  list_offline_packs
  export_offline --pack-id ID [--output DIRECTORY]
  clear_offline --pack-id ID
  clear_offline --all [--reset-history]

通用：--data-dir DIRECTORY（默认当前目录 data，或 XHS_OFFLINE_DATA_DIR）
准备：--reserve-ratio 1.25 --max-items 300 --max-pages 30 --allow-seen-content
      --max-mb 5120 --mcp-url http://127.0.0.1:18060 --quiet
Mock：30 种原创模板扩展成 300 条测试变体；默认包含故障样例。
      --mock-total 30 可只使用基础样例；--mock-no-failures 可关闭故障注入。
stdout 返回 JSON；stderr 显示进度。真实模式不会悄悄回退到 Mock。`;
try {
  const { values: v, positionals: [action] } = parseArgs({ allowPositionals: true, options: {
    'target-minutes': { type: 'string' }, 'reserve-ratio': { type: 'string', default: '1.25' },
    'max-items': { type: 'string', default: '300' }, 'max-pages': { type: 'string', default: '30' }, 'max-mb': { type: 'string', default: '5120' },
    'data-dir': { type: 'string', default: process.env.XHS_OFFLINE_DATA_DIR ?? 'data' },
    adapter: { type: 'string', default: 'mock' }, 'mcp-url': { type: 'string', default: process.env.XHS_MCP_URL ?? 'http://127.0.0.1:18060' },
    'pack-id': { type: 'string' }, output: { type: 'string' }, all: { type: 'boolean' },
    'reset-history': { type: 'boolean' }, 'allow-seen-content': { type: 'boolean' },
    'mock-total': { type: 'string', default: '300' }, 'mock-no-failures': { type: 'boolean' }, quiet: { type: 'boolean' }, help: { type: 'boolean' },
  }});
  if (v.help || !action) { console.log(help); process.exit(0); }
  if (!['mock', 'xhs'].includes(v.adapter)) throw new Error('adapter 只能为 mock 或 xhs');
  const total = Number(v['mock-total']);
  if (!Number.isInteger(total) || total < 1 || total > 3000) throw new Error('mock-total 必须为 1 到 3000 的整数');
  const adapter = v.adapter === 'xhs' ? new XhsAdapter({ baseUrl: v['mcp-url'] }) : new MockXhsAdapter({ total, failures: !v['mock-no-failures'] });
  const offline = createOfflineModule({ dataDir: path.resolve(v['data-dir']), adapter, onProgress: v.quiet ? undefined : p => {
    if (p.phase === 'feed') console.error(`Feed fetched: ${p.fetched} | page ${p.page}`);
    if (p.phase === 'details') console.error(`Detail loaded: ${p.items} | estimated ${Math.floor(p.estimatedSeconds / 60)} / ${Math.ceil(p.targetSeconds / 60)} min`);
    if (p.phase === 'media') console.error(`Images cached: item ${p.completed}/${p.planned} | ${p.sizeBytes} bytes | failed ${p.failedImages}`);
  }});
  let result;
  switch (action) {
    case 'prepare_offline': result = await offline.prepare_offline({ targetMinutes: Number(v['target-minutes']), reserveRatio: Number(v['reserve-ratio']), maxItems: Number(v['max-items']), maxPages: Number(v['max-pages']), maxBytes: Number(v['max-mb']) * 1024 ** 2, allowSeenContent: !!v['allow-seen-content'] }); break;
    case 'offline_status': result = await offline.offline_status(); break;
    case 'list_offline_packs': result = await offline.list_offline_packs(); break;
    case 'clear_offline': result = await offline.clear_offline({ packId: v['pack-id'], all: v.all, resetHistory: v['reset-history'] }); break;
    case 'export_offline': result = await offline.export_offline({ packId: v['pack-id'], output: v.output }); break;
    default: throw new Error(`未知动作：${action}；使用 --help 查看命令`);
  }
  console.log(JSON.stringify(result, null, 2));
  if (result?.status === 'failed') process.exitCode = 2;
} catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
