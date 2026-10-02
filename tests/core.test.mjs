import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, access, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { estimateReadSeconds } from '../xhs-offline-skill/offline/durationEstimator.mjs';
import { createOfflineModule } from '../xhs-offline-skill/offline/index.mjs';
import { MockXhsAdapter } from '../xhs-offline-skill/adapters/mockXhsAdapter.mjs';
import { XhsAdapter } from '../xhs-offline-skill/adapters/xhsAdapter.mjs';
import { Store } from '../xhs-offline-skill/offline/storage.mjs';
import { directoryBytes, safeJson } from '../xhs-offline-skill/offline/exporter.mjs';
import { validateImageUrl } from '../xhs-offline-skill/offline/cacheManager.mjs';
import { mapLimit, request } from '../xhs-offline-skill/offline/network.mjs';
async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xhs-offline-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, module: createOfflineModule({ dataDir: root, adapter: new MockXhsAdapter(options) }) };
}
for (const [label, text, images, expected] of [
  ['empty', '', 0, 30], ['short', '短文', 1, 30], ['450 chars six images', '文'.repeat(450), 6, 111],
  ['one image', '文'.repeat(350), 1, 73], ['no image', '文'.repeat(350), 0, 68],
  ['long capped', '文'.repeat(10000), 12, 300], ['unicode code points', '😀'.repeat(350), 0, 68],
]) test(`duration: ${label}`, () => assert.equal(estimateReadSeconds({ text, remoteImages: Array(images).fill('x') }), expected));

test('60 minutes includes 25% reserve, local assets, exact byte count and survives reload', async t => {
  const { root, module } = await fixture(t, { failures: false });
  const pack = await module.prepare_offline({ targetMinutes: 60 });
  assert.equal(pack.status, 'ready'); assert.ok(pack.estimatedMinutes >= 75);
  assert.ok(pack.itemCount <= 300); assert.equal(pack.sizeBytes, await directoryBytes(pack.directory));
  const feed = JSON.parse(await readFile(path.join(pack.directory, 'feed.json')));
  for (const item of feed) { assert.equal(item.remoteImages.length, item.localImages.length); for (const img of item.localImages) await access(path.join(pack.directory,img)); }
  const reopened = createOfflineModule({ dataDir: root });
  assert.equal((await reopened.list_offline_packs())[0].id, pack.id);
  assert.equal((await reopened.offline_status()).itemCount, pack.itemCount);
});
test('30, 120 and 240 minute packs reach their distinct reserve targets', async t => {
  const { module } = await fixture(t, { failures: false, total: 1200 });
  for (const targetMinutes of [30, 120, 240]) { const pack = await module.prepare_offline({ targetMinutes }); assert.equal(pack.status, 'ready'); assert.ok(pack.estimatedMinutes >= targetMinutes * 1.25); }
});
test('dedup within one page and across packs, including after deletion', async t => {
  const { root } = await fixture(t); const adapter = new MockXhsAdapter({ total: 10, failures: false });
  const original = adapter.listFeeds.bind(adapter); adapter.listFeeds = async c => { const p = await original(c); return { ...p, items: [...p.items,...p.items] }; };
  const module = createOfflineModule({ dataDir: root, adapter });
  const first = await module.prepare_offline({ targetMinutes: 100 }); assert.equal(first.itemCount, 10);
  await module.clear_offline({ packId: first.id });
  const second = await module.prepare_offline({ targetMinutes: 1 }); assert.equal(second.itemCount, 0); assert.equal(second.status, 'failed');
  const third = await module.prepare_offline({ targetMinutes: 1, allowSeenContent: true }); assert.equal(third.status, 'ready');
});
test('source exhaustion and media failures remain readable partial packs', async t => {
  const { module } = await fixture(t, { total: 30 });
  const pack = await module.prepare_offline({ targetMinutes: 240 });
  assert.equal(pack.status, 'partial'); assert.equal(pack.itemCount, 30); assert.equal(pack.failedImages, 1);
  const feed = JSON.parse(await readFile(path.join(pack.directory, 'feed.json')));
  assert.equal(feed[22].localImages[0], 'assets/placeholder.svg');
  assert.equal(feed[25].localImages.length, 0); assert.equal(feed[27].localImages.length, 12);
  assert.ok(pack.issues.some(x => x.includes('不足'))); await access(pack.viewer);
});
test('repeated cursors and detail failures are bounded', async t => {
  const { root } = await fixture(t); let calls = 0; let details = 0;
  const adapter = { mode: 'mock', listFeeds: async () => { calls++; return { items: [{ source: 'xiaohongshu', id: 'bad' }], nextCursor: 'same' }; }, getFeedDetail: async () => { details++; throw Error('fail'); } };
  const pack = await createOfflineModule({ dataDir: root, adapter }).prepare_offline({ targetMinutes: 60 });
  assert.equal(calls, 2); assert.equal(details, 1); assert.equal(pack.status, 'failed');
});
test('maxItems, maxPages and media budget bound work', async t => {
  const { module } = await fixture(t, { failures: false });
  const p = await module.prepare_offline({ targetMinutes: 240, maxItems: 2, maxBytes: 1024 });
  assert.equal(p.itemCount, 2); assert.equal(p.status, 'partial'); assert.ok(p.failedImages > 0);
  const q = await module.prepare_offline({ targetMinutes: 240, maxPages: 1 }); assert.ok(q.itemCount <= 20);
});
test('invalid parameters fail without creating a pack', async t => {
  const { module } = await fixture(t);
  for (const options of [{ targetMinutes: NaN }, { targetMinutes: 0 }, { targetMinutes: 1, maxItems: 301 }, { targetMinutes: 1, reserveRatio: .5 }]) await assert.rejects(module.prepare_offline(options));
  assert.equal((await module.list_offline_packs()).length, 0);
});
test('export copies a self-contained pack and prevents overwrite', async t => {
  const { module, root } = await fixture(t, { total: 30 });
  const p = await module.prepare_offline({ targetMinutes: 100 }); const output = path.join(root, 'export-test');
  const result = await module.export_offline({ packId: p.id, output });
  for (const file of ['index.html','feed.json','manifest.json','assets']) await access(path.join(output,file));
  assert.ok((await readFile(result.viewer,'utf8')).includes('application/json'));
  assert.ok(!(await readFile(result.viewer,'utf8')).includes('fetch('));
  await assert.rejects(module.export_offline({ packId: p.id, output }));
  await module.clear_offline({ packId: p.id }); await access(result.viewer);
});
test('clear validates before deleting and resets history only explicitly', async t => {
  const { module, root } = await fixture(t); const p = await module.prepare_offline({ targetMinutes: 1 });
  await assert.rejects(module.clear_offline({ packId: p.id, resetHistory: true })); await access(p.viewer);
  await assert.rejects(module.clear_offline({ packId: '../../' }));
  await module.clear_offline({ all: true, resetHistory: true });
  assert.equal((await module.list_offline_packs()).length,0); assert.deepEqual(JSON.parse(await readFile(path.join(root,'history.json'))), []);
});
test('lock rejects concurrent mutation and is released on failure', async t => {
  const { root } = await fixture(t); const store = new Store(root);
  await store.withLock(async () => { await assert.rejects(store.withLock(async () => {}), /另一个/); });
  await assert.rejects(store.withLock(async () => { throw Error('expected'); }));
  await store.withLock(async () => {});
});
test('media host allowlist rejects local addresses, credentials and hostile suffix', () => {
  for (const url of ['http://127.0.0.1/a','file:///secret','https://xhscdn.com.evil.test/a','https://user:pass@a.xhscdn.com/a','https://a.xhscdn.com:123/a']) assert.throws(() => validateImageUrl(url));
  assert.equal(validateImageUrl('http://sns-img.xhscdn.com/a'), 'https://sns-img.xhscdn.com/a');
});
test('embedded data cannot close the script element', () => {
  const input = { text: '</script><script>alert(1)</script> & <img>' }; const encoded = safeJson(input);
  assert.ok(!encoded.includes('<')); assert.deepEqual(JSON.parse(encoded),input);
});
test('limited concurrency is enforced and preserves ordering', async () => {
  let active = 0, max = 0;
  const result = await mapLimit([1,2,3,4,5,6], 2, async n => { active++; max = Math.max(active,max); await new Promise(r => setTimeout(r,5)); active--; return n * 2; });
  assert.equal(max,2); assert.deepEqual(result,[2,4,6,8,10,12]);
});
test('MCP contract normalizes responses, skips video, preserves token and has no invented pagination', async () => {
  const calls = [];
  const adapter = new XhsAdapter({ callTool: async (name,args) => { calls.push({ name,args }); const data = name === 'list_feeds' ? { feeds: [{ id:'n1',xsecToken:'test-token',noteCard:{type:'normal'} }, { id:'v1',noteCard:{type:'video'} }] } : { note:{noteId:'n1',type:'normal',desc:'正文',title:'标题',user:{nickname:'作者'},imageList:[{urlDefault:'https://a.xhscdn.com/1'}],interactInfo:{likedCount:'1.2万'}} }; return { content:[{type:'text',text:JSON.stringify({success:true,data})}] }; } });
  const page = await adapter.listFeeds(); assert.equal(page.items.length,1); assert.equal(page.nextCursor,undefined);
  const item = await adapter.getFeedDetail(page.items[0]); assert.equal(item.stats.likes,12000); assert.equal(item.author.name,'作者');
  assert.equal(calls[1].args.xsec_token,'test-token'); assert.equal(calls[1].args.load_all_comments,false);
  assert.ok(!JSON.stringify(item).includes('test-token'));
});
test('REST adapter calls only documented local read endpoints', async t => {
  const received = [];
  const server = createServer((req,res) => { received.push([req.method,req.url]); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({success:true,data:req.method === 'GET' ? {feeds:[{id:'a',noteCard:{type:'normal'}}]} : {data:{note:{noteId:'a',type:'normal',desc:'text',imageList:[]}}}})); });
  await new Promise(r => server.listen(0,'127.0.0.1',r)); t.after(() => server.close());
  const adapter = new XhsAdapter({baseUrl:`http://127.0.0.1:${server.address().port}`}); const page = await adapter.listFeeds(); await adapter.getFeedDetail(page.items[0]);
  assert.deepEqual(received,[['GET','/api/v1/feeds/list'],['POST','/api/v1/feeds/detail']]);
});
test('network requests retry server failures, time out, and cap response bytes', async t => {
  let calls = 0;
  const server = createServer((req,res) => { calls++; if(req.url === '/slow') return; if(req.url === '/big') return res.end('a'.repeat(100)); res.statusCode = calls < 3 ? 503 : 200; res.end('ok'); });
  await new Promise(r => server.listen(0,'127.0.0.1',r)); t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await request(base)).bytes.toString(),'ok'); assert.equal(calls,3);
  await assert.rejects(request(`${base}/slow`,{}, {timeout:30,retries:0}));
  await assert.rejects(request(`${base}/big`,{}, {maxBytes:10,retries:0}));
});
