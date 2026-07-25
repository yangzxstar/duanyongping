# 段永平雪球发言全集

抓取并规整雪球用户「大道无形我有型」（段永平，user_id 1247347556）的全部公开发言。

## 前置：一次性登录

雪球匿名访客只能看到第 1 页，抓全部历史**必须登录**。

```bash
bun install
bun run login     # 打开浏览器，扫码登录，成功后自动退出
```

也可以用环境变量自动填表登录（凭据只在环境变量里传递，不落盘）。
**推荐短信验证码登录：实测不会弹 GeeTest 滑块，无需人工拖动。**

```bash
# 1. 发送验证码到手机
XUEQIU_PHONE=手机号 bun run login --send-sms

# 2. 收到后用验证码登录
XUEQIU_PHONE=手机号 XUEQIU_SMS_CODE=收到的六位码 bun run login
```

密码登录也支持，但雪球会弹「拖动滑块完成拼图」的人机验证，需要人工拖一次：

```bash
XUEQIU_PHONE=手机号 XUEQIU_PASSWORD=密码 bun run login
```

会话保存在 `scraper/.profile/`（已 gitignore，含账号 cookie，请勿提交或外传）。
cookie 过期后重新执行 `bun run login` 即可。

## 抓取与规整

```bash
bun run scrape      # 逐页抓取，落盘 data/raw/page-NNNN.json，可中断续抓
bun run merge       # 合并去重 → data/statuses.json
bun run backfill    # 补抓被截断的长文全文
bun run normalize   # 规整 → data/normalized.json
bun run stats       # 打印数据集统计概览
bun run scrape -- --since-latest   # 增量：只补全量抓取之后的新发言
```

全量抓完一次后，日常更新用 `bun run scrape -- --since-latest`：它从第 1 页往后抓，
遇到整页都是 `data/statuses.json` 里的已知发言就停止，然后重跑 `merge` / `normalize` 即可。

## 阶段 A：对话数据与 AI 综述

在抓取与规整（上面那节）跑完、`data/normalized.json` 就位之后，这一段把散落的发言
聚成对话、用 AI 逐场标注、按话题写综述，最后切成站点要用的分片数据。

完整命令链，**必须按顺序**：

```bash
bun run conversations    # normalized.json → data/conversations.json（发言聚成展示单元）
bun run enrich:prepare   # 切 130 批 → data/enrich/in/batch-NNN.json、data/enrich/empty-convs.json
# ⬇ 在 Claude Code 里跑 Workflow：workflows/enrich.workflow.js（逐批 AI 标注，写 data/enrich/out/）
bun run enrich:merge     # 合批 + 校验 → data/enriched.json、data/enrich-warnings.txt
# ⬇ 在 Claude Code 里跑 Workflow：workflows/synthesize.workflow.js（20 篇话题综述 + 总纲）
bun run topics:merge     # data/topics/*.json → data/topics.json
bun run shard            # → site/data/（index.json / convs/YYYY.json / topics/ / companies.json / overview.json）
bun run report           # 阶段 A 数据质量验收报告（终端打印）
```

### 两处 Workflow 步骤

`enrich` 与 `synthesize` 这两步要调 LLM，普通 `bun` 脚本调不了，**必须在 Claude Code
里用 Workflow 工具执行** `workflows/enrich.workflow.js` / `workflows/synthesize.workflow.js`。
两个 workflow 里的 agent 自己负责落盘（workflow 脚本本身没有文件系统权限）：

- `enrich.workflow.js` → 每批写 `data/enrich/out/batch-NNN.json`
- `synthesize.workflow.js` → 每个话题写 `data/topics/<slug>.json`，总纲写 `data/overview.json`

**Workflow 的 `args` 必须传对象，不能传 JSON 字符串。** 传字符串不会报错，而是被静默
忽略、回落到脚本里的默认值（于是"只跑 3 批试试"会变成把 130 批全跑一遍）：

```jsonc
// 对
{ "args": { "batches": [1, 2, 3] } }
// 错——会被静默忽略
{ "args": "{\"batches\":[1,2,3]}" }
```

### 断点续跑

- `enrich:merge` 会检查 130 批是否齐全，缺哪几批会直接列出来，补跑那几批即可。
- `topics:merge` 只是把 `data/topics/` 下的单篇合并成一个数组，重跑无副作用；
  目录不存在或为空会报错退出（说明 synthesize workflow 还没跑）。
- `data/` 与 `site/data/` 都不入版本库，换台机器要从 `bun run scrape` 起重跑整条链。

## 数据说明

内容为段永平在雪球的公开发言，版权归原作者。本仓库仅作个人研究归档，
规整记录保留原帖 URL，任何展示都应链回雪球原帖。

## 测试

```bash
bun test
```
