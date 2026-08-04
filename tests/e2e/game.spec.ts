import { expect, test } from "@playwright/test";

test("opens the garage and starts a race", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("");

  await expect(page.getByRole("heading", { name: /Turbo Loop Legends/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cometa/i })).toBeEnabled();
  await expect(page.getByRole("group", { name: "Elige una pista" }).getByRole("button")).toHaveCount(8);
  await page.getByRole("button", { name: "JUGAR" }).click();

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("Acelerar")).toBeVisible();
  await expect(page.getByLabel("Activar turbo")).toBeVisible();
  await expect(page.getByText("KM/H")).toBeVisible();
  expect(errors).toEqual([]);
});

test("selects a track and returns to the garage during a race", async ({ page }) => {
  await page.goto("");
  const moon = page.getByRole("button", { name: "Base Lunar: Gravedad baja y saltos gigantes" });
  await moon.click();
  await expect(moon).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.getByRole("button", { name: "Volver al garaje y cambiar coche o pista" }).click();
  await expect(page.getByRole("heading", { name: /Turbo Loop Legends/i })).toBeVisible();
  await expect(moon).toHaveAttribute("aria-pressed", "true");
});

test("starts the next circuit directly from the finish screen", async ({ page }) => {
  await page.goto("");
  await page.evaluate(() => {
    const finish = document.getElementById("finish-screen");
    const garage = document.getElementById("garage-screen");
    if (finish) finish.hidden = false;
    if (garage) garage.hidden = true;
  });
  await page.getByRole("button", { name: "SIGUIENTE CIRCUITO" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Volver al garaje y cambiar coche o pista" }).click();
  await expect(page.getByRole("button", { name: "Ciudad Neón: Velocidad, rebotes y luces eléctricas" })).toHaveAttribute("aria-pressed", "true");
});

test("shows six distinct spectacular car designs and their capabilities", async ({ page }) => {
  await page.goto("");
  const images = page.locator(".car-preview img");
  await expect(images).toHaveCount(6);
  const sources = await images.evaluateAll((elements) => elements.map((element) => (element as HTMLImageElement).src));
  expect(new Set(sources).size).toBe(6);
  expect(sources).toEqual(expect.arrayContaining([
    expect.stringMatching(/cars\/comet-preview\.svg/),
    expect.stringMatching(/cars\/lynx-preview\.svg/),
    expect.stringMatching(/cars\/titan-preview\.svg/),
    expect.stringMatching(/cars\/spark-preview\.svg/),
    expect.stringMatching(/cars\/gecko-preview\.svg/),
    expect.stringMatching(/cars\/mammoth-preview\.svg/)
  ]));
  expect(await images.evaluateAll((elements) => elements.every((element) => (element as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const standaloneAssets = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => (await fetch(url)).text())), sources);
  expect(standaloneAssets.every((asset) => !asset.includes("<image"))).toBe(true);
});

test("shows eight distinct real track minimaps", async ({ page }) => {
  await page.goto("");
  const maps = page.locator(".track-map");
  await expect(maps).toHaveCount(8);
  const signatures = await maps.evaluateAll((elements) => elements.map((element) => element.innerHTML));
  expect(new Set(signatures).size).toBe(8);
});

test("explains whether the selected car fits a capability circuit", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "Jungla Secreta: Túneles bajos y vuelos entre lianas" }).click();
  await expect(page.locator("#track-advice")).toContainText("Piensa antes de correr");
  await page.getByRole("button", { name: "Chispa: Pequeño, rápido y saltarín" }).click();
  await expect(page.locator("#track-advice")).toContainText("Buena elección");
  await expect(page.locator("#track-advice")).toContainText("Tamaño pequeño");
});

test("keeps touch controls inside the landscape viewport", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "JUGAR" }).click();
  const controls = [page.getByLabel("Acelerar"), page.getByLabel("Frenar y marcha atrás"), page.getByLabel("Activar turbo")];
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
  await expect.poll(async () => Number(await page.locator("#speed").textContent()), { timeout: 10_000 }).toBeGreaterThan(50);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("r");
  await expect(page.getByRole("status")).toContainText("Otra oportunidad");
});

test("activates turbo with the keyboard", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ShiftLeft");
  await expect(page.getByLabel("Activar turbo")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => Number(await page.locator("#speed").textContent()), { timeout: 15_000 }).toBeGreaterThan(110);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("ArrowRight");
  await expect(page.getByLabel("Activar turbo")).toHaveAttribute("aria-pressed", "false");
});

test("smashes the mandatory early barrier with enough speed", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ShiftLeft");
  await expect(page.getByRole("status")).toContainText("Barricada destrozada", { timeout: 20_000 });
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("ArrowRight");
});

test("reopens after the network is disconnected", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "WebKit automation cannot reload while its network is emulated offline");
  await page.goto("");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Turbo Loop Legends/i })).toBeVisible();
});

test("offers add-to-home-screen guidance on iPad and iPhone", async ({ page }) => {
  await page.goto("");
  const isiOS = await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent));
  test.skip(!isiOS, "Esta ayuda solo corresponde a Safari en iPad y iPhone");

  const install = page.locator("#install-button");
  await expect(install).toBeVisible();
  await install.click();
  await expect(install).toHaveText("Safari: Compartir → Añadir a inicio");
});
