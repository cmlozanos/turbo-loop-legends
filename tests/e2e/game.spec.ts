import { expect, test } from "@playwright/test";
import { openGame, solveGate } from "./learning-gate";

test("requires a correct challenge on entry, ignoring the old session token", async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now();
    sessionStorage.setItem("turbo-loop-legends:math-session", JSON.stringify({ firstSolvedAt: now, lastSolvedAt: now }));
    Math.random = () => 0.1;
  });
  await page.goto("");
  const screen = page.locator("#learning-gate");
  await expect(screen).toBeVisible();
  const match = (await page.locator("#gate-prompt").innerText()).match(/(\d)\s*\+\s*(\d)/);
  expect(match).not.toBeNull();
  const answer = Number(match![1]) + Number(match![2]);
  expect(answer).toBeLessThan(10);

  const wrongAnswer = answer === 9 ? 8 : 9;
  await page.locator(`[data-gate-key="${wrongAnswer}"]`).click();
  await expect(page.locator("#gate-feedback")).toHaveText("↻");
  await expect(screen).toBeVisible();
  await solveGate(page);

  await expect(screen).toBeHidden();
  await page.getByRole("button", { name: "JUGAR" }).click();
  await expect(page.getByLabel("Acelerar")).toBeVisible();
});

test("freezes the race at ten minutes and preserves a later manual pause", async ({ page }) => {
  await openGame(page);
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => Number(await page.locator("#speed").textContent())).toBeGreaterThan(20);
  await page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 600001;
  });
  await expect(page.locator("#learning-gate")).toBeVisible();
  const speed = await page.locator("#speed").textContent();
  await page.waitForTimeout(400);
  await expect(page.locator("#speed")).toHaveText(speed!);
  await page.keyboard.up("ArrowRight");
  await solveGate(page);
  await page.getByLabel("Pausa", { exact: true }).click();
  await page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 600001;
  });
  await expect(page.locator("#learning-gate")).toBeVisible();
  await solveGate(page);
  await expect(page.locator("#pause-screen")).toBeVisible();
  await expect(page.locator("#hud")).toBeHidden();
});

test("links the garage and race home icons to the games catalogue", async ({ page }, testInfo) => {
  await openGame(page);
  await expect(page.getByRole("link", { name: "Volver a todos los juegos" })).toHaveAttribute("href", "https://cmlozanos.github.io/games/");
  await expect(page.getByRole("link", { name: "Volver a todos los juegos" })).toBeInViewport();
  const homeBox = await page.locator(".games-link").boundingBox();
  const playBox = await page.locator("#play-button").boundingBox();
  expect(homeBox!.x + homeBox!.width).toBeLessThanOrEqual(playBox!.x);
  await page.screenshot({ path: testInfo.outputPath("garage.png") });
  await page.getByRole("button", { name: "JUGAR" }).click();
  await expect(page.getByRole("link", { name: "Volver a todos los juegos" })).toHaveAttribute("href", "https://cmlozanos.github.io/games/");
  await expect(page.getByRole("link", { name: "Volver a todos los juegos" })).toBeInViewport();
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => Number(await page.locator("#speed").textContent())).toBeGreaterThan(5);
  await page.keyboard.up("ArrowRight");
  await page.screenshot({ path: testInfo.outputPath("race.png") });
});

test("completes a guided letter before playing", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.8; });
  await page.goto("");
  await expect(page.locator("#gate-trace")).toBeVisible();
  await solveGate(page);
  await page.getByRole("button", { name: "JUGAR" }).click();
  await expect(page.getByLabel("Acelerar")).toBeVisible();
});

test("fails closed if the educational gate asset cannot load", async ({ page }) => {
  await page.route("**/learning-gate.js*", route => route.abort());
  await page.goto("");
  await expect(page.locator("#app")).toHaveText("No se pudo cargar el reto. Recarga la página para jugar.");
  await expect(page.getByRole("button", { name: "JUGAR" })).toHaveCount(0);
});

test.describe("gate during scene loading", () => {
  test.use({ serviceWorkers: "block" });
  test("keeps a late-loaded race paused until the challenge is solved", async ({ page }) => {
    let release!: () => void;
    let requested = false;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/cars/comet-body.png*", async route => {
      requested = true;
      await pending;
      await route.continue();
    });
    await openGame(page);
    await page.getByRole("button", { name: "JUGAR" }).click();
    await expect.poll(() => requested).toBe(true);
    await page.evaluate(() => {
      const now = Date.now;
      Date.now = () => now() + 600001;
    });
    await expect(page.locator("#learning-gate")).toBeVisible();
    await page.evaluate(() => {
      const label = document.getElementById("speed")!;
      label.dataset.observedUpdates = "0";
      new MutationObserver(() => {
        label.dataset.observedUpdates = String(Number(label.dataset.observedUpdates) + 1);
      }).observe(label, { childList: true });
    });
    release();
    await page.waitForTimeout(500);
    await expect(page.locator("#speed")).toHaveText("0");
    await expect(page.locator("#speed")).toHaveAttribute("data-observed-updates", "0");
    await solveGate(page);
    await page.keyboard.down("ArrowRight");
    await expect.poll(async () => Number(await page.locator("#speed").textContent())).toBeGreaterThan(20);
    await page.keyboard.up("ArrowRight");
  });
});

test("opens the garage and starts a race", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openGame(page);

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
  await openGame(page);
  const moon = page.getByRole("button", { name: "Base Lunar: Gravedad baja y saltos gigantes" });
  await moon.click();
  await expect(moon).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.getByRole("button", { name: "Pausa", exact: true }).click();
  await page.getByRole("button", { name: "Garaje", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Turbo Loop Legends/i })).toBeVisible();
  await expect(moon).toHaveAttribute("aria-pressed", "true");
});

test("starts the next circuit directly from the finish screen", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const finish = document.getElementById("finish-screen");
    const garage = document.getElementById("garage-screen");
    if (finish) finish.hidden = false;
    if (garage) garage.hidden = true;
  });
  await page.getByRole("button", { name: "SIGUIENTE CIRCUITO" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Pausa", exact: true }).click();
  await page.getByRole("button", { name: "Garaje", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ciudad Neón: Velocidad, rebotes y luces eléctricas" })).toHaveAttribute("aria-pressed", "true");
});

test("shows six distinct spectacular car designs and their capabilities", async ({ page }) => {
  await openGame(page);
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
  await openGame(page);
  const maps = page.locator(".track-map");
  await expect(maps).toHaveCount(8);
  const signatures = await maps.evaluateAll((elements) => elements.map((element) => element.innerHTML));
  expect(new Set(signatures).size).toBe(8);
});

test("explains whether the selected car fits a capability circuit", async ({ page }) => {
  await openGame(page);
  await page.getByRole("button", { name: "Jungla Secreta: Túneles bajos y vuelos entre lianas" }).click();
  await expect(page.locator("#track-advice .visual-choice")).toContainText("⚠️");
  await page.getByRole("button", { name: "Chispa: Pequeño, rápido y saltarín" }).click();
  await expect(page.locator("#track-advice .visual-choice")).toContainText("✅");
  await expect(page.locator("#track-advice")).toContainText("Cumple los requisitos");
});

test("shows car ability icons and complete track names without clipped text", async ({ page }) => {
  await openGame(page);
  const clipped = await page.locator(".track-card strong").evaluateAll((elements) => elements
    .filter((element) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight)
    .map((element) => element.textContent));
  expect(clipped).toEqual([]);
  await expect(page.getByRole("button", { name: "Fábrica Colosal: Muros altos y compuertas pesadas" })).toBeVisible();
  await expect(page.locator(".car-gecko .role-icon")).toHaveText("🛑");
  await expect(page.locator(".track-card .track-icon")).toHaveCount(8);
});

test("keeps touch controls inside the landscape viewport", async ({ page }) => {
  await openGame(page);
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
  await openGame(page);
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => Number(await page.locator("#speed").textContent()), { timeout: 10_000 }).toBeGreaterThan(50);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("r");
  await expect(page.getByRole("status")).toContainText("Otra oportunidad");
});

test("activates turbo with the keyboard", async ({ page }) => {
  await openGame(page);
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
  await openGame(page);
  await page.getByRole("button", { name: "JUGAR" }).click();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ShiftLeft");
  await expect(page.getByRole("status")).toContainText("Barricada destrozada", { timeout: 20_000 });
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("ArrowRight");
});

test("reopens after the network is disconnected", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "WebKit automation cannot reload while its network is emulated offline");
  await openGame(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#learning-gate")).toBeVisible();
  await solveGate(page);
  await expect(page.getByRole("heading", { name: /Turbo Loop Legends/i })).toBeVisible();
});

test("offers add-to-home-screen guidance on iPad and iPhone", async ({ page }) => {
  await openGame(page);
  const isiOS = await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent));
  test.skip(!isiOS, "Esta ayuda solo corresponde a Safari en iPad y iPhone");

  const install = page.locator("#install-button");
  await expect(install).toBeVisible();
  await install.click();
  await expect(install).toHaveText("Safari: Compartir → Añadir a inicio");
});
