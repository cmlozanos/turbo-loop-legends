import { expect, test } from "@playwright/test";

test("opens the garage and starts a race", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("");

  await expect(page.getByRole("heading", { name: /Turbo Loop Legends/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cometa/i })).toBeEnabled();
  await page.getByRole("button", { name: "JUGAR" }).click();

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("Acelerar")).toBeVisible();
  await expect(page.getByText("KM/H")).toBeVisible();
  expect(errors).toEqual([]);
});

test("shows three distinct spectacular car designs", async ({ page }) => {
  await page.goto("");
  const images = page.locator(".car-preview img");
  await expect(images).toHaveCount(3);
  const sources = await images.evaluateAll((elements) => elements.map((element) => (element as HTMLImageElement).src));
  expect(new Set(sources).size).toBe(3);
  expect(sources).toEqual(expect.arrayContaining([
    expect.stringMatching(/cars\/comet-body\.svg/),
    expect.stringMatching(/cars\/lynx-body\.svg/),
    expect.stringMatching(/cars\/titan-body\.svg/)
  ]));
  expect(await images.evaluateAll((elements) => elements.every((element) => (element as HTMLImageElement).naturalWidth > 0))).toBe(true);
});

test("keeps touch controls inside the landscape viewport", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "JUGAR" }).click();
  const controls = [page.getByLabel("Acelerar"), page.getByLabel("Frenar y marcha atrás")];
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const control of controls) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  }
});

test("accelerates quickly with the keyboard and can reset", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1400);
  await page.keyboard.up("ArrowRight");
  await expect.poll(async () => Number(await page.locator("#speed").textContent())).toBeGreaterThan(50);
  await page.keyboard.press("r");
  await expect(page.getByRole("status")).toContainText("Otra oportunidad");
});

test("reopens after the network is disconnected", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "WebKit automation cannot reload while its network is emulated offline");
  await page.goto("");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Turbo Loop Legends/i })).toBeVisible();
});
