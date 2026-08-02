import Phaser from "phaser";
import { registerSW } from "virtual:pwa-register";
import { GameAudio } from "./game/audio";
import { CARS, getCar, type CarId } from "./game/cars";
import { GameScene, type GameSceneData } from "./game/GameScene";
import { InputController } from "./game/input";
import { loadSave, saveGame, unlockCar } from "./game/state";
import "./styles/main.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("No se encontró el contenedor del juego");

const save = loadSave();
let selectedCar: CarId = save.unlockedCars.includes(save.selectedCar) ? save.selectedCar : "comet";
let toastTimer: number | undefined;
let sceneAdded = false;

app.innerHTML = `
  <div class="app-shell">
    <div id="game-canvas" class="game-canvas" aria-hidden="true"></div>
    <section id="garage-screen" class="screen">
      <div class="garage">
        <p class="brand-kicker">Una aventura sobre ruedas</p>
        <h1>Turbo <span>Loop</span> Legends</h1>
        <p class="garage-subtitle">Elige tu coche. Pisa a fondo. ¡Vuela por los loopings!</p>
        <div id="car-grid" class="car-grid" role="group" aria-label="Elige un coche"></div>
        <button id="play-button" class="primary-button">JUGAR</button>
        <div class="settings-row" aria-label="Ajustes">
          <label class="toggle"><input id="assists-toggle" type="checkbox"><span>✨ Ayudas</span></label>
          <label class="toggle"><input id="music-toggle" type="checkbox"><span>♫ Música</span></label>
          <label class="toggle"><input id="sound-toggle" type="checkbox"><span>🔊 Sonido</span></label>
          <label class="toggle"><input id="motion-toggle" type="checkbox"><span>◉ Movimiento suave</span></label>
        </div>
      </div>
    </section>
    <section id="hud" class="hud" aria-label="Controles de carrera" hidden>
      <div class="speedometer" aria-live="off"><strong id="speed" class="speed-value">0</strong><span class="speed-unit">KM/H</span></div>
      <button class="icon-button reset-button" data-control="reset" aria-label="Volver al último punto de control">↻</button>
      <button id="pause-button" class="icon-button pause-button" aria-label="Pausa">Ⅱ</button>
      <button class="drive-control brake-control" data-control="brake" aria-label="Frenar y marcha atrás">◀</button>
      <button class="turbo-control" data-control="turbo" aria-label="Activar turbo" aria-pressed="false"><span>⚡</span>TURBO</button>
      <button class="drive-control throttle-control" data-control="throttle" aria-label="Acelerar">▶</button>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </section>
    <section id="pause-screen" class="screen" hidden>
      <div class="modal">
        <h2>En pausa</h2>
        <p>El coche te espera.</p>
        <div class="modal-actions">
          <button id="resume-button" class="primary-button">SEGUIR</button>
          <button id="garage-button" class="secondary-button">Garaje</button>
        </div>
      </div>
    </section>
    <section id="finish-screen" class="screen" hidden>
      <div class="modal">
        <p class="brand-kicker">¡Circuito completado!</p>
        <h2>¡Leyenda!</h2>
        <p id="finish-message">Has conquistado todos los loopings.</p>
        <div class="modal-actions">
          <button id="replay-button" class="primary-button">OTRA VEZ</button>
          <button id="finish-garage-button" class="secondary-button">Elegir coche</button>
        </div>
      </div>
    </section>
    <aside class="rotate-device" hidden><div><span>📱</span><h2>Gira el dispositivo</h2><p>Los loopings se ven mejor en horizontal.</p></div></aside>
  </div>
`;

const garageScreen = getElement("garage-screen");
const hud = getElement("hud");
const pauseScreen = getElement("pause-screen");
const finishScreen = getElement("finish-screen");
const speedLabel = getElement("speed");
const toast = getElement("toast");
const carGrid = getElement("car-grid");
const audio = new GameAudio(save.settings.music, save.settings.sound);
const input = new InputController(app);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-canvas",
  width: 1280,
  height: 720,
  backgroundColor: "#8fd8f2",
  transparent: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: "100%",
    height: "100%"
  },
  render: { powerPreference: "high-performance", antialias: true }
});

renderCars();
bindSettings();

getElement("play-button").addEventListener("click", startRace);
getElement("replay-button").addEventListener("click", startRace);
getElement("pause-button").addEventListener("click", pauseRace);
getElement("resume-button").addEventListener("click", resumeRace);
getElement("garage-button").addEventListener("click", showGarage);
getElement("finish-garage-button").addEventListener("click", showGarage);
window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && !hud.hidden) pauseRace();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !hud.hidden) pauseRace();
});

registerSW({ immediate: true });

function startRace(): void {
  void audio.start();
  garageScreen.hidden = true;
  pauseScreen.hidden = true;
  finishScreen.hidden = true;
  hud.hidden = false;
  const data: GameSceneData = {
    car: getCar(selectedCar),
    assists: save.settings.assists,
    reducedMotion: save.settings.reducedMotion,
    input,
    audio,
    onSpeed: (speed) => { speedLabel.textContent = String(Math.round(speed)); },
    onCheckpoint: (id) => {
      audio.playCheckpoint();
      showToast("✓ Punto de control");
      if (id === "broken-loop-exit" && unlockCar(save, "lynx")) showToast("🔓 ¡Coche Lince desbloqueado!");
    },
    onFinish: finishRace,
    onRespawn: () => showToast("¡Otra oportunidad!")
  };
  if (!sceneAdded) {
    game.scene.add("GameScene", GameScene, true, data);
    sceneAdded = true;
  } else {
    if (game.scene.isActive("GameScene") || game.scene.isPaused("GameScene")) game.scene.stop("GameScene");
    game.scene.start("GameScene", data);
  }
}

function finishRace(): void {
  hud.hidden = true;
  save.finished = true;
  const unlocked = unlockCar(save, "titan");
  saveGame(save);
  audio.playSuccess();
  getElement("finish-message").textContent = unlocked
    ? "¡Has conquistado el circuito y desbloqueado el Titán!"
    : "Has conquistado todos los loopings.";
  window.setTimeout(() => { finishScreen.hidden = false; }, save.settings.reducedMotion ? 0 : 700);
}

function pauseRace(): void {
  if (hud.hidden) return;
  game.scene.pause("GameScene");
  audio.stop();
  hud.hidden = true;
  pauseScreen.hidden = false;
}

function resumeRace(): void {
  void audio.start();
  pauseScreen.hidden = true;
  hud.hidden = false;
  game.scene.resume("GameScene");
}

function showGarage(): void {
  if (sceneAdded) game.scene.stop("GameScene");
  audio.stop();
  pauseScreen.hidden = true;
  finishScreen.hidden = true;
  hud.hidden = true;
  garageScreen.hidden = false;
  renderCars();
}

function renderCars(): void {
  carGrid.replaceChildren(...CARS.map((car) => {
    const unlocked = save.unlockedCars.includes(car.id);
    const button = document.createElement("button");
    button.className = `car-card car-${car.id}${unlocked ? "" : " is-locked"}`;
    button.style.setProperty("--car-color", `#${car.color.toString(16).padStart(6, "0")}`);
    button.setAttribute("aria-pressed", String(selectedCar === car.id));
    button.setAttribute("aria-label", unlocked ? `${car.name}: ${car.tagline}` : `${car.name} bloqueado: ${car.unlock}`);
    button.disabled = !unlocked;
    button.innerHTML = `<span class="car-preview"><img src="${import.meta.env.BASE_URL}${car.asset}" alt="" draggable="false"></span><strong>${car.name}</strong><small>${unlocked ? car.tagline : car.unlock}</small>${unlocked ? "" : '<span class="lock-badge">🔒</span>'}`;
    button.addEventListener("click", () => {
      selectedCar = car.id;
      save.selectedCar = car.id;
      saveGame(save);
      renderCars();
    });
    return button;
  }));
}

function bindSettings(): void {
  bindToggle("assists-toggle", "assists");
  bindToggle("music-toggle", "music");
  bindToggle("sound-toggle", "sound");
  bindToggle("motion-toggle", "reducedMotion");
}

function bindToggle(id: string, key: keyof typeof save.settings): void {
  const element = getElement(id);
  if (!(element instanceof HTMLInputElement)) return;
  element.checked = save.settings[key];
  element.addEventListener("change", () => {
    save.settings[key] = element.checked;
    saveGame(save);
    audio.setEnabled(save.settings.music, save.settings.sound);
  });
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}`);
  return element;
}
