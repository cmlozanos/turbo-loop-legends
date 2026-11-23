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


## Seguimiento de entrega del shell canónico (23-11-2026)

Autorización de este seguimiento: entregar en `origin/main` personal únicamente
`public/family-v2/family.js`, `public/family-v2/family.css` y esta ampliación de
evidencia; sin tag, release ni despliegue manual. Base nativa: `60372e9`.
El estado inicial contenía exactamente los dos archivos públicos modificados,
sin cambios staged ni archivos nuevos. No se modificaron motor, física, tests,
configuración ni herramientas; se preservan sus guardas existentes.

La copia canónica incorpora cierre del diálogo adulto al bloquear el reto
educativo, aislamiento de keydown/keyup del shadow root, autoridad de cookies
tras fallo de escritura local por cuota, actividad de teclado y arrastre con
botón pulsado (escrituras limitadas a una por segundo) y fuente compartida del
reto educativo. Los cuatro assets del kit se compararon byte a byte contra
`home/family-v2` y contra `dist/family-v2`; TTF y OFL no cambiaron.

| Asset | SHA-256 | Revisión precache generada |
| --- | --- | --- |
| `family.js` | `132e25722a47d5e25873ca797ed1da1863844dcc4c534707ab29637894597979` | `a0f042db45194ab2845111f1548852b3` |
| `family.css` | `009a33513729b92e8794d2fdbc00f46d8831099bf985226b714f89ff83d8e308` | `7f84e5f46620871ed5b0f20aef1716d5` |
| `playwrite-es.ttf` | `512476f9454e976560fe7bde2896d7541a0ff3e1ea0a5fa97a543009f7e38921` | `17163819cb80b53d17694b8e1ddb438c` |
| `OFL.txt` | `0370f5946020846b0ca65e44950d11411ea3bd3c4c0d755916470f9f96cd8cb8` | `c52d90e0197917866883195a349a376f` |

Validación local de este seguimiento, todos los comandos con salida 0:

- `make check-gates`: perfil, gate, 100 palabras/imágenes, procedencia SHA-256
  y presupuesto de imágenes (935.825 bytes), sin sincronizar ni sobrescribir.
- `npm run typecheck` y `npm run build`: correctos; 146 entradas precache.
- `npm run verify:cache`, `npm run verify:pwa`, `npm run verify:chrome95` y
  `npm run verify:learning-gate`: correctos. Se mantienen procedencia PNG,
  carga educativa local/ordenada, copias exactas y precache sin duplicados.
- Comprobación adicional con Node/assert: cada asset familiar tiene exactamente
  una entrada precache cuya revisión coincide con el MD5 de sus bytes. Las
  revisiones JS/CSS cambiaron respecto a `60372e9` automáticamente; TTF/OFL
  conservaron revisión. No se cambió la configuración PWA.
- `npm run test:e2e -- tests/e2e/family-v2.spec.ts --project=desktop --project=tablet --project=phone --project=chrome95 --workers=1 --retries=0`:
  **16/16 pasados**, sin omitidos ni reintentos (42,3 s). Cubre fuente cargada,
  seis coches/ocho pistas, settings trasladados, audio OFF tras recarga, pausa
  familiar/manual/educativa, deduplicación/caducidad de puntos, tema nativo y
  teclado adulto sin acelerador atascado. Tablet/phone usan WebKit.
- `npm run test:e2e -- tests/e2e/game.spec.ts --grep 'reopens after the network is disconnected' --project=chrome95 --workers=1 --retries=0`:
  **1/1 pasado**, sin reintentos (16,8 s); recarga offline y resolución real del
  reto desde el artefacto de producción.

Para ambos comandos con `chrome95`, se usó `CHROME95_PATH` apuntando al binario
existente indicado para la tarea. `browser.version()` confirmó
**95.0.4630.0** antes de ejecutar la integración mediante el proyecto condicional
ya existente; no se descargaron navegadores ni dependencias.

Límites: esta evidencia amplía la validación estática anterior con integración
nativa real en Chromium 95 de escritorio, no en Android físico. No se repitió la
matriz de física: fuentes, entradas y tests nativos permanecen en `60372e9`.
Las pruebas del shell canónico comunicadas en el relevo (10 modernas/WebKit y
5 en 95) no se cuentan como ejecutadas aquí; esta suite tampoco constituye una
prueba focal nueva de todos los escenarios de cuota/actividad continua.
No se certifica inspección visual humana nueva, instalación en tablet, FPS ni
aceptación humana. Vite emitió avisos por scripts clásicos, CSS público resuelto
en runtime y tamaño de chunk; copias y guardas del build pasaron. El push a main
activa el workflow Pages ya existente; su despliegue no queda certificado por
estos checks locales. La coordinación de tag/release queda fuera del seguimiento.
