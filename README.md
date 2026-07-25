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

## 数据说明

内容为段永平在雪球的公开发言，版权归原作者。本仓库仅作个人研究归档，
规整记录保留原帖 URL，任何展示都应链回雪球原帖。

## 测试

```bash
bun test
```
