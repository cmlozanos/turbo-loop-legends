import { expect, type Page } from '@playwright/test';

export async function openAdultSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Para adultos' }).click();
  const text = await page.locator('family-v2-shell #gate-label').innerText();
  const [a, b] = text.match(/\d+/g)!.map(Number);
  await page.getByRole('textbox', { name: 'Resultado de la multiplicación' }).fill(String(a * b));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('family-v2-shell #adult-settings')).toBeVisible();
}

export async function closeAdultSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
}
