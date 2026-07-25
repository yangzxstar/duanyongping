import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// 刻意不从 browser.mjs 引入路径：normalize/stats 等离线脚本要能在不加载 Playwright 的情况下用本模块
const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, '..', '..');

export const DATA_DIR = join(PROJECT_ROOT, 'data');
export const RAW_DIR = join(DATA_DIR, 'raw');
export const META_PATH = join(DATA_DIR, 'meta.json');

export function ensureDirs() {
  mkdirSync(RAW_DIR, { recursive: true });
}

export function pagePath(n) {
  return join(RAW_DIR, `page-${String(n).padStart(4, '0')}.json`);
}

export function readMeta() {
  if (!existsSync(META_PATH)) {
    return {
      started_at: null,
      updated_at: null,
      total: null,
      maxPage: null,
      done_pages: [],
      failures: [],
    };
  }
  return JSON.parse(readFileSync(META_PATH, 'utf8'));
}

export function writeMeta(meta) {
  ensureDirs();
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
}

export function donePagesOnDisk() {
  if (!existsSync(RAW_DIR)) return new Set();
  const s = new Set();
  for (const f of readdirSync(RAW_DIR)) {
    const m = /^page-(\d{4})\.json$/.exec(f);
    if (m) s.add(Number(m[1]));
  }
  return s;
}
