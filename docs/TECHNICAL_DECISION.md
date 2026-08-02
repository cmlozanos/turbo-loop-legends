# Decisión técnica

## Contexto

Juego 2D lateral, mobile-first, instalable y sin conexión, con un coche físico que debe superar saltos y loopings incompletos.

## Opciones evaluadas

| Opción | Ventaja | Coste o riesgo |
| --- | --- | --- |
| Phaser 4 + Planck | Escenas, cámara, audio e input completos; `WheelJoint` y cadenas Box2D | Sincronización manual física-render |
| Phaser 4 + Matter | Integración nativa y prototipo rápido | Suspensión basada en constraints y más ajuste en loopings |
| PixiJS + Planck | Render y física sólidos | Hay que construir escenas, cámara, audio y flujo |
| Godot Web | Editor y motor completos | Exporta WASM/GDScript, no HTML+JS; más peso y restricciones web |
| Three/Babylon | Motores 3D profesionales | Sobredimensionados para un juego 2D |

## Decisión

Se fijan **Phaser 4.2.1** y **Planck 1.4.2**. Phaser cubre la infraestructura del juego y Planck aporta suspensión, motor y colisiones continuas adecuadas para la pista. Planck 1.5.0 se descartó empíricamente porque exige Node 24; 1.4.2 conserva las APIs necesarias y es compatible con Node 20.

## Evidencia y PoC

`make physics-poc` ejecuta el circuito físico sin renderizado. Verifica que el coche avanza, salta, mantiene cuerpos finitos y puede reaparecer de forma estable. Las pruebas automatizadas validan además la geometría parametrizada.

Fuentes oficiales:

- <https://github.com/phaserjs/phaser/tree/v4.2.1>
- <https://docs.phaser.io/phaser/concepts/physics/matter>
- <https://github.com/piqnt/planck.js/blob/master/example/Car.ts>
- <https://github.com/piqnt/planck.js/blob/master/docs/pages/joint/wheel-joint.md>
- <https://github.com/piqnt/planck.js/blob/master/docs/pages/shape/chain.md>
- <https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages>

## Riesgos mitigados

- Phaser 4 es reciente: versión exacta y pruebas visuales en varios viewports.
- Orientación no bloqueable en todos los navegadores: pantalla clara para girar el dispositivo.
- Audio con autoplay bloqueado: se inicia desde el primer gesto.
- GitHub Pages usa subruta: `base` fijo y prueba del artefacto final.
