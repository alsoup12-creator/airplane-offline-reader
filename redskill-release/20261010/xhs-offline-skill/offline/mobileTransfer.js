import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { qrcode } from '../vendor/qrcode.js';
import { portableDocument } from './exporter.js';

export function lanAddresses() {
  return [...new Set(Object.values(networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal &&
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map(n => n.address))];
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export async function startMobileTransfer(store, id, { hostIp, port = 0, ttlMinutes = 30 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('port 必须为 0 到 65535 的整数');
  if (!Number.isFinite(ttlMinutes) || ttlMinutes < .01 || ttlMinutes > 120) throw new Error('传输有效期必须在 0.01 到 120 分钟之间');
  const addresses = lanAddresses();
  if (hostIp && !addresses.includes(hostIp)) throw new Error('host-ip 必须是本机当前的局域网 IPv4 地址');
  if (!addresses.length) throw new Error('没有可用局域网地址，请先连接 Wi-Fi 或手机热点');
  const selected = hostIp ? [hostIp] : addresses;
  const { html, pack, fileName } = await store.withLock(() => portableDocument(store, id));
  const token = randomBytes(24).toString('hex'), prefix = `/receive/${token}`;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60000).toISOString();
  let urls = [], timer;
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'");
    if (Date.now() >= Date.parse(expiresAt)) { res.writeHead(410); res.end('传输已结束'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const route = req.url;
    let body, mime = 'text/html; charset=utf-8';
    if (route === `${prefix}/download`) {
      body = html; res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    } else if (route === `${prefix}/preview`) body = html;
    else if (route === prefix || route === `${prefix}/`) {
      const choices = urls.map((url, i) => `<figure><img width="248" height="248" src="${prefix}/qr/${i}" alt="手机接收二维码"><figcaption>${escapeHtml(url)}</figcaption></figure>`).join('');
      body = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>把阅读包带到手机</title><style>body{font:16px/1.8 system-ui,sans-serif;max-width:620px;margin:32px auto;padding:0 20px;color:#293c33;background:#f2f0e9}a{color:#294b3d}figure{margin:24px 0}figcaption{overflow-wrap:anywhere;font-size:12px}img{background:white}.download{display:inline-block;padding:12px 20px;border-radius:8px;background:#294b3d;color:white}</style><h1>把阅读包带到手机</h1><p>${pack.mode === 'mock' ? '演示内容 · ' : ''}${pack.itemCount} 条笔记，含已缓存评论与图片。</p><p>手机与电脑连接同一 Wi-Fi 或手机热点，扫码后点下载。电脑需保持此传输开启。</p>${choices}<a class="download" href="${prefix}/download" download="${fileName}">下载离线阅读文件</a><p><a href="${prefix}/preview">先预览内容</a></p><ol><li>下载完成后，在手机“下载”目录打开 HTML 文件。</li><li>正文、图片和已缓存评论都在这一个文件内，无需解压。</li><li>开飞行模式，关闭页面后重新打开下载的文件，确认图片、翻页和评论可用。</li></ol><p>预览页面依赖电脑连接，下载保存的文件才用于离线阅读。手机本地网页打开能力需要在实际设备确认。</p><p>传输到期：${escapeHtml(new Date(expiresAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))}（北京时间）；可在电脑按 Ctrl+C 提前结束。</p></html>`;
    } else if (/^\d+$/.test(route?.slice(`${prefix}/qr/`.length)) && route.startsWith(`${prefix}/qr/`)) {
      const index = Number(route.slice(`${prefix}/qr/`.length));
      if (!urls[index]) { res.writeHead(404); res.end(); return; }
      const qr = qrcode(0, 'M'); qr.addData(urls[index]); qr.make();
      body = qr.createSvgTag({ cellSize: 5, margin: 20, scalable: true }); mime = 'image/svg+xml';
    } else { res.writeHead(404); res.end('未找到接收入口'); return; }
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', resolve); });
  const actualPort = server.address().port;
  urls = selected.map(ip => `http://${ip}:${actualPort}${prefix}`);
  const close = () => new Promise(resolve => { clearTimeout(timer); server.close(resolve); server.closeAllConnections(); });
  timer = setTimeout(() => { void close(); }, ttlMinutes * 60000);
  server.once('close', () => clearTimeout(timer));
  return { server, close, urls, desktopUrl: `http://127.0.0.1:${actualPort}${prefix}`, expiresAt, fileName, sizeBytes: Buffer.byteLength(html) };
}
