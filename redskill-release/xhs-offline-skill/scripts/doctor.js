#!/usr/bin/env node
// Read-only preflight. Never installs software, opens a login flow or reads cookies.
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const major = Number(process.versions.node.split('.')[0]);
const minor = Number(process.versions.node.split('.')[1]);
const files = ['../offline/index.js', '../adapters/xhsAdapter.js', '../viewer/index.html', './offline.js'];
const missing = [];
for (const file of files) { try { await access(new URL(file, import.meta.url)); } catch { missing.push(file); } }
const base = process.env.XHS_MCP_URL ?? 'http://127.0.0.1:18060';
let endpoint = 'unreachable';
let detail = '本机小红书 MCP 未响应。需要先配置真实内容来源。';
try {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('MCP 地址必须为无凭据的本机地址');
  const response = await fetch(`${url.origin}/health`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
  endpoint = response.ok ? 'health_responded' : 'http_error';
  detail = response.ok ? '本机健康接口响应；尚未验证是否为预期 MCP、账号登录或推荐读取。' : `本机健康接口返回 HTTP ${response.status}`;
} catch (error) { if (error.message === 'MCP 地址必须为无凭据的本机地址') { endpoint = 'invalid_config'; detail = error.message; } }
console.log(JSON.stringify({
  runtimeDirectory: fileURLToPath(new URL('../', import.meta.url)),
  node: { version: process.versions.node, supported: major > 22 || major === 22 && minor >= 12 },
  files: { complete: missing.length === 0, missing },
  contentSource: { transport: 'local-rest', endpoint, detail, loginVerified: false, realFeedVerified: false },
  redSkill: { platformInstallationVerified: false, note: '本检查不证明已在 Red Skill 安装或发布。' },
  android: { deviceVerified: false, note: '需在安卓真机断网后重新打开离线附件验收。' },
}, null, 2));
if (missing.length || !(major > 22 || major === 22 && minor >= 12)) process.exitCode = 1;
