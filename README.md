# Turbo Loop Legends

Videojuego 2D de coches para navegador, pensado primero para tablet y niños de 4 a 6 años. Incluye ocho circuitos con gravedad, agarre, suspensión, rampas, precipicios, saltadores y obstáculos de capacidad, además de seis coches con tamaños, ruedas y comportamientos diferentes.

## Jugar

- Tablet o móvil: usa los botones grandes. El izquierdo frena o da marcha atrás, el derecho acelera y el botón central activa el turbo. En el aire también inclinan el coche.
- Ordenador: `→`/`D` acelera, `←`/`A` frena y da marcha atrás, `Shift`/`Espacio` activa el turbo, `R` vuelve al checkpoint y `Esc` pausa.
- Las ayudas opcionales corrigen suavemente el coche y lo recuperan si queda volcado o cae.
- El botón `⌂` abre [todos los juegos](https://cmlozanos.github.io/games/). Para cambiar de coche o circuito durante una carrera, pulsa pausa y después Garaje; también sigue disponible al terminar.
- Al cruzar la meta puedes iniciar inmediatamente el siguiente circuito. Las rocas y pilas de neumáticos se saltan; las cajas y barreras se rompen con suficiente velocidad.
- Cada circuito incluye un megasalto amarillo marcado `⚡ TURBO`: su precipicio está calculado para que la velocidad normal no alcance el otro lado.
- Los loopings conservan el impulso real del coche: acelerador, gravedad y rozamiento modifican su velocidad, puede desprenderse si pierde contacto y puede volver a recorrerlos marcha atrás.
- Cada apertura exige un reto aleatorio: suma, resta sin resultados negativos o trazo guiado de una letra. Los operandos y resultados son menores de 10. Se repite cada diez minutos desde la resolución, también de noche y contando el tiempo en otras aplicaciones. El coche, los temporizadores y el sonido se pausan; una pausa manual no se cancela al resolver el reto.

El juego guarda ajustes, coche, pista elegida y desbloqueos únicamente en el dispositivo. Después de la primera carga puede funcionar sin conexión.
En una instalación nueva, música y efectos de sonido comienzan desactivados y pueden habilitarse desde el garaje.

## Rendimiento en tablets antiguas

El ajuste ⚡ **Modo ligero** del garaje reduce la resolución interna y desactiva
polvo y algunos efectos decorativos. Conserva el tamaño de los controles, la
cámara, las pistas, las colisiones y el progreso. Se guarda en cada dispositivo;
el modo ligero es el valor inicial cuando no existe una elección guardada.
Una elección explícita de calidad normal o ligera se conserva, al igual que el progreso.

La física avanza a pasos de 1/60 s independientemente del renderizado: las pruebas
comparan trayectorias, aceleración, marcha atrás y recuperación entre 10 y 120 FPS.
La recuperación de un bloqueo prolongado está limitada a 250 ms por fotograma
(15 pasos), sin simular el tiempo pasado en pausa. Las ruedas reutilizan texturas
pequeñas y las piezas de pista fuera de cámara no se dibujan. El renderizado se
detiene detrás del garaje, las pausas y los retos; con sonido desactivado no se
crea el motor de audio.

`make test-performance` ejecuta las regresiones de reloj, cámara, resolución,
pausas y reutilización de texturas. La suite de navegador comprueba también
rotaciones y reanudación desde la recomendación de vehículo. Sus contadores de
render son mediciones de escritorio, no una certificación de FPS en Android 5.

## Instalar en una tablet

- Android/Chrome: pulsa `⬇ INSTALAR` cuando aparezca en el garaje.
- iPad/Safari: pulsa `⬇ INSTALAR` para recordar la ruta `Compartir → Añadir a pantalla de inicio`.

Una vez instalada, la app se abre en horizontal, sin la interfaz del navegador, y funciona offline después de su primera carga completa.

Cada despliegue incorpora su versión en los nombres de JavaScript, CSS, manifiesto e imágenes públicas. La PWA activa el nuevo service worker y recarga una pestaña existente una sola vez para evitar que mezcle archivos de versiones distintas.

## Desarrollo

Requisitos: Node.js 20 o superior y npm.

```bash
make install
make dev
```

Comandos disponibles:

```bash
make physics-poc  # Simulación completa hasta meta, sin render
make typecheck
make test
make install-e2e
make test-e2e
make test-performance
make build
make check
make verify-chrome95
make verify-learning-gate
make preview
```

Para ejecutar también las pruebas de interfaz en un Chromium 95 instalado, configura `CHROME95_PATH` con la ruta a su ejecutable al lanzar `make test-e2e`. La comprobación estática `verify-chrome95` no sustituye esta ejecución ni la prueba física en Android.

## Arquitectura

- Phaser 4.2.1: renderizado, cámara, escenas, partículas y escalado.
- Planck 1.4.2: chasis, ruedas, suspensión, motor, colisiones y reaparición.
- Vite + TypeScript: aplicación web estática.
- PWA: caché offline e instalación en pantalla de inicio.
- Compatibilidad: bundle dirigido a Chrome 95 para tablets Android antiguas, compartido con navegadores modernos.
- Retos educativos: copia autónoma de `home/learning-gate/gate.js` en `public/learning-gate.js`, versionada y precargada por la PWA. El módulo histórico `src/game/mathGate.ts` y sus pruebas se conservan como referencia, pero ya no se usan en la aplicación; su sesión anterior no desbloquea el nuevo sistema.
- Vitest + Playwright: geometría, física, persistencia y pruebas responsive.
- Arte original: ilustraciones SVG autónomas para el garaje, carrocerías vectoriales y versiones PNG transparentes optimizadas para Phaser. Las ruedas, suspensiones y el fuego del turbo se sincronizan con la física durante la carrera.

Las ocho pistas viven en `src/game/track.ts` como definiciones declarativas de rectas, arcos, checkpoints, aspecto y comportamiento físico. Cada una combina radios de looping, aberturas, perfiles de rampa y distancias de salto diferentes; el selector muestra un minimapa de su geometría real. Los loopings usan una guía circular arcade derivada de cada diseño para evitar colisiones fantasma y conservar una experiencia predecible en pantallas táctiles.
Las rampas, zonas sin suelo y plataformas impulsoras también se parametrizan en esa definición. La altura de cada saltador se deriva de la superficie real de su pista y aplica impulso vertical y horizontal al vehículo articulado completo, mientras los checkpoints admiten cruces a gran velocidad sin guardar caídas dentro de un precipicio.

La comparativa y decisión técnica están en [`docs/TECHNICAL_DECISION.md`](docs/TECHNICAL_DECISION.md). La investigación de referencias y sus límites de originalidad están en [`docs/VISUAL_DIRECTION.md`](docs/VISUAL_DIRECTION.md).

## Publicación

Cada push a `main` ejecuta los checks y publica `dist/` en GitHub Pages mediante `.github/workflows/pages.yml`.

## Licencia

MIT. Consulta [`LICENSE`](LICENSE).
