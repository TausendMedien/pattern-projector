export type KeyAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "jump"; index: number }
  | { type: "fullscreen" }
  | { type: "demo" }
  | { type: "enter" }
  | { type: "escape" }
  | { type: "freeze" }
  | { type: "blackout" }
  | { type: "randomize" }
  | { type: "screenshot" }
  | { type: "speedUp" }
  | { type: "speedDown" }
  | { type: "focusUp" }
  | { type: "focusDown" }
  | { type: "sliderLeft" }
  | { type: "sliderRight" }
  | { type: "toggleCamera" };

export function attachKeyboard(handler: (action: KeyAction) => void): () => void {
  let lHeld = false;

  function onKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // L held: arrow keys enter slider-navigation mode
    if (e.key === "l" || e.key === "L") {
      lHeld = true;
      e.preventDefault();
      return;
    }

    if (lHeld) {
      switch (e.key) {
        case "ArrowUp":    handler({ type: "focusUp" });    e.preventDefault(); return;
        case "ArrowDown":  handler({ type: "focusDown" });  e.preventDefault(); return;
        case "ArrowLeft":  handler({ type: "sliderLeft" }); e.preventDefault(); return;
        case "ArrowRight": handler({ type: "sliderRight" });e.preventDefault(); return;
      }
    }

    switch (e.key) {
      case "f": case "F":
        handler({ type: "fullscreen" });
        e.preventDefault(); return;
      case "d": case "D":
        handler({ type: "demo" });
        e.preventDefault(); return;
      case "b": case "B":
        handler({ type: "freeze" });
        e.preventDefault(); return;
      case " ":
        handler({ type: "freeze" });
        e.preventDefault(); return;
      case "a": case "A":
        handler({ type: "randomize" });
        e.preventDefault(); return;
      case "x": case "X":
        handler({ type: "blackout" });
        e.preventDefault(); return;
      case "r": case "R":
        handler({ type: "screenshot" });
        e.preventDefault(); return;
      case "y": case "Y":
        handler({ type: "toggleCamera" });
        e.preventDefault(); return;
      case "ArrowRight":
        handler({ type: "next" });
        e.preventDefault(); return;
      case "ArrowLeft":
        handler({ type: "prev" });
        e.preventDefault(); return;
      case "ArrowUp":
        handler({ type: "speedUp" });
        e.preventDefault(); return;
      case "ArrowDown":
        handler({ type: "speedDown" });
        e.preventDefault(); return;
      case "Enter":
        handler({ type: "enter" });
        e.preventDefault(); return;
      case "Escape":
        handler({ type: "escape" });
        // no preventDefault — let browser exit fullscreen natively
        return;
    }

    if (e.key >= "1" && e.key <= "9") {
      handler({ type: "jump", index: Number(e.key) - 1 });
      e.preventDefault();
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === "l" || e.key === "L") lHeld = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
