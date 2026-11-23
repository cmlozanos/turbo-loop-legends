import { expect, test } from "@playwright/test";
import { openGame } from "./learning-gate";
import { openAdultSettings, closeAdultSettings } from "./family-v2";

const read = (page: import("@playwright/test").Page) => page.evaluate(() => (window as any).__turboRead());

test("native day/night, common handwriting and live motion keep the same race", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openGame(page, "?test=1");
  await expect(page.locator(".car-card")).toHaveCount(6);
  for (const size of [{ width: 1024, height: 768 }, { width: 750, height: 342 }]) {
    await page.setViewportSize(size);
    await expect(page.locator("#play-button")).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`garage-${size.width}.png`) });
  }
  await page.locator("#play-button").click();
  await expect.poll(async () => (await read(page)).scene?.steps ?? 0).toBeGreaterThan(10);
  for (const size of [{ width: 1024, height: 768 }, { width: 750, height: 342 }]) {
    await page.setViewportSize(size);
    for (const theme of ["light", "dark"]) {
      await page.getByRole("combobox", { name: "Aspecto" }).selectOption(theme);
      await expect.poll(async () => (await read(page)).scene.theme).toBe(theme);
      await page.screenshot({ path: info.outputPath(`race-${size.width}-${theme}.png`) });
    }
  }
  const fonts = await page.locator("h1, .car-card strong, .track-card strong, #speed, .speed-unit, .turbo-control").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).fontFamily));
  expect(fonts.every(font => font.includes("Family School"))).toBe(true);
  await expect(page.locator(".turbo-control")).toContainText("Turbo");
  await expect(page.locator(".speed-unit")).toHaveText("km/h");
  console.log("Native font QA", JSON.stringify(fonts));
  const nativeText = (await read(page)).scene.nativeText;
  expect(nativeText.length).toBeGreaterThan(0);
  expect(nativeText.every((item: { font: string }) => item.font === "Family School")).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('20px "Family School"'))).toBe(true);
  await openAdultSettings(page);
  await page.locator("family-v2-shell #motion").click();
  await closeAdultSettings(page);
  await expect.poll(async () => (await read(page)).scene.decorativeMotion).toBe(false);
  const throttle = await page.getByRole("button", { name: "Acelerar", exact: true }).boundingBox();
  await page.mouse.move(throttle!.x + throttle!.width / 2, throttle!.y + throttle!.height / 2);
  await page.mouse.down();
  await expect.poll(async () => (await read(page)).scene.snapshot.velocity.x).toBeGreaterThan(3);
  expect((await read(page)).scene.dustAlive).toBe(0);
  expect((await read(page)).scene.fragments).toBe(0);
  await page.mouse.up();
  await openAdultSettings(page);
  await page.locator("family-v2-shell #motion").click();
  await closeAdultSettings(page);
  await expect.poll(async () => (await read(page)).scene.decorativeMotion).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await read(page)).scene.decorativeMotion).toBe(false);
  await page.getByRole("button", { name: "Inicio del juego", exact: true }).click();
  await expect(page.locator("#garage-screen")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const car of ["mammoth", "titan"]) {
  test(`${car} natural inputs traverse ramps, full/broken loops and finish with readable camera`, async ({ page }, info) => {
    test.setTimeout(100000);
    await page.setViewportSize(car === "mammoth" ? { width: 750, height: 342 } : { width: 1024, height: 768 });
    await openGame(page, "?test=1");
    await page.locator(`.car-${car}`).click();
    await page.getByRole("button", { name: car === "mammoth" ? "Fábrica Colosal: Muros altos y compuertas pesadas" : "Bosque Turbo: Rápida, amable y llena de saltos" }).click();
    if (car === "titan") {
      await openAdultSettings(page);
      await page.locator("#light-toggle").uncheck();
      await closeAdultSettings(page);
    }
    await page.locator("#play-button").click();
    await page.keyboard.down("ArrowRight");
    await page.keyboard.down("ShiftLeft");
    const loops = new Set<string>();
    let flight = false, landing = false, maxX = -Infinity, maxY = -Infinity, samples = 0;
    await expect.poll(async () => {
      const data = await read(page);
      if (!data.scene?.snapshot) return false;
      const { snapshot, view } = data.scene;
      const x = 850 + snapshot.chassis.position.x * 45, y = 590 - snapshot.chassis.position.y * 45;
      // Actual camera world bounds, not a screenshot-only assertion. Allow a half-car margin.
      expect(x).toBeGreaterThan(view.x - 70);
      expect(x).toBeLessThan(view.x + view.width + 70);
      expect(y).toBeGreaterThan(view.y - 70);
      expect(y).toBeLessThan(view.y + view.height + 70);
      maxX = Math.max(maxX, snapshot.chassis.position.x); maxY = Math.max(maxY, snapshot.chassis.position.y); samples++;
      if (snapshot.activeLoopId && !loops.has(snapshot.activeLoopId)) {
        loops.add(snapshot.activeLoopId);
        await page.screenshot({ path: info.outputPath(`${car}-${snapshot.activeLoopId}.png`) });
      }
      if (!flight && snapshot.chassis.position.x > 75 && snapshot.chassis.position.x < 150 && snapshot.chassis.position.y > 3.5) {
        flight = true;
        await page.screenshot({ path: info.outputPath(`${car}-ramp-flight.png`) });
      }
      if (flight && !landing && snapshot.chassis.position.x > 115 && snapshot.chassis.position.x < 160 && snapshot.chassis.position.y < 2) {
        landing = true;
        await page.screenshot({ path: info.outputPath(`${car}-landing.png`) });
      }
      return page.locator("#finish-screen").isVisible();
    }, { timeout: 75000, intervals: [100] }).toBe(true);
    await page.keyboard.up("ShiftLeft"); await page.keyboard.up("ArrowRight");
    const completed = (await read(page)).scene.snapshot;
    expect(completed.checkpointIndex).toBe(7);
    expect(completed.respawnCount).toBe(0);
    expect(loops.size).toBe(2);
    expect(flight).toBe(true);
    expect(landing).toBe(true);
    console.log("Native driving QA", JSON.stringify({ car, loops: [...loops], flight, landing, samples, maxX, maxY, respawns: completed.respawnCount }));
    await page.locator("#replay-button").click();
    await expect.poll(async () => (await read(page)).scene.snapshot.checkpointIndex).toBe(0);
    await page.keyboard.press("r");
    await expect(page.locator("#toast")).toContainText("Otra oportunidad");
  });
}
