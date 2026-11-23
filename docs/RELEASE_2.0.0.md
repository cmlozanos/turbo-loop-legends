# Turbo Loop Legends 2.0.0

## Alcance autorizado

Integración del kit familiar clásico local y corrección de mecánicas reproducibles, sin modificar su fuente compartida ni otros repositorios. Versión de paquete y lockfile 2.0.0; sin tag coordinado ni despliegue manual.

Los seis coches y ocho circuitos están disponibles sin borrar el almacenamiento v1. Se conservan selección, progreso, ayudas y preferencia explícita de calidad. El modo ligero sigue siendo el default. Música y sonido se reinician a OFF en cada carga; no se crean recursos de audio mientras estén apagados.

## Integración

`index.html` carga `./family-v2/family.css?v=2.0.0` y el script clásico equivalente, con `data-game="turbo-loop-legends"`. Inicio usa `showGarage` y no navega fuera; el catálogo queda tras el acceso adulto. La barra vive fuera de las pantallas que se ocultan durante la carrera. Los nodos con `data-family-setting` se mueven al host como light DOM mediante slots: mantienen listeners, CSS y búsqueda por ID.

`FamilyV2.register({pause,resume,home})` congela escena, input, temporizadores del gate y audio. Registra por separado la propiedad de pausa familiar y educativa; un cierre de Adultos no cancela una pausa manual o un reto. La guarda PRE_STEP cubre las escenas que terminan de cargar ya bloqueadas.

Cada checkpoint y meta otorga un punto mediante `award` con un ID por carrera/evento. `touch` marca el inicio de carrera; el kit mantiene la sesión local de una hora y deduplicación. `fontReady` precede al inicio de escena y `fontFamily` se usa en las señales canvas. El arte canvas conserva su paleta; los menús DOM consumen los tokens de tema compartidos.

Workbox incluye TTF y `family-v2/OFL.txt`; las verificaciones comprueban copias exactas en dist y precache. El sincronizador educativo existente se contrastó con el canónico: se mantienen las guardas adicionales locales de procedencia PNG y precache sin duplicados.

## Validación y límites

- TypeScript, persistencia, audio apagado/gate, reloj fijo, escena y física: checks focales.
- PoC de física sin render: meta en 37,83 s, cuerpos finitos, último checkpoint y ninguna reaparición; no equivale a una carrera táctil humana.
- Build y verificadores de cache busting, PWA, Chrome 95 estático y bundle educativo.
- Navegador: pruebas focales V2, garaje/carrera, pausas y rendimiento. Chromium desktop: 30 pasados y 1 omitido (guía exclusiva iOS). Carrera real Mamut/Fábrica hasta meta y reinicio: 41,4 s de prueba de navegador.
- No se certifican FPS ni callouts nativos en Android físico, compatibilidad real en Chrome 95 sin binario, instalación en tablet o aceptación humana. Sin tag de release en este trabajo.

## Reproducir

```sh
make check-gates
npm run typecheck
npm test -- tests/state.test.ts tests/audioGate.test.ts tests/frameClock.test.ts tests/sceneTiming.test.ts tests/physics.test.ts
npm run poc:physics
npm run build
npm run verify:cache && npm run verify:pwa && npm run verify:chrome95 && npm run verify:learning-gate
npm run test:e2e -- tests/e2e/family-v2.spec.ts tests/e2e/game.spec.ts tests/e2e/performance.spec.ts --project=desktop --workers=1
```

## Mecánicas corregidas y evidencia

La ampliación de alcance autoriza corregir física defectuosa. La matriz inicial con `car.motor` real falló en 11 de 34 combinaciones compatibles: los tests previos forzaban throttle=1. El turbo acumulaba motor reducido y factor de velocidad reducido en Titán/Mamut, que chocaban con bordes de aterrizaje o caían repetidamente. Ahora el turbo garantiza la velocidad diseñada mínima, manteniendo aceleración normal, par, agarre, frenada y control aéreo diferenciados.

Una segunda PoC inició cada coche compatible en cada checkpoint. Las 34 combinaciones se atascaban al reaparecer en el checkpoint 5: estaba en el vértice del aterrizaje del looping roto, con ruedas intersectando el borde. Se desplaza 5 m sobre la plataforma y se calcula su altura desde la superficie real.

`tests/driving.test.ts`: 34 tests, cada uno ejecuta salida y los siete checkpoints (272 recorridos) con motor, inclinación y turbo del coche real. Todos alcanzan meta y último checkpoint en menos de 65 s simulados con poses finitas. Se conservan los negativos de turbo necesario, obstáculos incompatibles y pérdida de contacto/reentrada marcha atrás del looping. La matriz no es una certificación de todas las secuencias posibles de input humano.

También se evita que escribir la respuesta adulta active aceleración, turbo o reset por teclado. El reto educativo cierra un diálogo adulto abierto para no quedar tapado por la top layer nativa. Las pruebas de navegador cubren pausas superpuestas y regreso al menú sin navegación.

Resultados locales del 23-11-2026: 82 tests focales de modelo verdes; `make check` obligatorio: 86 tests verdes (incluye referencia histórica); PoC de conducción 34/34 compatibles, incluidas las 272 salidas/recuperaciones de regresión. En Chromium desktop: controles teclado/touch sostenido, colisión/rotura, reset, meta real, replay, siguiente pista, guardas educativas tardías y fail-closed, menú nativo misma URL, settings, audio OFF tras recarga, tema y puntos, offline y rendimiento. Carga geométrica observada: 2.452 triángulos/frame y 5 draw calls/frame en el circuito inicial, no FPS de tablet. Inspección visual del garaje desktop y controles adultos en 640×360/750×342; rotaciones canvas 1024×768, 768×1024 y 1920×1080.

Validación responsive adicional: 22/22 pruebas focales verdes en los perfiles WebKit tablet y phone (shell, pausas, ajustes, rotación, calidad, render y edición táctil). El helper de touch usa un Event cancelable para verificar el listener, pues WebKit rechaza construir TouchEvent; el hold/release real por CDP se verifica por separado en Chromium. No equivale a un dispositivo iOS físico. Un intento inicial de phone rotación no encontró el gate (causa no establecida); la ejecución aislada posterior pasó sin reintento. El diálogo adulto corto permite desplazamiento interno para llegar a reiniciar puntos.
