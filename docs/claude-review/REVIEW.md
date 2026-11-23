# Claude review and Unreal-style research —23 November2026

## Scope and attribution
Reviewed Claude coauthored3be3ed7/9806f6b against2e045f3, actual docs/source/assets, local models/build and browser. No private Claude chat inspected and no claim of knowing Claude's tools beyond committed source. Initial tree clean, main ahead2oforigin. GitHub only publication, not validation.

## Engine finding
Not Unreal Engine. package.json/runtime use Phaser4.2.1+Planck1.4.2, TypeScript/Vite. No .uproject/.uasset/Unreal build source or PixelStreaming client/server. tools/build-car-art.py authors SVGs and existing PNG sprites use baked-style gradients/reflections. This is authored2D lighting and toy-car studio presentation, not UE/Lumen/PBR runtime or evidence assets were rendered in Unreal.

## Visual result
Meaningful improvement from prior native pass: six consistent640×300body sprites, metallic-style paint, distinct glass/rims/lights, hero showroom and capability bars, raceHUDdepth, static sunhaze/parallax and distinct roadside props. School font and singleHome retained. Local screenshotreview garage750×342 and race tablet; native tests confirm font family, offline, silence, viewport rotation and modes. Remains stylized side-on2D, not photorealistic3D or visual parity with an Unreal demonstration. Light profile intentionally rasterizes below native resolution; screenshot softness is not evidence of GPUperformance.

## Blocking issue corrected before upload
P1physics springboard rearmed between front/rearwheel contact, double-boostingComet/Moon-3 and causing extra fall. Existing nofall test failed169/170 on initial tree. Added focused oneactivation regression(RED), latched activatedboard until chassis leaves horizontalspan. Removing accidental doublelaunch also exposedTitan/Volcano1landing on next ramp lip; added6mclearance only to that authoredlaunch and retained nofallassertions. Added explicitTitanregression. Attempted universal verticalvelocity reset was rejected after14existingroutefailures; not included. Final local check172tests plus TypeScript/build/cache/PWA/static95/learninggate pass. All compatible car/trackcheckpoint guards retained.

Loops remain assisted circular guides with contact loss/blending; springboards/pads prescribe launch/boost. This is intentional accessible arcade design, not entirely unconstrained vehicle simulation.

## Online research read, with tradeoffs
- https://dev.epicgames.com/documentation/en-us/unreal-engine/performance-guidelines-for-mobile-devices-in-unreal-engine : lighting tiers, fastestLDR/unlit and fake/staticlighting; author for target hardware.
- https://dev.epicgames.com/documentation/en-us/unreal-engine/using-lumen-global-illumination-on-mobile-in-unreal-engine : experimentalLumen requires highendAndroidVulkanSM5, not a Tab4assumption.
- https://dev.epicgames.com/documentation/en-us/unreal-engine/pixel-streaming-in-unreal-engine : UE runs on desktop/server, frames/inputsWebRTC. This is online service infrastructure, incompatible with existing offline staticPages contract without a new decision/cost/access scope.
- https://docs.phaser.io/phaser/concepts/textures : sharedtexture/atlas frames and mobiletexturelimits; candidate for future measuredbatching.

Recommended next visual phase (not implemented/approved by this review): consistent directional lighting+contactshadows baked into environment props matching carart; offline-authored layered scenery and lowresolution material detail; atlasPOC measuring drawcalls/memory before adoption. Preserve silhouettes/roadcontrast, boundedfeedback and reducedmotion. Compare equalviewport screenshots and actualdeviceframetime, not enginebranding. Alternative UE-native/streaming is a separate product/platform project, not a drop-in CSS upgrade. No new engines/services/costs provisioned.

## Limits
No physicalGalaxyTab4,actualChrome95 thispass,allhumaninputs or no-bug guarantee. Oldengineverifier is static only. Browser30checks currentChromium+WebKit includes naturalMamut/Titanloop/ramp/landingroutes. Correctedphysics final rerun recorded separately. Existing classic-script/largePhaserchunk warnings retained, not hidden.

Final fixed-runtime local browser5/5:two real-inputheavycarfullraces,alllooptypes,flight/landing,0respawns;singleHome+responsivecontrols+linkedfonts+themes+mixedinputs. Pre-fix30browserchecks were valid for unchangedvisual/controlsource, supplemented not substituted by final5physicsjourneys. Self-evaluation:accuracy4,completeness4,clarity4,actionability5,concision4;futuredeviceframetime and further cinematicart require measuredPOC/approval,not claimsofUnreal.
