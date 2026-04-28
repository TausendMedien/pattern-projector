export type KeyAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "jump"; index: number }
  | { type: "fullscreen" };

export function attachKeyboard(handler: (action: KeyAction) => void): () => void {
  function onKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case "f":
      case "F":
        handler({ type: "fullscreen" });
        e.preventDefault();
        return;
      case "ArrowRight":
      case "ArrowDown":
        handler({ type: "next" });
        e.preventDefault();
        return;
      case "ArrowLeft":
      case "ArrowUp":
        handler({ type: "prev" });
        e.preventDefault();
        return;
    }

    if (e.key >= "1" && e.key <= "9") {
      handler({ type: "jump", index: Number(e.key) - 1 });
      e.preventDefault();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
