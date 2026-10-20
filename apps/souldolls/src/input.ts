const MOVEMENT_KEYS: Record<string, string> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  KeyA: "left",
  KeyD: "right",
  KeyS: "down",
  KeyW: "up"
};

export type GameInput = {
  dispose: () => void;
  directions: Set<string>;
};

export function createGameInput(
  target: HTMLElement,
  actions: {
    interact: () => void;
    toggleParty: () => void;
  }
): GameInput {
  const directions = new Set<string>();

  const onKeyDown = (event: KeyboardEvent) => {
    const direction = MOVEMENT_KEYS[event.code];
    if (direction) {
      event.preventDefault();
      directions.add(direction);
    }

    if (event.repeat) return;

    if (event.code === "KeyE" || event.code === "Enter") {
      event.preventDefault();
      actions.interact();
    } else if (event.code === "KeyP" || event.code === "Tab") {
      event.preventDefault();
      actions.toggleParty();
    } else if (event.code === "Escape") {
      target.dispatchEvent(new CustomEvent("souldolls:escape"));
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const direction = MOVEMENT_KEYS[event.code];
    if (direction) directions.delete(direction);
  };

  const clearDirections = () => directions.clear();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearDirections);

  return {
    directions,
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearDirections);
    }
  };
}
