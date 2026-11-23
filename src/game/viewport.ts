/** Visible CSS area, not hardware pixels or the URL-bar-obscured layout viewport. */
export function visibleViewport(): { width: number; height: number } {
  const visual = window.visualViewport;
  const useVisual = visual && visual.scale === 1;
  return {
    width: Math.max(1, Math.floor(Math.min(window.innerWidth, useVisual ? visual.width : window.innerWidth))),
    height: Math.max(1, Math.floor(Math.min(window.innerHeight, useVisual ? visual.height : window.innerHeight))),
  };
}

export function updateViewportVariables(): void {
  const {width,height} = visibleViewport(), root = document.documentElement;
  root.style.setProperty('--game-width', width + 'px');
  root.style.setProperty('--game-height', height + 'px');
  root.style.setProperty('--game-vh', height / 100 + 'px');
  root.style.setProperty('--game-vmin', Math.min(width,height) / 100 + 'px');
  root.classList.toggle('game-short', height <= 520);
}
