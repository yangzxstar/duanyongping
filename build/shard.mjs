import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR } from '../scraper/lib/progress.mjs';
import { buildIndexEntry, buildYearShards, topicSlug, isFeatured } from './lib/shard.mjs';
import { COMPANY_KEYWORDS } from './lib/taxonomy.mjs';
import { CLEAN_STANCES } from './lib/validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_DATA = join(HERE, '..', 'site', 'data');

function need(name) {
  const p = join(DATA_DIR, name);
  if (!existsSync(p)) {
    console.error(`缺少 data/${name}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

const convs = need('conversations.json');
const enriched = need('enriched.json');
const topics = need('topics.json');
const overview = need('overview.json');

// 赞数前 10% 作为高赞阈值
const likes = convs.map((c) => c.stats.like).sort((a, b) => b - a);
const likeThreshold = likes[Math.floor(likes.length * 0.1)];

mkdirSync(join(SITE_DATA, 'convs'), { recursive: true });
mkdirSync(join(SITE_DATA, 'topics'), { recursive: true });

// 索引
const index = convs.map((c) => buildIndexEntry(c, enriched[c.id], likeThreshold));
writeFileSync(join(SITE_DATA, 'index.json'), JSON.stringify(index));

// 年份分片
const shards = buildYearShards(convs, enriched);
for (const [year, list] of shards) {
  writeFileSync(join(SITE_DATA, 'convs', `${year}.json`), JSON.stringify(list));
}

// 话题页：综述 + 该话题下的对话 id 列表
for (const t of topics) {
  const convIds = index.filter((e) => e.topics.includes(t.topic_path)).map((e) => e.id);
  writeFileSync(
    join(SITE_DATA, 'topics', `${topicSlug(t.topic_path)}.json`),
    JSON.stringify({ ...t, conv_ids: convIds })
  );
}

// 公司索引：按 stance 分区
const companies = {};
for (const c of convs) {
  for (const co of enriched[c.id]?.companies || []) {
    if (!companies[co.name]) {
      companies[co.name] = { name: co.name };
      for (const stance of CLEAN_STANCES) companies[co.name][stance] = [];
    }
    companies[co.name][co.stance].push(c.id);
  }
}
writeFileSync(join(SITE_DATA, 'companies.json'), JSON.stringify(companies));
writeFileSync(join(SITE_DATA, 'overview.json'), JSON.stringify(overview));

// 汇报
const featured = index.filter((e) => e.featured).length;
const idxMB = (Buffer.byteLength(JSON.stringify(index)) / 1024 / 1024).toFixed(2);
let shardMB = 0;
for (const [, list] of shards) shardMB += Buffer.byteLength(JSON.stringify(list));
console.log(`索引 ${index.length} 条，${idxMB} MB（精华 ${featured} 条，高赞阈值 ${likeThreshold}）`);
console.log(`年份分片 ${shards.size} 个，合计 ${(shardMB / 1024 / 1024).toFixed(1)} MB`);
console.log(`话题页 ${topics.length} 个，公司 ${Object.keys(companies).length} 家`);
console.log(`写入 ${SITE_DATA}`);
