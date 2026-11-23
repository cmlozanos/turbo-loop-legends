import { expect, test } from '@playwright/test';
import { openGame, solveGate } from './learning-gate';
import { openAdultSettings, closeAdultSettings } from './family-v2';

const steps = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__turboRead().scene?.steps ?? 0);

test('V2 loads font, exposes all cars, gates moved settings and starts silent each load', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.FamilyV2!.fontReady);
  expect(await page.evaluate(() => document.fonts.check('20px "Family School"'))).toBe(true);
  await expect(page.locator('.car-card:enabled')).toHaveCount(6);
  await expect(page.locator('.track-card:enabled')).toHaveCount(8);
  await expect(page.locator('#sound-toggle')).not.toBeVisible();
  await openAdultSettings(page);
  expect(await page.evaluate(() => document.getElementById('sound-toggle')?.closest('family-v2-shell') !== null)).toBe(true);
  await page.locator('#sound-toggle').check();
  await page.locator('#music-toggle').check();
  await closeAdultSettings(page);
  await page.reload(); await solveGate(page);
  await openAdultSettings(page);
  await expect(page.locator('#sound-toggle')).not.toBeChecked();
  await expect(page.locator('#music-toggle')).not.toBeChecked();
});

test('family pause preserves race, manual pause and educational lock', async ({ page }) => {
  await openGame(page, '?test=1');
  await page.locator('#play-button').click();
  await expect.poll(() => steps(page)).toBeGreaterThan(10);
  await openAdultSettings(page);
  const frozen = await steps(page);
  await page.waitForTimeout(250);
  expect(await steps(page)).toBe(frozen);
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 600001; });
  await expect(page.locator('#learning-gate')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Adultos', exact: true })).not.toBeVisible();
  await solveGate(page);
  await expect.poll(() => steps(page)).toBeGreaterThan(frozen);
  await page.locator('#pause-button').click();
  await openAdultSettings(page); await closeAdultSettings(page);
  await expect(page.locator('#pause-screen')).toBeVisible();
  const manual = await steps(page); await page.waitForTimeout(200);
  expect(await steps(page)).toBe(manual);
});

test('score deduplicates awards, expires after one hour and theme reaches native UI', async ({ page }) => {
  await openGame(page);
  expect(await page.evaluate(() => {
    window.FamilyV2!.award('same', 2); window.FamilyV2!.award('same', 2);
    return window.FamilyV2!.read().points;
  })).toBe(2);
  await page.getByRole('combobox', { name: 'Aspecto' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-family-theme', 'dark');
  expect(await page.locator('#garage-screen').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(20, 30, 48)');
  expect(await page.evaluate(() => {
    const now = Date.now; Date.now = () => now() + 3600001;
    return window.FamilyV2!.read().points;
  })).toBe(0);
});

test('adult answer typing never latches driving keys', async ({ page }) => {
  await openGame(page, '?test=1');
  await page.locator('#play-button').click();
  await expect.poll(() => steps(page)).toBeGreaterThan(10);
  await page.getByRole('button', { name: 'Para adultos' }).click();
  await page.getByRole('textbox', { name: 'Resultado de la multiplicación' }).press('ArrowRight');
  await closeAdultSettings(page);
  await page.waitForTimeout(500);
  expect(Number(await page.locator('#speed').innerText())).toBeLessThan(2);
});
