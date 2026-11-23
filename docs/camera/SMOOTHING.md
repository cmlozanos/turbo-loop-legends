# Camera discontinuities and low-cost cinematic direction

User asked to continue improving brutal transitions; local validation only. No engine migration authorized by this question.

## Reproduced cause
Hard switch to loop centre at radius+10 and instantaneous zoom-out to a new span. Added boundary regression: failed old code, passes smoothstep influence. Focus now blends over24worldmetres and zoom anticipates32metres before full framing. Zoom bounded both directions with timestamp-based smoothing; no launch/landing/obstacle screen shakes. Resize fits current geometry, not always flat-road span. Physics/art/assets/font unchanged.

Local check174unit tests/build/PWA/static95/learninggate green; first five natural browser tests passed full Mamut/Titan loops/flights/landing/finish,0respawns. Added rendered-frame zoom/shake sampling to avoid100ms polling hiding single-frame jumps; final result appended below. PhysicalTablet comfort remains unmeasured.

## Proposed visual alternative (not implemented by this camera fix)
2.5D pre-rendered art: offline3D-authored car/environment sprites with consistent light direction, baked ambient occlusion/material reflections, layered parallax scenery and cheap ground-contact shadows. Keep live2Dphysics, localPWA and schoolfont. Runtime cost moves from real-time lighting to texture memory/download; atlas limits, culling, transparentoverdraw and deviceframetime must be measured. Existing Claude art is already2Dhand-authored baked-style shading, not an actual3Drender pipeline. Full cinematicquality needs an art pass, not enginebranding.

Alternatives: low-poly real-time3D with bakedtextures adds camera/depth but biggerengine/GPUcost and gameplaymigration; UnrealPixelStreaming runs remotely and requires continuousconnection/servercost, incompatible with offline contract unless user explicitly changes it. No guarantee of Unreal-level realism on Tab4.

Sources checked23November2026:
https://docs.phaser.io/phaser/concepts/cameras (follow/lerp/zoom)
https://dev.epicgames.com/documentation/en-us/unreal-engine/performance-guidelines-for-mobile-devices-in-unreal-engine (unlit/staticfake lighting vs costly postprocess)

Final local rendered-frame acceptance:5/5browser tests, including frame-by-frame zoom limits and no active shake throughout both real-input heavycar journeys. Both loops,flight,landing,7checkpoints,finish,0respawns;existing containment guard retained. Final camera model/scene tests9/9; full174unitcheck earlier samephysics plus current TypeScript/build exercised by browserproductionbuild. No physical comfort/latency certification. Resize geometry-fit deliberately separate from continuouszoom limits; no claim all rotations in midair sampled.
