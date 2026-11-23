import type Phaser from "phaser";
import type { NativeTheme } from "./appearance";
import type { TrackTheme, TrackId } from "./track";

// Fixed, original vector scenery. Redrawn only on appearance/viewport changes.
export function paintScenery(layers: Phaser.GameObjects.Graphics[], theme: TrackTheme | undefined, id: TrackId | undefined, appearance: NativeTheme, width: number): void {
  const [sky, ridge, near] = layers;
  for (const layer of layers) layer.clear();
  const night = appearance === "dark";
  sky.fillGradientStyle(night ? 0x080e25 : theme?.skyTop ?? 0x79ccec, night ? 0x080e25 : theme?.skyTop ?? 0x79ccec,
    night ? 0x364969 : theme?.skyBottom ?? 0xeaf8f2, night ? 0x364969 : theme?.skyBottom ?? 0xeaf8f2, 1);
  sky.fillRect(-7000, -1000, 36000, 2800);
  const sunX = width * 0.73;
  sky.fillStyle(night ? 0xb4d9ee : 0xffd78a, 0.07).fillCircle(sunX, 110, 115);
  sky.fillStyle(night ? 0xb4d9ee : 0xffd78a, 0.13).fillCircle(sunX, 110, 82);
  sky.fillStyle(night ? 0xe3f2ff : 0xfff1c3, 1).fillCircle(sunX, 110, night ? 29 : 43);
  if (night) {
    sky.fillStyle(0xa5bdd6, 0.65).fillCircle(sunX - 10, 103, 6).fillCircle(sunX + 9, 118, 4);
    sky.fillStyle(0xe0f4ff, 0.8);
    for (let i = 0; i < 48; i++) sky.fillCircle((i * 137 + 27) % 2600 - 400, (i * 59) % 270 - 45, i % 4 ? 1 : 2);
  } else {
    sky.fillStyle(0xffffff, 0.45);
    for (let i = 0; i < 8; i++) {
      const x = i * 360 - 400, y = 135 + (i % 3) * 40;
      sky.fillEllipse(x, y, 175, 20).fillEllipse(x + 40, y - 10, 100, 27);
    }
  }
  for (let i = -2; i < 16; i++) {
    const x = i * 290, peak = 205 + ((i * i * 37) % 160);
    ridge.fillStyle(night ? 0x273954 : theme?.scenery ?? 0x8cb8b1).fillTriangle(x - 170, 730, x + 110, peak, x + 420, 730);
    ridge.fillStyle(night ? 0x344966 : 0xc1d0ba, night ? 0.4 : 0.35).fillTriangle(x + 110, peak, x + 160, peak + 85, x + 75, peak + 67);
    ridge.fillStyle(0x142739, 0.24).fillTriangle(x + 110, peak, x + 420, 730, x + 225, 730);
    const y = 450 + ((i * i * 19) % 75);
    near.fillStyle(night ? 0x192c3c : theme?.ground ?? 0x4f8e52).fillEllipse(x + 130, 730, 560, 420);
    if (id === "neon" || id === "factory") {
      near.fillStyle(night ? 0x101e34 : 0x435367).fillRect(x + 40, y - 80, 90, 280);
      near.fillStyle(night ? 0xf6cb73 : 0xb9d3da, 0.7);
      for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) near.fillRect(x + 50 + col * 26, y - 65 + row * 30, 11, 13);
    } else if (id === "moon" || id === "canyon" || id === "volcano" || id === "glacier") {
      near.fillStyle(night ? 0x26374a : theme?.scenery ?? 0x743e35).fillTriangle(x, 670, x + 85, y, x + 160, 670);
      near.fillStyle(0xf0e5ce, 0.22).fillTriangle(x + 85, y, x + 104, y + 65, x + 62, y + 56);
    } else {
      near.fillStyle(night ? 0x102b30 : 0x244c3b).fillRect(x + 78, y + 10, 13, 210);
      near.fillStyle(night ? 0x1d4142 : 0x36755b).fillTriangle(x + 5, y + 165, x + 85, y - 35, x + 165, y + 165);
      near.fillStyle(0xaad59a, night ? 0.06 : 0.2).fillTriangle(x + 5, y + 165, x + 85, y - 35, x + 60, y + 165);
    }
  }
}
