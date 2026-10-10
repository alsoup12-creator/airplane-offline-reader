import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createOfflineModule } from '../xhs-offline-skill/offline/index.mjs';
import { MockXhsAdapter } from '../xhs-offline-skill/adapters/mockXhsAdapter.mjs';
import { normalizeDetail, normalizeComments, XhsAdapter } from '../xhs-offline-skill/adapters/xhsAdapter.mjs';
import { lanAddresses } from '../xhs-offline-skill/offline/mobileTransfer.mjs';
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xhs-mobile-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const module = createOfflineModule({ dataDir: root, adapter: new MockXhsAdapter({ failures: false, total: 2 }) });
  const pack = await module.prepare_offline({ targetMinutes: .1 });
  return { root, module, pack };
}
const comment = (id, rest = {}) => ({ id, content: '评论原文', userInfo: { nickname: '读者' }, likeCount: '3', ...rest });
test('real detail preserves comments and replies and reports partial snapshots', async () => {
  const note = { type: 'normal', noteId: 'one', title: '标题', interactInfo: { commentCount: '20' } };
  const raw = { success: true, data: { data: { note, comments: { list: [comment('a', { subCommentCount: '2', subComments: [comment('reply')] })], hasMore: true } } } };
  let called;
  const item = await new XhsAdapter({ callTool: async (name, args) => { called = { name, args }; return raw; } }).getFeedDetail({ id: 'one' });
  assert.equal(called.name, 'get_feed_detail'); assert.equal(called.args.load_all_comments, false);
  assert.equal(item.comments[0].replies[0].text, '评论原文'); assert.equal(item.commentSnapshot.cachedCount, 2);
  assert.equal(item.commentSnapshot.status, 'partial'); assert.equal(item.commentSnapshot.total, 20);
  assert.equal(normalizeDetail({ note }, { id: 'one' }).commentSnapshot.status, 'unavailable');
  assert.equal(normalizeComments({ list: [], hasMore: false }, 0).commentSnapshot.status, 'complete');
  assert.equal(normalizeComments({ list: [] }, 0).commentSnapshot.status, 'partial');
});
test('comment snapshot is bounded, deduplicated and omits tokens and remote metadata', () => {
  const raw = { list: Array.from({ length: 250 }, (_, i) => comment(String(i), { xsecToken: 'secret', content: 'x'.repeat(10001) })), hasMore: false };
  const result = normalizeComments(raw, 250);
  assert.equal(result.comments.length, 200); assert.equal(result.comments[0].text.length, 10000);
  assert.equal(result.commentSnapshot.status, 'partial'); assert.ok(!JSON.stringify(result).includes('secret'));
  assert.equal(normalizeComments({ list: [comment('a'), comment('a')], hasMore: false }, 1).comments.length, 1);
});
test('single HTML contains images, comments, script-safe JSON and cannot overwrite exports', async t => {
  const { root, module, pack } = await fixture(t);
  const target = path.join(root, 'phone.html');
  const exported = await module.export_offline({ packId: pack.id, output: target, singleFile: true });
  const html = await readFile(target, 'utf8');
  const data = JSON.parse(html.match(/<script id="offline-data" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.ok(data.embeddedAssets[data.feed[0].localImages[0]].startsWith('data:image/svg+xml;base64,'));
  assert.equal(data.feed[0].comments[0].replies.length, 1); assert.equal(exported.singleFile, true);
  await assert.rejects(module.export_offline({ packId: pack.id, output: target, singleFile: true }), /EEXIST/);
  await module.clear_offline({ packId: pack.id });
  assert.equal(await readFile(target, 'utf8'), html);
});
test('mobile transfer serves only token routes with QR and downloadable self-contained HTML', async t => {
  const addresses = lanAddresses();
  if (!addresses.length) { t.skip('No LAN interface'); return; }
  const { module, pack } = await fixture(t);
  const transfer = await module.share_offline({ packId: pack.id, hostIp: addresses[0] });
  t.after(() => transfer.close());
  const entry = await fetch(transfer.desktopUrl); assert.equal(entry.status, 200);
  assert.ok((await entry.text()).includes('下载离线阅读文件'));
  const qr = await fetch(`${transfer.desktopUrl}/qr/0`); assert.equal(qr.headers.get('content-type'), 'image/svg+xml');
  assert.ok((await qr.text()).includes('<svg'));
  const download = await fetch(`${transfer.desktopUrl}/download`);
  assert.ok(download.headers.get('content-disposition').includes('attachment'));
  assert.ok((await download.text()).includes('embeddedAssets'));
  assert.equal((await fetch(new URL('/feed.json', transfer.desktopUrl))).status, 404);
  assert.equal((await fetch(`${transfer.desktopUrl}/../manifest.json`)).status, 404);
  assert.equal((await fetch(`${transfer.desktopUrl}/download`, { method: 'POST' })).status, 405);
  await assert.rejects(module.share_offline({ packId: pack.id, hostIp: '8.8.8.8' }), /局域网/);
});
test('transfer shuts down at expiry', async t => {
  if (!lanAddresses().length) { t.skip('No LAN interface'); return; }
  const { module, pack } = await fixture(t);
  const transfer = await module.share_offline({ packId: pack.id, ttlMinutes: .01 });
  await new Promise(resolve => transfer.server.once('close', resolve));
  assert.equal(transfer.server.listening, false);
  await assert.rejects(fetch(transfer.desktopUrl));
});
test('prepare and deliver exposes a portable artifact, coverage and pending attachment truthfully', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xhs-delivery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const offline = createOfflineModule({ dataDir: path.join(root, 'data'), adapter: new MockXhsAdapter({ total: 2, failures: false }) });
  const result = await offline.prepare_and_deliver({ targetMinutes: 30, output: path.join(root, 'trip.html'), delivery: 'attachment' });
  assert.equal(result.status, 'partial'); assert.equal(result.artifact.mode, 'mock');
  assert.equal(result.artifact.delivery.status, 'awaiting_host_transfer'); assert.equal(result.artifact.delivery.savedOnPhone, false);
  assert.equal(result.artifact.comments.cachedCount, 4); assert.equal(result.artifact.comments.completeNotes, 2);
  const html = await readFile(result.artifact.viewer);
  assert.equal(result.artifact.sha256, createHash('sha256').update(html).digest('hex'));
  await offline.clear_offline({ packId: result.id });
  assert.deepEqual(await readFile(result.artifact.viewer), html);
});
test('delivery failure preserves prepared inventory and can retry without an adapter', async t => {
  const { root, module } = await fixture(t);
  const result = await module.prepare_and_deliver({ targetMinutes: .1, output: path.join(root, 'wrong-extension.txt') });
  assert.equal(result.delivery.status, 'failed'); assert.equal((await module.list_offline_packs()).length, 2);
  const readerOnly = createOfflineModule({ dataDir: root });
  const artifact = await readerOnly.deliver_offline({ packId: result.id, output: path.join(root, 'retry.html') });
  assert.equal(artifact.delivery.status, 'file_created'); assert.equal(artifact.itemCount, 1);
  await assert.rejects(module.prepare_and_deliver({ targetMinutes: .1, delivery: 'public-url' }), /delivery/);
  assert.equal((await module.list_offline_packs()).length, 2);
  await assert.rejects(readerOnly.deliver_offline({ packId: result.id, output: artifact.viewer }), /EEXIST/);
});
test('CLI defaults to real source and does not generate demo content when the source is empty', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xhs-cli-real-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ success: true, data: { feeds: [] } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const script = fileURLToPath(new URL('../xhs-offline-skill/scripts/offline.mjs', import.meta.url));
  let failure;
  try { await promisify(execFile)(process.execPath, [script, 'prepare_and_deliver', '--target-minutes', '1', '--data-dir', root,
    '--mcp-url', `http://127.0.0.1:${server.address().port}`, '--quiet']); } catch (error) { failure = error; }
  assert.equal(failure?.code, 2);
  const result = JSON.parse(failure.stdout);
  assert.equal(result.mode, 'xhs'); assert.equal(result.itemCount, 0); assert.equal(result.delivery.status, 'not_created');
});
