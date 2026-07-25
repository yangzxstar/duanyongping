import { openContext, warmUp, isLoggedIn } from './lib/browser.mjs';

// 凭据只从环境变量读取，绝不写入仓库任何文件。三种模式：
//   XUEQIU_PHONE=... bun run login --send-sms        只发送短信验证码
//   XUEQIU_PHONE=... XUEQIU_SMS_CODE=... bun run login   用短信验证码登录（推荐：不弹滑块）
//   XUEQIU_PHONE=... XUEQIU_PASSWORD=... bun run login   密码登录（会弹 GeeTest 滑块，需人工拖）
// 都不设置时退回人工登录（扫码或手动输入）。
const PHONE = process.env.XUEQIU_PHONE || '';
const PASSWORD = process.env.XUEQIU_PASSWORD || '';
const SMS_CODE = process.env.XUEQIU_SMS_CODE || '';
const SEND_SMS_ONLY = process.argv.includes('--send-sms');
const SMS_MODE = Boolean(PHONE && (SMS_CODE || SEND_SMS_ONLY));
const AUTO = Boolean(PHONE && (PASSWORD || SMS_CODE || SEND_SMS_ONLY));

const TIMEOUT_MS = 15 * 60 * 1000;
const POLL_MS = 3000;

const { ctx, page } = await openContext({ headless: false });
await warmUp(page);

if (await isLoggedIn(page)) {
  console.log('✅ 已是登录状态，无需重复登录。');
  await ctx.close();
  process.exit(0);
}

// 「阅读并同意服务协议」不是标准 checkbox，而是自定义图标 <i>，
// 未勾选时 class 含 newLogin_nochecked。不勾选则点登录/发送验证码毫无反应。
async function tickAgreement() {
  const agree = page.locator('i[class*="newLogin_nochecked"]').first();
  if (await agree.count()) {
    await agree.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

// 短信验证码登录：实测不会弹 GeeTest 滑块，适合无人值守
async function trySmsLogin() {
  const tab = page.locator('a:has-text("验证码登录")').first();
  if (await tab.count()) {
    await tab.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const phoneBox = page.locator('input[name="telephone"]').first();
  if (!(await phoneBox.count())) return false;
  await phoneBox.fill(PHONE);
  await page.waitForTimeout(400);
  await tickAgreement();

  if (SEND_SMS_ONLY) {
    await page.locator('a:has-text("发送验证码")').first().click({ timeout: 8000 });
    await page.waitForTimeout(4000);
    console.log('📱 验证码已发送到 ' + PHONE.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'));
    console.log('   收到后运行：XUEQIU_PHONE=... XUEQIU_SMS_CODE=收到的码 bun run login');
    return true;
  }

  const codeBox = page.locator('input[placeholder*="验证码"]').first();
  if (!(await codeBox.count())) return false;
  await codeBox.fill(SMS_CODE);
  await page.waitForTimeout(400);
  await page.locator('[class*="newLogin_modal__login__btn"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(8000);
  return true;
}

async function tryPasswordLogin() {
  // 登录面板直接嵌在首页侧栏，切到「账号密码登录」页签即可
  const tab = page.locator('a:has-text("账号密码登录")').first();
  if (await tab.count()) {
    await tab.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const userBox = page.locator('input[name="username"]').first();
  const passBox = page.locator('input[name="password"]').first();
  if (!(await userBox.count()) || !(await passBox.count())) return false;

  await userBox.fill(PHONE);
  await page.waitForTimeout(400);
  await passBox.fill(PASSWORD);
  await page.waitForTimeout(400);

  // 「阅读并同意服务协议」不是标准 checkbox，而是个自定义图标 <i>，
  // 未勾选时 class 含 newLogin_nochecked。不勾选则点登录毫无反应。
  const agree = page.locator('i[class*="newLogin_nochecked"]').first();
  if (await agree.count()) {
    await agree.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // 提交按钮是个 div（class 形如 newLogin_modal__login__btn_xxx），不是 button，回车也不触发提交
  const submit = page.locator('[class*="newLogin_modal__login__btn"]').first();
  if (await submit.count()) {
    await submit.click({ timeout: 8000 }).catch(() => {});
  } else {
    await passBox.press('Enter');
  }
  await page.waitForTimeout(8000);
  return true;
}

if (SMS_MODE) {
  console.log(SEND_SMS_ONLY ? '发送短信验证码…' : '用短信验证码登录…');
  const filled = await trySmsLogin();
  if (!filled) console.log('未能定位验证码登录表单，请在浏览器窗口中手动完成登录。');
  if (SEND_SMS_ONLY) {
    await ctx.close();
    process.exit(0);
  }
  if (await isLoggedIn(page)) {
    console.log('✅ 短信验证码登录成功，会话已保存到 scraper/.profile/');
    await ctx.close();
    process.exit(0);
  }
  console.log('⚠ 验证码登录未成功（可能已过期或输错）。可在浏览器窗口中手动完成，或重新获取验证码。');
} else if (AUTO) {
  console.log('尝试用环境变量中的账号密码自动登录…');
  const filled = await tryPasswordLogin();
  if (!filled) console.log('未能定位登录表单，请在浏览器窗口中手动完成登录。');
  if (await isLoggedIn(page)) {
    console.log('✅ 自动登录成功，会话已保存到 scraper/.profile/');
    await ctx.close();
    process.exit(0);
  }
  console.log('');
  console.log('👉 表单已自动填好并提交，雪球弹出了「拖动滑块完成拼图」的人机验证。');
  console.log('   请在浏览器窗口里把滑块拖到拼图缺口处完成验证。');
  console.log('   提示：改用短信验证码登录不会弹滑块，见 README。');
  console.log('');
} else {
  console.log('请在打开的浏览器窗口中登录雪球（扫码或账号密码）。');
}

console.log('登录成功后本脚本会自动检测并退出，最多等待 15 分钟。');

const deadline = Date.now() + TIMEOUT_MS;
let ok = false;
while (Date.now() < deadline) {
  await page.waitForTimeout(POLL_MS);
  if (await isLoggedIn(page)) {
    ok = true;
    break;
  }
}

if (ok) {
  console.log('✅ 登录成功，会话已保存到 scraper/.profile/');
} else {
  console.log('❌ 超时未检测到登录状态。请重新运行 bun run login。');
}
await ctx.close();
process.exit(ok ? 0 : 1);
