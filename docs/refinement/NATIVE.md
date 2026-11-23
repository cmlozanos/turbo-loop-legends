# Turbo native refinement — 23 November 2026

## Authority / ownership

Approved: original native scene depth/material/light/car/background day-night and
child-readable loop/ramp/landing camera, bounded corrective recovery fixes,
common handwriting, no new controls/mechanics/dependencies/paid assets/heavy FX.
Direct shared checkout. No commit/push. `public/family-v2/*` changes belong to main;
this pass neither authored nor reverted them. Cache configuration/publication and
main's server 4177 are untouched. Playwright used its own port 4173, one worker.

## Native changes

- `src/game/scenery.ts`: three original static vector parallax layers; ridges with
  lit/shaded faces, clouds, tree/building/rock silhouettes by circuit, sun vs moon,
  craters and stars; redraw only on appearance/resize. No textures downloaded.
- `src/game/GameScene.ts`: track extrusion/highlight, steel supports, soil strata,
  landing reflector strips aligned to actual surfaces; cached machined/treaded
  wheels; suspension coil detail follows the real wheel joints; ground-aligned
  shadow (suppressed in guided loops); night head/tail lights. Fixed finish flag
  columns previously painted on the same x coordinate.
- `src/game/sceneView.ts` + scene: center the loop instead of chasing its orbit;
  speed-sensitive horizontal anticipation, jump/ground midpoint and adaptive
  zoom. Short landscape uses wider framing and lowered focus to avoid the top
  HUD and bottom controls; zoom restores slowly on landing, widens immediately
  on takeoff. Physics, car constants and track geometry are unchanged.
- Recovery correction: inversion inside an active guided loop is not a stall.
  Real stalls still recover after the existing threshold. Physical fall recovery
  now produces the existing retry feedback once (previously silent).
- `src/game/appearance.ts`, `src/learning-gate.d.ts`, `src/main.ts`: common getters
  and event, optional-getter fallback during propagation; native/local and system
  motion preferences compose. Decorative dust, debris and shakes stop live;
  existing particles/fragments are cleared. Driving, suspension, wheel rotation,
  turbo state feedback and essential camera tracking continue.
- `src/styles/main.css`: no alternative native font families; use common family
  through `--turbo-font`, set from `FamilyV2.fontFamily`. Race start already awaits
  `FamilyV2.fontReady`. All Phaser text uses that family. Showroom floor material;
  no-motion native transitions; short-screen checkpoint toast moved away from
  the looping. `Turbo` and `km/h` labels use normal case; aria labels unchanged.

## Verification (local, no device certification)

- `cmlscode route src`: TypeScript/JavaScript + Web Platform MDN.
- Targeted Vitest: sceneView, sceneTiming, frameClock, driving, physics, state,
  audioGate — **86/86**. 34 compatible pairings × 8 initial/checkpoint starts =
  **272 routes** using actual car motor/air control/turbo, finite poses, last
  checkpoint and finish. Negatives retain required turbo, incompatible obstacles,
  loop lost contact and reverse reentry. Actual scene timing 10–120 FPS unchanged.
- New regressions: loop focus, airborne anticipation/reverse, optional/common
  appearance getters + system/local reduction; inverted guided loop vs true stall;
  physical recovery callback exactly once.
- Playwright production build, no retries, one worker: family-v2, performance and
  native appearance (excluding long drives), desktop Chromium + tablet WebKit:
  **22/22**. Pauses/gates/Home, audio OFF reload, unlocked fleet, settings/quality
  persistence, rotation, resource reuse, native theme, DOM/Phaser common fonts,
  pointer driving with manual motion OFF. Tablet and 750×342 screenshots.
- Final initial-scene workload: **3,185 triangles/frame**, **4 draw calls/frame**
  Chromium; **5** WebKit. Existing <9,000 geometry guard remains intact.
- Real-time browser drives use held ArrowRight + Shift, no position/clock/physics
  overrides. Mamut/Fábrica at 750×342 light mode and Titán/Bosque at 1024×768
  normal mode: both full and incomplete loop IDs observed, first ramp flight and
  landing observed, all 7 checkpoints, finish x≥586, zero reappearances. Actual
  camera world bounds sampled throughout; replay and manual reset verified.
- Build runs TypeScript + Vite/PWA. Existing warnings: classic scripts, public CSS
  resolved at runtime, >500 kB engine chunk. No new libraries or public assets.
- Static Chrome95 runtime check green; no claim of this pass running Chrome95.

## Failures found / bounded fixes

First browser pass exposed diagnostics being read before dust creation: made
that diagnostic lifecycle-safe. Real Mamut flight then exposed camera clipping at
apex and descent: expanded vertical bounds, framed jump midpoint, widened zoom and
restored it gradually. Rechecked against actual camera bounds, not only images.
Typography/motion test initially sent keyboard input while focus remained in the
family settings shadow root: changed to real pointer hold on the native throttle,
not bypassing the input guard. A later test read snapshot during async scene load:
wait for snapshot before inspecting. Failed attempts are not counted as passes.

## Limits / handoff

Not Android/Tab4 physical, not FPS/latency/GPU/power certification, not human child
acceptance. Wider short-screen view trades vehicle size for visible ramps/landing;
review that balance on the real favorite tablet. Vector art is richer layered 2D,
not photorealistic 3D. Full eight-circuit browser journeys not run; the compatible
matrix covers physics without render, and two heavy-car browser journeys cover
real rendering/input. No new mechanics introduced. No kit/cache/publication edits,
no Git delivery by explicit task scope. Main owns final integration and publish.

Selected local screenshots are in this directory; intermediate task-only browser
outputs are removed after selecting evidence. No traces/videos or generated build
outputs should be added to Git.

## Final commands / evidence revisions

```sh
npm test -- tests/sceneView.test.ts tests/sceneTiming.test.ts tests/frameClock.test.ts tests/driving.test.ts tests/physics.test.ts tests/state.test.ts tests/audioGate.test.ts
npm run test:e2e -- tests/e2e/refinement.spec.ts tests/e2e/performance.spec.ts tests/e2e/family-v2.spec.ts --grep-invert 'natural inputs' --project=desktop --project=tablet --workers=1 --retries=0 --output=test-results/turbo-native-final
npm run test:e2e -- tests/e2e/refinement.spec.ts --grep 'natural inputs' --project=desktop --workers=1 --retries=0 --output=test-results/turbo-driving-final
npm run test:e2e -- tests/e2e/refinement.spec.ts --grep 'native day/night' --project=desktop --project=tablet --workers=1 --retries=0 --output=test-results/turbo-font-final
npm run test:e2e -- tests/e2e/refinement.spec.ts tests/e2e/game.spec.ts --grep 'mammoth natural inputs|opens the garage and starts a race' --project=desktop --workers=1 --retries=0 --output=test-results/turbo-labeled-final
npm run verify:chrome95
git diff --check
```

The final label pass is independently verified after the 22-test integration:
**2/2** Chromium/WebKit common-font/appearance tests, including manual OFF then ON
and system reduced-motion separately, continued native pointer driving, Home and
`Turbo`/`km/h` assertions. All 18 sampled DOM computed fonts are `Family School,
cursive` (browser quoting differs); document font load is confirmed and every
native Phaser Text reports `Family School`. Digits belong to the same font; their
shape is not evidence of a fallback. The retained Titán driving images predate
only the text-case adjustment; Mamut driving images are refreshed after it.

Both final long drives passed with no retries: Mamut 39.8 s test duration,
314 sampled positions, max height 13.91 m; Titán 40.5 s, 274 positions, max height
10.83 m. Both x≥586, seven checkpoints, two observed loop IDs, ramp flight +
landing and **zero respawns**. These are deterministic held player inputs, not
claims that an unaided child will choose those inputs.

Final refreshed-label Mamut + garage smoke: **2/2 passed**, no retries. Mamut
38.6 s, 349 samples, max height 13.90 m, zero respawns. Selected imagery retained
(about 2.2 MiB, no traces/videos); the seven task-owned browser output directories
were removed after selecting evidence. Pre-existing test-results and dist remain.

## Additional explicit play-feel pass
User23November2026 confirmed deeper Turbo quality/gameplay/professionalism and explicitly requested LOCAL validation, GitHub only web publication. No remote jobs are used as acceptance after this instruction.

Sources newly searched/opened: Phaser Cameras concepts (follow smoothing/offset/deadzone), Phaser issue7352 (frame-dependent follow caveat), GDevelop Car2DPhysics MIT example (physics/parallax/button feedback). These are patterns, not borrowed code/art or a new engine. Existing delta-normalized camera lerp retained. Chosen measured refinement: dynamic framing uses actual nearby loop radius/airborne height, not constant850pxworld span on every short screen; normal-road vehicle larger while looping/landing stays in frame. Alternate permanent zoom-out retained as previous baseline, not selected because it made the car tiny. Local natural-input camera-bound tests decide acceptance.

Input correctness: independent keyboard/key aliases and each pointer now aggregated; releasing one cannot cancel another held input. Blur/pagehide clear all and destroy removes native listeners.36unit regressions written RED(19failures)/GREEN plus browser mixed-source guard. No physics or extra buttons.

Local-only delivery: removed browser-test installation/execution from GitHub Pages workflow; it now installs build dependencies, builds and publishes only. Home's separate remote test workflow removed under the same explicit user instruction; local Make/test commands remain intact. No guard removed from local checks.

Further local acceptance:127unit tests pass, including36new input-source regressions.4native browser tests pass with final camera: Mamut/Titán both loops,flight,landing,7checkpoints,finish,0respawns; mixed touch+keyboard. Responsive controls/Home focused3/3 at320×640,740×360,1280×800,800×1280:single sharedHome, native duplicate removed; all visibleHUDbuttons within viewport and≥44px. Utility/drive controls sized from short edge (vmin), not width; flat shortscreen car larger, zoom widens only near actual loops/airtime. Loop circle framed between HUD/controls after local screenshot-based iteration. No physicalTab4 certification and no claim of no possiblebugs.

Single Home follow-up explicitly requested: removed native garage/race house buttons; only common Home remains and returns to native garage. Shared kit suppresses marked duplicate buttons in other games while mounted (IDs/listeners preserved). Drive/utility/Turbo controls now sized from short edge with≥44pxhit area; four portrait/landscape dimensions checked. Final local navigation/controls tests repeated against propagated shared kit, not GitHub jobs. Existing pause dialog Garaje action remains contextual text, not another always-visibleHomeicon.
