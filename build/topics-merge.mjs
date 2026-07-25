// synthesize workflow 里每个话题 agent 各自把自己那篇写到 data/topics/<slug>.json，
// 这一步把 20 篇单篇合并成 data/topics.json —— build/shard.mjs 依赖的就是这个合并产物。
// （合并逻辑此前只存在于计划文档里，没进仓库，换台机器重跑 shard 必然缺文件。）
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../scraper/lib/progress.mjs';

const topicsDir = join(DATA_DIR, 'topics');
const outPath = join(DATA_DIR, 'topics.json');

if (!existsSync(topicsDir)) {
  console.error(`缺少 ${topicsDir}，请先跑 workflows/synthesize.workflow.js 生成各话题综述`);
  process.exit(1);
}

const files = readdirSync(topicsDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error(`${topicsDir} 里没有 .json 单篇，请先跑 workflows/synthesize.workflow.js`);
  process.exit(1);
}

const all = files.map((f) => JSON.parse(readFileSync(join(topicsDir, f), 'utf8')));
const json = JSON.stringify(all);
writeFileSync(outPath, json);

const kb = (Buffer.byteLength(json) / 1024).toFixed(1);
console.log(`合并 ${all.length} 篇话题综述 → ${outPath}（${kb} KB）`);
