import { chromium } from 'playwright';

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 1000 } });
  await p.goto('http://localhost:3005/', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(900);

  // 1) 快速档按钮文案
  const quickBtn = await p.locator('button.btn').filter({ hasText: '生成' }).first().innerText();
  console.log('快速档按钮:', quickBtn);

  // 2) 切高质量档，看按钮与多选
  await p.locator('.tiercard:has-text("高质量")').click();
  await p.waitForTimeout(500);
  const proBtn = await p.locator('button.btn').filter({ hasText: '生成' }).first().innerText();
  console.log('高质量档按钮:', proBtn);
  const chip = await p.locator('.paybox .pill').allInnerTexts();
  console.log('张数选项:', chip.join(' | '));
  const disclaimer = await p.locator('.paybox .hint').first().innerText();
  console.log('不可退改提示:', disclaimer.replace(/\s+/g, ' ').slice(0, 80));

  await p.locator('.tiers').scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/AI123/wuliao/shot-tier3.png', clip: { x: 0, y: 330, width: 1100, height: 560 } });

  // 3) 切回快速，生成 4 张，选中后看「用这张出高质量版」
  await p.locator('.tiercard:has-text("快速")').click();
  await p.waitForTimeout(300);
  await p.locator('input[type="text"]').first().fill('银发猫耳少女，纯色背景');
  await p.locator('button.btn').filter({ hasText: '生成 4 张' }).first().click();
  await p.waitForTimeout(30000);
  const n = await p.locator('.pick').count();
  console.log('候选:', n);
  if (n > 0) {
    await p.locator('.pick').first().click();
    await p.waitForTimeout(5000);
    const upBtn = await p.locator('button:has-text("用这张出高质量版")').count();
    console.log('升级按钮:', upBtn);
    if (upBtn) {
      await p.locator('button:has-text("用这张出高质量版")').click();
      await p.waitForTimeout(1200);
      const refChip = await p.locator('button:has-text("已带参考图")').count();
      const amount = await p.locator('.paybox .total').first().innerText().catch(() => '-');
      console.log('参考图标记:', refChip, '| 金额:', amount);
      await p.locator('.paybox').scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
      await p.screenshot({ path: 'E:/AI123/wuliao/shot-upgrade.png', clip: { x: 0, y: 300, width: 1100, height: 620 } });
    }
  }
  await b.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
