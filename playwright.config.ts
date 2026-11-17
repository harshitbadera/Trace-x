import { defineConfig } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({
  testDir: './tests/ui',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5174',
    env: {
      PORT: '8001',
      VITE_PORT: '5174',
      TRACE_API_URL: 'http://127.0.0.1:8001',
      TRACE_DATA_DIR: mkdtempSync(join(tmpdir(), 'trace-x-browser-')),
    },
    reuseExistingServer: false,
    timeout: 120000,
  },
  reporter: 'list',
});
