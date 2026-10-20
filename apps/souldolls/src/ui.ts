import { creatureMaxHp, creatureName } from "./pokemon/creature";
import type { Party } from "./pokemon/roster";
import { MAX_PARTY_SIZE } from "./pokemon/roster";
import { getSpecies } from "./pokemon/species";
import type { HudState } from "./types";

export class GameUI {
  private readonly actionButton: HTMLButtonElement;
  private readonly counter: HTMLElement;
  private readonly dialogue: HTMLElement;
  private readonly dialogueBody: HTMLElement;
  private readonly dialogueTitle: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly partyCount: HTMLElement;
  private readonly partyPanel: HTMLElement;
  private readonly partySlots: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly bonds: HTMLElement;
  private readonly toast: HTMLElement;
  private hideToastTimer?: number;
  private lastHudKey = "";

  isDialogueOpen = false;
  isPartyOpen = false;

  constructor(
    root: HTMLElement,
    actions: {
      interact: () => void;
      party: () => void;
      setDirection: (direction: string, pressed: boolean) => void;
    }
  ) {
    root.innerHTML = `
      <div class="game-shell">
        <div class="game-world" data-world></div>
        <div class="world-vignette" aria-hidden="true"></div>

        <header class="topbar">
          <div class="brand-lockup">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="M16 3.5 19.1 12l8.5 4-8.5 3.4-3.1 9.1-3.2-9.1L4.5 16l8.3-4L16 3.5Z" fill="currentColor"/>
                <circle cx="16" cy="16" r="2.2" fill="#fff5d9"/>
              </svg>
            </span>
            <span class="brand-name">SOUL<span>DOLLS</span></span>
            <span class="chapter-tag">PRÓLOGO <i></i> CLARO DE BRUMA</span>
          </div>
          <div class="topbar-stats">
            <span class="bond-chip"><span aria-hidden="true">✳</span><b data-bonds>0</b><small>VÍNCULOS</small></span>
            <button class="collection-chip" data-action="party" type="button" aria-label="Abrir colección de almas">
              <span class="collection-icon" aria-hidden="true">✳</span>
              <span class="collection-copy"><b data-counter>0 / 6</b><small>ALMAS VINCULADAS</small></span>
              <span class="collection-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
        </header>

        <section class="objective-card" aria-label="Objetivo actual">
          <span class="eyebrow"><i></i> TU PRIMER VÍNCULO</span>
          <h1>El claro despierta</h1>
          <p data-objective>Habla con Mara, la guardabosques del claro.</p>
          <div class="objective-progress"><span data-progress></span></div>
          <div class="objective-footer"><span>CLARO DE BRUMA</span><span data-objective-step>01 — 06</span></div>
        </section>

        <div class="ambient-label"><span class="ambient-dot"></span> <span data-location>Pradera tranquila</span><span class="ambient-divider"></span><span>09:42</span></div>

        <div class="interaction-bar" data-interaction>
          <span class="key-hint" data-key>E</span>
          <span class="interaction-copy" data-prompt>Habla con Mara</span>
          <span class="interaction-subtitle">Y descubre quién te espera</span>
        </div>

        <div class="keyboard-hint" aria-label="Controles de teclado">
          <span>MOVER</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span class="hint-divider"></span>
          <span>INTERACTUAR</span><kbd>E</kbd>
        </div>

        <div class="mobile-controls" aria-label="Controles táctiles">
          <div class="dpad">
            <button type="button" data-direction="up" aria-label="Mover hacia arriba">⌃</button>
            <button type="button" data-direction="left" aria-label="Mover a la izquierda">‹</button>
            <span class="dpad-center" aria-hidden="true"></span>
            <button type="button" data-direction="right" aria-label="Mover a la derecha">›</button>
            <button type="button" data-direction="down" aria-label="Mover hacia abajo">⌄</button>
          </div>
          <button class="touch-interact" type="button" data-action="interact" aria-label="Interactuar">
            <span>E</span><small>ACCIÓN</small>
          </button>
        </div>

        <section class="dialogue-card" data-dialogue hidden role="dialog" aria-modal="true" aria-labelledby="dialogue-title">
          <div class="dialogue-heading"><span class="dialogue-avatar" aria-hidden="true">✳</span><div><span class="eyebrow">CLARO DE BRUMA</span><h2 data-dialogue-title></h2></div></div>
          <p data-dialogue-body></p>
          <button class="dialogue-continue" data-action="close-dialogue" type="button">Continuar <span aria-hidden="true">→</span></button>
        </section>

        <section class="party-panel" data-party-panel hidden aria-label="Colección de almas">
          <div class="panel-heading"><div><span class="eyebrow">TU COLECCIÓN</span><h2>Almas vinculadas</h2></div><button class="icon-button" data-action="close-party" type="button" aria-label="Cerrar colección">×</button></div>
          <p class="panel-copy">Cada encuentro guarda una pequeña parte del bosque.</p>
          <div class="party-slots" data-party-slots></div>
          <div class="panel-footer"><span data-party-count>0 de 6 almas</span><span>SOULDOLLS <i>✳</i></span></div>
        </section>

        <div class="toast" data-toast role="status" aria-live="polite" hidden></div>
      </div>
    `;

    this.actionButton = required<HTMLButtonElement>(root, '[data-action="interact"]');
    this.bonds = required(root, "[data-bonds]");
    this.counter = required(root, "[data-counter]");
    this.dialogue = required(root, "[data-dialogue]");
    this.dialogueBody = required(root, "[data-dialogue-body]");
    this.dialogueTitle = required(root, "[data-dialogue-title]");
    this.objective = required(root, "[data-objective]");
    this.partyCount = required(root, "[data-party-count]");
    this.partyPanel = required(root, "[data-party-panel]");
    this.partySlots = required(root, "[data-party-slots]");
    this.progress = required(root, "[data-progress]");
    this.prompt = required(root, "[data-prompt]");
    this.toast = required(root, "[data-toast]");

    root.querySelectorAll<HTMLButtonElement>('[data-action="party"]').forEach((button) => {
      button.addEventListener("click", actions.party);
    });
    this.actionButton.addEventListener("click", actions.interact);
    root.querySelector('[data-action="close-dialogue"]')?.addEventListener("click", () => this.closeDialogue());
    root.querySelector('[data-action="close-party"]')?.addEventListener("click", () => this.closeParty());

    root.querySelectorAll<HTMLButtonElement>("[data-direction]").forEach((button) => {
      const direction = button.dataset.direction;
      if (!direction) return;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        actions.setDirection(direction, true);
      });
      const release = () => actions.setDirection(direction, false);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });

    root.addEventListener("souldolls:escape", () => {
      if (this.isDialogueOpen) this.closeDialogue();
      else this.closeParty();
    });
  }

  update(state: HudState) {
    const key = `${state.partySize}|${state.bondCount}|${state.nearbyName ?? ""}|${state.nearbyType ?? ""}|${state.hasStarter}`;
    if (key === this.lastHudKey) return;
    this.lastHudKey = key;

    this.counter.textContent = `${state.partySize} / ${MAX_PARTY_SIZE}`;
    this.bonds.textContent = String(state.bondCount);
    this.progress.style.width = `${(state.partySize / MAX_PARTY_SIZE) * 100}%`;

    if (!state.hasStarter) {
      this.objective.textContent = "Habla con Mara, la guardabosques del claro.";
    } else if (state.partySize >= MAX_PARTY_SIZE) {
      this.objective.textContent = "Tu colección está completa. El claro guarda más secretos.";
    } else if (state.partySize === 1) {
      this.objective.textContent = "Desafía a las almas del claro y créalas un vínculo.";
    } else {
      this.objective.textContent = `Llevas ${state.partySize} almas. La pradera guarda más creatures.`;
    }

    if (!state.hasStarter) {
      this.prompt.textContent = "Busca a Mara, la guardabosques";
    } else if (state.nearbyType === "wild" && state.nearbyName) {
      this.prompt.textContent = `Desafiar a ${state.nearbyName}`;
    } else if (state.nearbyType === "keeper" && state.nearbyName) {
      this.prompt.textContent = `Hablar con ${state.nearbyName}`;
    } else {
      this.prompt.textContent = "Recorre el sendero";
    }

    this.actionButton.disabled = false;
  }

  showDialogue(title: string, body: string) {
    this.dialogueTitle.textContent = title;
    this.dialogueBody.textContent = body;
    this.dialogue.hidden = false;
    this.isDialogueOpen = true;
    required<HTMLButtonElement>(this.dialogue, '[data-action="close-dialogue"]').focus();
  }

  closeDialogue() {
    this.dialogue.hidden = true;
    this.isDialogueOpen = false;
  }

  toggleParty(party: Party) {
    if (this.isPartyOpen) {
      this.closeParty();
      return;
    }

    this.partySlots.innerHTML = party.creatures.length
      ? party.creatures
          .map((creature) => {
            const species = getSpecies(creature.speciesId);
            const maxHp = creatureMaxHp(creature);
            const ratio = Math.max(0, Math.min(1, creature.currentHp / maxHp));
            return `
              <article class="soul-slot is-captured">
                <span class="soul-swatch" style="--soul-color:${species.color};--soul-accent:${species.accent}" aria-hidden="true">✳</span>
                <span class="soul-slot-copy">
                  <b>${creatureName(creature)}</b>
                  <small>${species.title} · Nv ${creature.level}</small>
                </span>
                <span class="soul-slot-state">${creature.currentHp}/${maxHp}</span>
                <span class="hp-track soul-slot-hp"><span class="hp-fill" data-level="${ratio > 0.5 ? "alto" : ratio > 0.2 ? "medio" : "bajo"}" style="width:${ratio * 100}%"></span></span>
              </article>
            `;
          })
          .join("")
      : `<p class="party-empty">Todavía no has vinculado ningún alma. Habla con Mara para empezar.</p>`;

    this.partyCount.textContent = `${party.creatures.length} de ${MAX_PARTY_SIZE} almas`;
    this.partyPanel.hidden = false;
    this.isPartyOpen = true;
    required<HTMLButtonElement>(this.partyPanel, '[data-action="close-party"]').focus();
  }

  closeParty() {
    this.partyPanel.hidden = true;
    this.isPartyOpen = false;
  }

  showToast(message: string) {
    this.toast.textContent = message;
    this.toast.hidden = false;
    window.clearTimeout(this.hideToastTimer);
    this.hideToastTimer = window.setTimeout(() => {
      this.toast.hidden = true;
    }, 2600);
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Falta un elemento de interfaz: ${selector}`);
  return element;
}
