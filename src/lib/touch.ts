import type { KeyAction } from "./keyboard";

export function attachTouch(handler: (action: KeyAction) => void): () => void {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
  }

  function onTouchEnd(e: TouchEvent) {
    const t = e.changedTouches[0];
    const deltaX = t.clientX - startX;
    const deltaY = t.clientY - startY;
    const elapsed = Date.now() - startTime;

    // Swipe: fast, horizontal, significant distance
    if (elapsed < 400 && Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      handler({ type: deltaX < 0 ? "next" : "prev" });
      lastTapTime = 0; // reset double-tap tracking after a swipe
      return;
    }

    // Double-tap: two taps close in time and space
    const now = Date.now();
    const tapDist = Math.hypot(t.clientX - lastTapX, t.clientY - lastTapY);
    if (now - lastTapTime < 300 && tapDist < 40) {
      e.preventDefault();
      handler({ type: "fullscreen" });
      lastTapTime = 0;
      return;
    }

    lastTapTime = now;
    lastTapX = t.clientX;
    lastTapY = t.clientY;
  }

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: false });

  return () => {
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchend", onTouchEnd);
  };
}
