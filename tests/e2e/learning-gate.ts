import { expect, type Page } from '@playwright/test';

// Complete the visible challenge, never an application unlock API or saved token.
export async function solveGate(page: Page): Promise<void> {
  const gate = page.locator('#learning-gate');
  await expect(gate).toBeVisible();
  const prompt = page.locator('#gate-prompt');
  if (await prompt.isVisible()) {
    const parts = (await prompt.textContent())?.match(/(\d)\s*([+−-])\s*(\d)/);
    if (!parts) throw new Error('Unrecognized challenge');
    const answer = parts[2] === '+' ? Number(parts[1]) + Number(parts[3]) : Number(parts[1]) - Number(parts[3]);
    await page.locator(`[data-gate-key="${answer}"]`).click();
  } else {
    const canvas = page.locator('#gate-trace');
    const strokes = await canvas.evaluate(element => window.LearningGate!.Core.glyphs[(element as HTMLElement).dataset.letter!]);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Missing tracing canvas');
    for (const stroke of strokes) {
      await page.mouse.move(box.x + stroke[0][0] * box.width / 100, box.y + stroke[0][1] * box.height / 100);
      await page.mouse.down();
      for (const point of stroke.slice(1)) {
        await page.mouse.move(box.x + point[0] * box.width / 100, box.y + point[1] * box.height / 100, { steps: 3 });
      }
      await page.mouse.up();
    }
  }
  await expect(gate).toHaveCount(0);
}

export async function openGame(page: Page): Promise<void> {
  await page.goto('');
  await solveGate(page);
}
