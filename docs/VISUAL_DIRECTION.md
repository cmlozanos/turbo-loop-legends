# Dirección visual

Referencias consultadas el 3 de agosto de 2026:

- [Hot Wheels Unleashed 2](https://hotwheelsunleashed.com/): energía, diagonales, color y presentación de juguete premium.
- [Hill Climb Racing 2](https://www.fingersoft.com/games/hill-climb-racing-2/): siluetas muy legibles y vehículos reconocibles incluso a tamaño pequeño.
- [Beach Buggy Racing 2](https://www.vectorunit.com/beach-buggy-racing-2): volumen caricaturizado, fondos cálidos y composición de portada centrada en la acción.

La implementación toma principios generales, no diseños ni marcas: silueta lateral limpia, ruedas grandes, reflejos de alto contraste, una identidad distinta por coche y una home con pista, looping y líneas de velocidad. Todo el arte del proyecto es original.

## Pase de sala de exposición (23 de noviembre de 2026)

Objetivo: aspecto de render de motor moderno sin coste en tablets antiguas. Toda la
iluminación va precalculada en los sprites y en dibujo estático; no hay sombreadores,
filtros en tiempo de ejecución ni texturas descargadas.

- Coches: `tools/build-car-art.py` genera carrocerías con pintura metalizada, reflejo de
  cielo y suelo, oclusión en los pasos de rueda, cristales tintados y faros con halo. Los
  seis sprites comparten lienzo (640×300) y escala; antes tres de ellos estaban a media
  resolución y se dibujaban a la mitad de tamaño.
- Garaje: escenario oscuro con foco para el coche elegido y ficha con sus cinco capacidades;
  tarjetas, botones y modales con borde iluminado y sombra de profundidad.
- Carrera: rayos y halo de sol, bruma de horizonte, suelo en degradado, viñeta (desactivada
  en modo ligero), llama de turbo por capas y HUD de cristal oscuro con barra de velocidad.
- Se conservan la tipografía escolar común, los tokens día/noche y la barra del kit familiar.
