#!/bin/sh
# 每日增量更新：抓雪球新发言并重建站点数据。
# 由 launchd 调度（~/Library/LaunchAgents/com.duanyongping.daily-update.plist）。
# AI 标注（enrich/synthesize）不在此列——新对话先以原文出站，
# 攒一批后在 Claude Code 里跑 workflows/enrich.workflow.js 补标注。
set -e
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
mkdir -p logs

{
  echo "== $(date '+%F %T') 开始增量更新"
  bun scraper/scrape.mjs --since-latest
  bun scraper/merge.mjs
  bun build/normalize.mjs
  bun build/conversations.mjs
  bun build/shard.mjs
  echo "== $(date '+%F %T') 完成"
} >> logs/daily-update.log 2>&1
