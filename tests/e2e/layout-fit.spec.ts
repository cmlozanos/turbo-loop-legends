import {selectGalleryItem} from "./gallery-helper";
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openGame } from './learning-gate';
import { closeAdultSettings, openAdultSettings } from './family-v2';

const sizes = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 740, height: 360 },
  { width: 750, height: 342 },
  { width: 1024, height: 768 },
  { width: 800, height: 1280 },
];

async function fits(page: Page, controls: Locator): Promise<void> {
  const viewport = page.viewportSize()!;
  for (const control of await controls.all()) {
    await expect(control).toBeVisible();
    const box = (await control.boundingBox())!;
    const label = await control.getAttribute('aria-label') ?? await control.innerText();
    expect(box.width, label).toBeGreaterThanOrEqual(44);
    expect(box.height, label).toBeGreaterThanOrEqual(44);
    expect(box.x, label).toBeGreaterThanOrEqual(0);
    expect(box.y, label).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, label).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height, label).toBeLessThanOrEqual(viewport.height + 1);
  }
}

async function noScroll(page: Page): Promise<void> {
  // Check intrinsic content too: overflow:hidden on an ancestor cannot make this pass.
  const overflow = await page.evaluate(() => {
    const nodes = [document.documentElement, document.body, document.querySelector('#app')!,
      ...document.querySelectorAll('.app-shell, .screen:not([hidden]), .garage, .car-grid, .track-grid, .modal')];
    return nodes.filter(node => (node as HTMLElement).getClientRects().length > 0)
      .filter(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map(node => ({ node: node.id || node.className || node.tagName,
        width: [node.scrollWidth, node.clientWidth], height: [node.scrollHeight, node.clientHeight] }));
  });
  expect(overflow).toEqual([]);
  if (page.context().browser()?.browserType().name() === 'chromium') await page.mouse.wheel(400, 400);
  await page.evaluate(() => window.scrollTo(400, 400));
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
}

for (const size of sizes) {
  test(`native layouts fit ${size.width}x${size.height} without scrolling or lost choices`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page, '?test=1');
    await page.evaluate(() => window.FamilyV2!.fontReady);
    const toolbar = page.locator('family-v2-shell');
    const menuControls = toolbar.locator('.bar button, .bar select');
    const choices = page.locator('.car-card:visible, .track-card:visible');
    await expect(page.locator('.car-card')).toHaveCount(6);
    await expect(page.locator('.track-card')).toHaveCount(8);
    await fits(page, choices);
    await fits(page, page.locator('#play-button'));
    await fits(page, menuControls);
    const clippedLabels = await choices.locator('strong').evaluateAll(nodes => nodes.filter(node => {
      // Handwriting ascenders may exceed their line box; the card must contain the ink's text box.
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      const card = node.closest('button')!.getBoundingClientRect();
      return text.left < card.left || text.right > card.right || text.top < card.top || text.bottom > card.bottom;
    }).map(node => node.textContent));
    expect(clippedLabels).toEqual([]);
    await noScroll(page);
    // Every option is actually reachable, not merely painted outside a clipped scroller.
    for(const [kind,selector] of [["car",".car-card"],["track",".track-card"]] as const){
      const all=page.locator(selector);const count=await all.count();
      for(let i=0;i<count;i++){await selectGalleryItem(page,kind,all.nth(i));await expect(all.nth(i)).toHaveAttribute('aria-pressed','true');await noScroll(page);}
    }
    const fonts = await page.locator('h1, .car-card strong, .track-card strong').evaluateAll(nodes =>
      nodes.map(node => getComputedStyle(node).fontFamily));
    expect(fonts.every(font => font.includes('Family School'))).toBe(true);
    if ([320, 750, 1024].includes(size.width)) {
      await page.screenshot({ path: info.outputPath('garage.png') });
    }
    await page.getByRole('combobox', { name: 'Aspecto' }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-family-theme', 'dark');
    await noScroll(page);
    await page.locator('#play-button').click();
    await expect(page.locator('#hud')).toBeVisible();
    await fits(page, page.locator('#hud button'));
    await fits(page, menuControls);
    const hudBoxes = await page.locator('#hud button').evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (let i = 0; i < hudBoxes.length; i++) {
      for (const other of hudBoxes.slice(i + 1)) {
        const box = hudBoxes[i];
        expect(box.x + box.width <= other.x || other.x + other.width <= box.x ||
          box.y + box.height <= other.y || other.y + other.height <= box.y).toBe(true);
      }
    }
    await expect(page.getByRole('button', { name: 'Inicio del juego', exact: true })).toHaveCount(1);
    const brake = (await page.locator('.brake-control').boundingBox())!;
    const turbo = (await page.locator('.turbo-control').boundingBox())!;
    const throttle = (await page.locator('.throttle-control').boundingBox())!;
    expect(turbo.x - (brake.x + brake.width)).toBeGreaterThanOrEqual(8);
    expect(turbo.x - (brake.x + brake.width)).toBeLessThanOrEqual(16);
    expect(turbo.x + turbo.width + 8).toBeLessThanOrEqual(throttle.x);
    await noScroll(page);
    if ([320, 750, 1024].includes(size.width)) {
      await page.screenshot({ path: info.outputPath('race.png') });
    }
    await page.locator('#pause-button').click();
    await fits(page, page.locator('#pause-screen button'));
    await noScroll(page);
    // Layout fixtures only: completion/driving behavior is covered by the natural-input suite.
    for (const id of ['finish-screen', 'challenge-screen']) {
      await page.evaluate(id => {
        document.querySelectorAll('.screen').forEach(node => { (node as HTMLElement).hidden = node.id !== id; });
        if (id === 'challenge-screen') {
          document.getElementById('challenge-message')!.textContent = 'Has probado 3 veces. Este obstáculo necesita mucha fuerza. Mamut tiene ruedas enormes y puede superar este reto.';
          document.getElementById('change-car-button')!.textContent = 'PROBAR CON MAMUT';
        }
      }, id);
      await fits(page, page.locator(`#${id} button`));
      await noScroll(page);
      if (size.width === 750) await page.screenshot({ path: info.outputPath(`${id}.png`) });
    }
  });
}

test('rotation reflows the existing garage and running HUD without scroll', async ({ page }) => {
  await openGame(page, '?test=1');
  for (const size of sizes) {
    await page.setViewportSize(size);
    await fits(page, page.locator('.car-card:visible, .track-card:visible, #play-button'));
    await noScroll(page);
  }
  await page.locator('#play-button').click();
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect.poll(async () => Math.round((await page.locator('canvas').first().boundingBox())!.width)).toBe(size.width);
    await fits(page, page.locator('#hud button'));
    await noScroll(page);
  }
});

for (const size of sizes) {
  test(`canonical adult dialog fits ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await openGame(page, '?test=1');
    const toolbar = page.locator('family-v2-shell');
    await page.evaluate(() => window.FamilyV2!.fontReady);
    await openAdultSettings(page);
    await page.screenshot({ path: info.outputPath('adult-settings.png') });
    await fits(page, toolbar.locator('dialog button:visible, dialog input:visible'));
    await fits(page, page.locator('[data-family-setting]:visible'));
    const overflow = await toolbar.locator('dialog').evaluate(node => ({
      x: node.scrollWidth - node.clientWidth, y: node.scrollHeight - node.clientHeight,
    }));
    expect(overflow.x).toBeLessThanOrEqual(1);
    expect(overflow.y).toBeLessThanOrEqual(1);
    await closeAdultSettings(page);
  });
}
