import "./styles.css";
import { createSouldollsGame } from "./game";

const root = document.querySelector<HTMLElement>("#game-root");

if (!root) {
  throw new Error("No se encontró el elemento raíz del juego.");
}

createSouldollsGame(root).catch((error: unknown) => {
  console.error("No se pudo iniciar el claro de bruma.", error);
  root.innerHTML = `
    <div class="game-shell">
      <div class="game-world" data-world></div>
      <section class="dialogue-card" data-dialogue role="alert">
        <div class="dialogue-heading">
          <div><span class="eyebrow">CLARO DE BRUMA</span><h2>No se pudo abrir el claro</h2></div>
        </div>
        <p>${error instanceof Error ? error.message : "Error desconocido al cargar la escena."}</p>
      </section>
    </div>
  `;
});
