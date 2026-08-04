# Turbo Loop Legends

Videojuego 2D de coches para navegador, pensado primero para tablet y niños de 4 a 6 años. Incluye ocho circuitos con gravedad, agarre, suspensión, rampas, precipicios, saltadores y obstáculos de capacidad, además de seis coches con tamaños, ruedas y comportamientos diferentes.

## Jugar

- Tablet o móvil: usa los botones grandes. El izquierdo frena o da marcha atrás, el derecho acelera y el botón central activa el turbo. En el aire también inclinan el coche.
- Ordenador: `→`/`D` acelera, `←`/`A` frena y da marcha atrás, `Shift`/`Espacio` activa el turbo, `R` vuelve al checkpoint y `Esc` pausa.
- Las ayudas opcionales corrigen suavemente el coche y lo recuperan si queda volcado o cae.
- El botón `⌂` vuelve al garaje durante una carrera para cambiar de coche o circuito.
- Al cruzar la meta puedes iniciar inmediatamente el siguiente circuito. Las rocas y pilas de neumáticos se saltan; las cajas y barreras se rompen con suficiente velocidad.
- Cada circuito incluye un megasalto amarillo marcado `⚡ TURBO`: su precipicio está calculado para que la velocidad normal no alcance el otro lado.
- Los loopings conservan el impulso real del coche: acelerador, gravedad y rozamiento modifican su velocidad, puede desprenderse si pierde contacto y puede volver a recorrerlos marcha atrás.
- Antes de la primera carrera se resuelve una suma aleatoria con sumandos y resultado inferiores a 10. Tras una hora de sesión se solicita otra cada cinco minutos; desde las 23:00 se aplica directamente esa cadencia de cinco minutos.

El juego guarda ajustes, coche, pista elegida y desbloqueos únicamente en el dispositivo. Después de la primera carga puede funcionar sin conexión.
En una instalación nueva, música y efectos de sonido comienzan desactivados y pueden habilitarse desde el garaje.

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
make build
make check
make preview
```

## Arquitectura

- Phaser 4.2.1: renderizado, cámara, escenas, partículas y escalado.
- Planck 1.4.2: chasis, ruedas, suspensión, motor, colisiones y reaparición.
- Vite + TypeScript: aplicación web estática.
- PWA: caché offline e instalación en pantalla de inicio.
- Vitest + Playwright: geometría, física, persistencia y pruebas responsive.
- Arte original: ilustraciones SVG autónomas para el garaje, carrocerías vectoriales y versiones PNG transparentes optimizadas para Phaser. Las ruedas, suspensiones y el fuego del turbo se sincronizan con la física durante la carrera.

Las ocho pistas viven en `src/game/track.ts` como definiciones declarativas de rectas, arcos, checkpoints, aspecto y comportamiento físico. Cada una combina radios de looping, aberturas, perfiles de rampa y distancias de salto diferentes; el selector muestra un minimapa de su geometría real. Los loopings usan una guía circular arcade derivada de cada diseño para evitar colisiones fantasma y conservar una experiencia predecible en pantallas táctiles.
Las rampas, zonas sin suelo y plataformas impulsoras también se parametrizan en esa definición. La altura de cada saltador se deriva de la superficie real de su pista y aplica impulso vertical y horizontal al vehículo articulado completo, mientras los checkpoints admiten cruces a gran velocidad sin guardar caídas dentro de un precipicio.

La comparativa y decisión técnica están en [`docs/TECHNICAL_DECISION.md`](docs/TECHNICAL_DECISION.md). La investigación de referencias y sus límites de originalidad están en [`docs/VISUAL_DIRECTION.md`](docs/VISUAL_DIRECTION.md).

## Publicación

Cada push a `main` ejecuta los checks y publica `dist/` en GitHub Pages mediante `.github/workflows/pages.yml`.

## Licencia

MIT. Consulta [`LICENSE`](LICENSE).
