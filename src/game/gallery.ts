// Wrap selection without moving the document or creating a scroll container.
export function galleryOffset(index: number, selected: number, count: number): number {
  const forward = (index - selected + count) % count;
  return forward > count / 2 ? forward - count : forward;
}

export function bindGallery(element: HTMLElement, change: (direction: number) => void): void {
  let contact: { id: number; x: number; y: number } | undefined;
  element.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault(); event.stopPropagation();
    change(event.key === 'ArrowRight' ? 1 : -1);
    element.focus();
  });
  element.addEventListener('pointerdown', event => {
    if (!event.isPrimary) return;
    contact = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  element.addEventListener('pointerup', event => {
    if (!contact || event.pointerId !== contact.id) return;
    const dx = event.clientX - contact.x, dy = event.clientY - contact.y;
    contact = undefined;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.4) return;
    // Suppress the synthetic click following the completed swipe.
    const suppress = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    element.addEventListener('click', suppress, { capture: true, once: true });
    setTimeout(() => element.removeEventListener('click', suppress, true), 400);
    change(dx < 0 ? 1 : -1);
  });
  element.addEventListener('pointercancel', () => { contact = undefined; });
}
