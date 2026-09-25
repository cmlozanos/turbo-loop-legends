import { expect, test } from "@playwright/test";
import { openGame, solveGate } from "./learning-gate";

async function read(page: import("@playwright/test").Page) {
  return page.evaluate(() => (window as any).__turboRead());
}

test("all quality controls stay clear of cars and play on short mobile screens", async ({ page }, info) => {
  await openGame(page);
  // Reserve the install button even on engines that do not offer installation.
  await page.locator("#install-button").evaluate(element => element.removeAttribute("hidden"));
  for (const size of [{ width: 750, height: 342 }, { width: 640, height: 360 }]) {
    await page.setViewportSize(size);
    const settings = (await page.locator(".settings-row").boundingBox())!;
    const cars = (await page.locator(".car-grid").boundingBox())!;
    const play = (await page.locator(".garage-launch").boundingBox())!;
    expect(settings.y).toBeGreaterThanOrEqual(cars.y + cars.height);
    expect(settings.y).toBeGreaterThanOrEqual(play.y + play.height);
    expect(settings.y + settings.height).toBeLessThanOrEqual(size.height);
    await expect(page.locator("#light-toggle")).toBeInViewport();
    await expect(page.locator("#play-button")).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`settings-${size.width}.png`) });
  }
});

test("light profile reduces pixels, preserves camera and persists without resetting progress", async ({ page }, info) => {
  await openGame(page, "?test=1");
  const toggle = page.getByRole("checkbox", { name: "Modo ligero", exact: true });
  await expect(toggle).toBeChecked();
  await page.locator("#play-button").click();
  await expect.poll(async () => (await read(page)).scene?.steps ?? 0).toBeGreaterThan(10);
  const data = await read(page);
  const size = page.viewportSize()!;
  expect(data.width * data.height).toBeLessThan(size.width * size.height * 0.51);
  expect(data.scene.visibleDecorations).toBeLessThan(data.scene.decorations);
  await page.screenshot({ path: info.outputPath("light-race.png") });
  await page.locator("#pause-button").click(); await page.locator("#garage-button").click();
  await toggle.uncheck(); await page.locator("#play-button").click();
  await expect.poll(async () => (await read(page)).scene?.steps ?? 0).toBeGreaterThan(10);
  expect((await read(page)).width).toBe(size.width);
  await page.screenshot({ path: info.outputPath("normal-race.png") });
  await page.reload(); await solveGate(page);
  await expect(toggle).not.toBeChecked();
});

test("canvas stays aligned to the viewport after rotation in both quality modes", async ({ page }) => {
  await openGame(page, "?test=1");
  for (const light of [false, true]) {
    await page.locator("#light-toggle").setChecked(light);
    await page.locator("#play-button").click();
    for (const size of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await expect.poll(async () => Math.round((await page.locator("#game-canvas canvas").boundingBox())!.width)).toBe(size.width);
      const box = (await page.locator("#game-canvas canvas").boundingBox())!;
      expect(box.x).toBeCloseTo(0, 0); expect(box.y).toBeCloseTo(0, 0);
      expect(box.height).toBeCloseTo(size.height, 0);
    }
    await page.locator("#pause-button").click(); await page.locator("#garage-button").click();
  }
});

test("render and physics sleep behind garage, pause and educational gate", async ({ page }) => {
  await openGame(page, "?test=1");
  await expect.poll(async () => (await read(page)).running).toBe(false);
  await page.locator("#play-button").click();
  await expect.poll(async () => (await read(page)).scene?.steps ?? 0).toBeGreaterThan(10);
  await page.locator("#pause-button").click();
  await expect.poll(async () => (await read(page)).running).toBe(false);
  const steps = (await read(page)).scene.steps;
  await page.waitForTimeout(250); expect((await read(page)).scene.steps).toBe(steps);
  await page.locator("#resume-button").click();
  await expect.poll(async () => (await read(page)).scene.steps).toBeGreaterThan(steps);
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 600001; });
  await expect(page.locator("#learning-gate")).toBeVisible();
  await expect.poll(async () => (await read(page)).running).toBe(false);
  await solveGate(page);
  await expect.poll(async () => (await read(page)).running).toBe(true);
});

test("continue trying wakes the paused renderer behind the vehicle recommendation", async ({ page }) => {
  await openGame(page, "?test=1");
  await page.locator("#play-button").click();
  await expect.poll(async () => (await read(page)).scene?.steps ?? 0).toBeGreaterThan(10);
  await page.locator("#pause-button").click();
  await expect.poll(async () => (await read(page)).running).toBe(false);
  const steps = (await read(page)).scene.steps;
  // Present the other pause overlay to exercise its real continue handler.
  await page.evaluate(() => {
    document.getElementById("pause-screen")!.hidden = true;
    document.getElementById("challenge-screen")!.hidden = false;
  });
  await page.locator("#challenge-continue-button").click();
  await expect.poll(async () => (await read(page)).scene.steps).toBeGreaterThan(steps);
  expect((await read(page)).running).toBe(true);
});

test("initial circuit submits only visible geometry and reuses wheel textures", async ({ page }) => {
  await page.addInitScript(() => {
    const metrics = { calls: 0, triangles: 0 };
    (window as any).__renderMetrics = metrics;
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!type) continue;
      const proto = type.prototype as any;
      for (const name of ["drawArrays", "drawElements"]) {
        const draw = proto[name];
        proto[name] = function (...args: number[]) {
          metrics.calls++;
          if (args[0] === this.TRIANGLES) metrics.triangles += args[name === "drawArrays" ? 2 : 1] / 3;
          return draw.apply(this, args);
        };
      }
    }
  });
  await openGame(page, "?test=1");
  await page.locator("#play-button").click();
  await expect.poll(async () => (await read(page)).scene?.steps ?? 0).toBeGreaterThan(30);
  const sample = () => page.evaluate(() => ({ ...(window as any).__renderMetrics, ...(window as any).__turboRead() }));
  const before = await sample();
  await page.waitForTimeout(1000);
  const after = await sample();
  const frames = after.renderFrames - before.renderFrames;
  expect(frames).toBeGreaterThan(0);
  const triangles = (after.triangles - before.triangles) / frames;
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThan(9000);
  console.log("Turbo initial circuit render workload:", JSON.stringify({ frames, callsPerFrame: (after.calls - before.calls) / frames, trianglesPerFrame: triangles }));
  await page.locator("#pause-button").click(); await page.locator("#garage-button").click();
  await page.locator("#play-button").click();
  await expect.poll(async () => (await read(page)).scene?.steps ?? 0).toBeGreaterThan(10);
  expect((await read(page)).textures).toBe(after.textures);
});
