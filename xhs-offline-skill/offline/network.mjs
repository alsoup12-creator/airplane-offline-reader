import { setTimeout as delay } from 'node:timers/promises';
export async function request(url, init = {}, { timeout = 20000, retries = 2, maxBytes = 25 * 1024 ** 2 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeout) });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Error('响应超过大小上限'); }
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error('响应超过大小上限');
        chunks.push(chunk);
      }
      return { bytes: Buffer.concat(chunks), mime: response.headers.get('content-type')?.split(';')[0] ?? '' };
    } catch (error) {
      last = error;
      if (error.retryable === false || attempt === retries) break;
      await delay(150 * 2 ** attempt);
    }
  }
  throw last;
}
export async function jsonRequest(url, init, options) {
  const result = await request(url, init, options);
  return JSON.parse(result.bytes.toString('utf8'));
}
export async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const result = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; result[index] = await worker(items[index], index); }
  }));
  return result;
}
