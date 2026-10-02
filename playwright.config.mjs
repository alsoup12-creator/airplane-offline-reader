import { defineConfig } from '@playwright/test';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('node_modules/.cache/ms-playwright');
export default defineConfig({ testDir: './tests/browser', timeout: 30000, workers: 1, use: { headless: true, viewport: { width: 1100, height: 1000 } }, reporter: 'list' });
