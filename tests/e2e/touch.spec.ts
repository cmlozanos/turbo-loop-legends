import { test, expect } from "@playwright/test";
import { openGame } from "./learning-gate";
import { createRequire } from "node:module";
const { checkTouchUI } = createRequire(import.meta.url)("../../tools/touch-check.cjs");

test("touch context menus, editable controls and held input release", async ({ page, context, browserName }) => {
  await openGame(page);
  await checkTouchUI(page, "#play-button");
  await page.getByRole("button", { name: "JUGAR" }).click();
  if (browserName === "chromium") {
    const session = await context.newCDPSession(page);
    const control = page.getByLabel("Activar turbo", { exact: true });
    const box = (await control.boundingBox())!;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }]
    });
    await page.waitForTimeout(800);
    await expect(control).toHaveClass(/is-active/);
    await expect(control).toHaveAttribute("aria-pressed", "true");
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(control).not.toHaveClass(/is-active/);
    await expect(control).toHaveAttribute("aria-pressed", "false");
    await session.detach();
  }
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => Number(await page.locator("#speed").textContent())).toBeGreaterThan(5);
  await page.keyboard.up("ArrowRight");
});
