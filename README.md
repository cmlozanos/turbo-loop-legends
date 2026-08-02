# Turbo Loop Legends

Videojuego 2D de coches para navegador, pensado primero para tablet y niños de 4 a 6 años. El circuito combina suspensión física, saltos, un looping completo, un looping de madera incompleto, checkpoints y tres coches desbloqueables.

## Jugar

- Tablet o móvil: usa los botones grandes. El izquierdo frena o da marcha atrás, el derecho acelera y el botón central activa el turbo. En el aire también inclinan el coche.
- Ordenador: `→`/`D` acelera, `←`/`A` frena y da marcha atrás, `Shift`/`Espacio` activa el turbo, `R` vuelve al checkpoint y `Esc` pausa.
- Las ayudas opcionales corrigen suavemente el coche y lo recuperan si queda volcado o cae.

El juego guarda ajustes, coche elegido y desbloqueos únicamente en el dispositivo. Después de la primera carga puede funcionar sin conexión.

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
- Arte original: carrocerías vectoriales en `public/cars/*.svg` y versiones PNG transparentes optimizadas para Phaser.

El nivel vive en `src/game/track.ts` como una definición declarativa de rectas, arcos y checkpoints. Los loopings usan una guía circular arcade para evitar colisiones fantasma en la intersección de la pista y conservar una experiencia predecible en pantallas táctiles.

La comparativa y decisión técnica están en [`docs/TECHNICAL_DECISION.md`](docs/TECHNICAL_DECISION.md).

## Publicación

Cada push a `main` ejecuta los checks y publica `dist/` en GitHub Pages mediante `.github/workflows/pages.yml`.

## Licencia

MIT. Consulta [`LICENSE`](LICENSE).
