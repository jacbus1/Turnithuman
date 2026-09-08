import { expect, test } from '@playwright/test';

test('captures the documentation screenshot', async ({ page }, testInfo) => {
  test.skip(!process.env.CAPTURE_DOCS || testInfo.project.name !== 'desktop-chromium');
  await page.addInitScript(() => { window.__TURNITHUMAN_TEST_MODEL__ = true; });
  await page.goto('./');
  await page.getByLabel('Text to analyze').fill('人工智慧工具能協助我整理訪談紀錄，但我仍需要回到原始錄音核對語氣與上下文。\n\n在九月二日的課堂測試中，我記錄了三次錯誤分類；這些具體例子讓我決定把偵測分數只當成寫作訊號，而不是作者身分的證明。');
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('82%').first()).toBeVisible();
  await page.screenshot({ path: 'output/playwright/turnithuman-analysis.png', fullPage: true });
});
