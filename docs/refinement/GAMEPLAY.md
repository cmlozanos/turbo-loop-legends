# Gameplay pass: physics, circuits and feedback — 23 November 2026

Applied on top of `2e045f3` (native refinement and control polish). No new dependencies or assets.

## Findings in the previous build

Measured with headless simulations of every compatible car on every circuit:

- **Only the turbo could finish.** Holding just the accelerator from any checkpoint
  after the mega jump failed in 149 of 294 runs: springboard flights depended on the
  entry speed and dropped slower cars onto the lip of the next ramp or into its gorge.
- **Loops teleported the car.** The guide captured the car 3.2 m before its entry
  point and placed it there in one step (largest single-step move: 3.49 m).
- **Every circuit shared one flat profile** between the same ramps and loops.
- All cars shared one 0.42 m physical wheel, so larger drawn wheels sank into the road.
- A turbo start reared up to about 43° and hopped, losing speed on the way down.
- The rear-wheel drive could leave a car beached on a ledge with the driven wheel in the air.

## Changes

- `track.ts`: per-circuit `relief` (hills, whoops and shallow dips, only inside flat
  stretches and never in the run-up to a ramp), `boostPads` on every ordinary ramp with
  a launch speed solved from the gap it serves, a designed `range` for every springboard
  (a hop when there is room, otherwise a leap over the next gorge), and `stars` on crests,
  jump arcs, loop tops and springboard flights. `surfaceAt` reports gaps as `undefined`.
- `physics.ts`: all-wheel drive (65/35), physical wheel radius equal to the drawn one with
  matching gearing, a stabiliser that follows the road slope on the ground and the flight
  path in the air with a wheelie limit, loop entry at the real crossing point with a
  0.18 s pose blend, wheels resting on the loop surface, deterministic springboards,
  boost pads and star collection. The snapshot gains `grounded` and `collectedStarIds`.
- `GameScene.ts`: roadside props per circuit (pines, cacti and mesas, neon signs, lava,
  antennas and craters, palms, ice, chimneys) drawn in camera-culled chunks, earthworks under hills, ramps and plateaus, dash arrows, glowing
  gorges, stars, landing dust/squash/shake, flame flicker, finish confetti, stunt events.
  Decorative motion still honours reduced motion and light mode.
- `main.ts`, `state.ts`, `main.css`, `audio.ts`: star counter under the speed, stunt
  toasts, best stars per circuit saved (`bestStars`) and shown on each track card, new tones.

## Verification

- Vitest: 170/170 (127 existing + 43 new in `tests/gameplay.test.ts`).
- Accelerator only, from checkpoints 1–7, all 34 compatible pairings: 238/238 finish
  with no fall (before: 149 of 294 runs failed, counting the no-car reference runs).
- Turbo held, from every checkpoint: 336/336 finish.
- Random child-like input (seeded, with the scene's stuck recovery): 136/136 finish,
  average respawns 1.9 → 1.3.
- Largest single-step move of the car over full turbo runs: 3.49 m → 0.53 m.
- Playwright on the container's Chromium (through the `chrome95` project slot, so at
  1024×768 desktop only): 34 passed, 1 skipped, 1 failed. The failure is
  `performance.spec.ts` "canvas stays aligned to the viewport after rotation" (canvas
  y = -18 after a portrait resize); it fails identically on an untouched `2e045f3`.
  Initial circuit 4,358 triangles and 6 draw calls per frame (guard: 9,000).

## Not verified

WebKit/tablet/phone projects, a real Chromium 95, any physical tablet, frame rate on
Android, and play by an actual child. Star positions follow nominal launch speeds, so a
full-turbo run collects roughly 60–80 % of them; that share was not tuned with players.

## Showroom pass (same day, on top of the above)

Scope requested: a modern-engine look for cars and interface with no cost on old tablets.

- New baked car art for all six cars (`public/cars`, generator in `tools/build-car-art.py`),
  one canvas and `bodyScale` for every car; in-game wheels redrawn as alloy rims.
- Garage hero stage with capability bars, relit cards, buttons, modals and race HUD
  (`src/main.ts`, `src/styles/main.css`); scene bloom, haze, ground gradient, turbo flame
  (`src/game/scenery.ts`, `src/game/GameScene.ts`).
- Fixed: the shared toolbar overflowed its fixed 190 px slot and shifted the whole page
  18 px sideways (dark strip on the right, clipped reset button). The game now reserves the
  toolbar's real width. This also fixes the rotation alignment test reported above.

Verification: `npm run check` green (170 unit tests, build, cache/PWA/Chrome 95 static/
learning-gate verifiers). Playwright on the container's Chromium at 1024×768: 35 passed,
1 skipped, 0 failed. Initial circuit 4,668 triangles and 6 draw calls per frame (guard
9,000). Visual inspection of garage (light, dark, 750×342) and race screenshots only in
that Chromium; not checked on WebKit, a real Chrome 95 or a physical tablet.
