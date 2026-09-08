import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__TURNITHUMAN_TEST_MODEL__ = true; });
  await page.goto('./');
});

test('pastes, analyzes, edits, re-analyzes, and clears writing', async ({ page }) => {
  const editor = page.getByLabel('Text to analyze');
  await editor.fill('This draft begins with a broad claim about technology. It then adds a concrete classroom example with a date, a person, and an observed result.\n\nThe second paragraph explains what remains uncertain and why that uncertainty matters to the conclusion.');
  await page.getByRole('button', { name: /開始分析|Analyze writing/ }).click();
  await expect(page.getByText(/82%/).first()).toBeVisible();
  await expect(page.getByText(/段落訊號|Segment signals/).first()).toBeVisible();

  await editor.fill('I revised this draft after reviewing my class notes from September 2. The example now identifies what I saw, what I could verify, and what still needs evidence.');
  await page.getByRole('button', { name: /重新分析修改稿|Analyze edited draft/ }).click();
  await expect(page.getByText(/82%/).first()).toBeVisible();

  await page.getByRole('button', { name: /清除|Clear/ }).click();
  await expect(editor).toHaveValue('');
  await expect(page.getByText(/分析會顯示在這裡|Your analysis will appear here/)).toBeVisible();
});

test('imports a local TXT file without sending it away', async ({ page }) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /匯入文件|Import file/ }).click();
  const fileChooser = await chooser;
  await fileChooser.setFiles({ name: 'fixture.txt', mimeType: 'text/plain', buffer: Buffer.from('A private local fixture with enough words to verify browser-side text import behavior safely.') });
  await expect(page.getByLabel('Text to analyze')).toHaveValue(/private local fixture/);
  await expect(page.getByText(/fixture.txt/)).toBeVisible();
});

test('supports keyboard focus and fits the mobile viewport', async ({ page }, testInfo) => {
  await page.getByLabel('Text to analyze').focus();
  await expect(page.getByLabel('Text to analyze')).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByRole('button', { name: /開始分析|Analyze writing/ })).toBeVisible();
  }
});
