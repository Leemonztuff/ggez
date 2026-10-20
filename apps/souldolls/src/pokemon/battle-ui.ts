import { renderPortrait } from "../sprites";
import type { BattleLogEntry, BattleState } from "./battle";
import { creatureMaxHp, creatureName, type Creature } from "./creature";
import { ITEMS, type ItemId } from "./items";
import { MOVES } from "./moves";
import type { Party } from "./roster";
import { getSpecies } from "./species";
import { stageLabel } from "./stats";
import { TYPE_COLORS, TYPE_NAMES } from "./types";

export type BattleUiAction =
  | { kind: "move"; moveIndex: number }
  | { kind: "switch"; index: number }
  | { kind: "bond" }
  | { kind: "flee" }
  | { kind: "item"; itemId: ItemId; targetIndex: number };

export type BattleUiCallbacks = {
  onAction: (action: BattleUiAction) => void;
};

export class BattleUI {
  isBattleOpen = false;

  private readonly logElement: HTMLElement;
  private readonly movesElement: HTMLElement;
  private readonly optionsElement: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly bagElement: HTMLElement;
  private readonly bagList: HTMLElement;
  private readonly partyElement: HTMLElement;
  private readonly partyList: HTMLElement;
  private readonly playerCard: HTMLElement;
  private readonly playerPortrait: HTMLCanvasElement;
  private readonly rivalCard: HTMLElement;
  private readonly rivalPortrait: HTMLCanvasElement;
  private locked = false;

  constructor(
    root: HTMLElement,
    private readonly callbacks: BattleUiCallbacks
  ) {
    const overlay = document.createElement("div");
    overlay.className = "battle-overlay";
    overlay.dataset.battle = "overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="battle-stage">
        <div class="battle-fighter battle-fighter--rival" data-battle="rival-card">
          <div class="fighter-head">
            <span class="fighter-name" data-battle="rival-name"></span>
            <span class="fighter-level" data-battle="rival-level"></span>
          </div>
          <div class="fighter-types" data-battle="rival-types"></div>
          <div class="fighter-stages" data-battle="rival-stages"></div>
          <div class="hp-track"><span class="hp-fill" data-battle="rival-hp"></span></div>
          <span class="fighter-status" data-battle="rival-status"></span>
        </div>

        <canvas class="battle-portrait battle-portrait--rival" width="96" height="128" data-battle="rival-portrait"></canvas>

        <div class="battle-fighter battle-fighter--player" data-battle="player-card">
          <div class="fighter-head">
            <span class="fighter-name" data-battle="player-name"></span>
            <span class="fighter-level" data-battle="player-level"></span>
          </div>
          <div class="fighter-types" data-battle="player-types"></div>
          <div class="fighter-stages" data-battle="player-stages"></div>
          <div class="hp-track"><span class="hp-fill" data-battle="player-hp"></span></div>
          <div class="xp-track"><span class="xp-fill" data-battle="player-xp"></span></div>
          <span class="fighter-status" data-battle="player-status"></span>
        </div>

        <canvas class="battle-portrait battle-portrait--player" width="96" height="128" data-battle="player-portrait"></canvas>

        <div class="battle-log" data-battle="log" aria-live="polite"></div>

        <div class="battle-menu" data-battle="menu">
          <div class="battle-moves" data-battle="moves"></div>
          <div class="battle-options" data-battle="options">
            <button type="button" data-battle-option="bond">Vínculo <b data-battle="bonds">0</b></button>
            <button type="button" data-battle-option="switch">Cambiar</button>
            <button type="button" data-battle-option="bag">Mochila</button>
            <button type="button" data-battle-option="flee">Huir</button>
          </div>
        </div>

        <div class="battle-party" data-battle="party" hidden>
          <p class="battle-party-title">Elige con quién continuar</p>
          <div class="battle-party-list" data-battle="party-list"></div>
          <button type="button" class="battle-party-close" data-battle-party="close">Volver</button>
        </div>

        <div class="battle-bag" data-battle="bag-panel" hidden>
          <p class="battle-party-title">Tu morral</p>
          <div class="battle-bag-list" data-battle="bag-list"></div>
          <button type="button" class="battle-party-close" data-battle-bag="close">Volver</button>
        </div>
      </div>
    `;

    root.append(overlay);

    this.overlay = overlay;
    this.logElement = required(overlay, '[data-battle="log"]');
    this.movesElement = required(overlay, '[data-battle="moves"]');
    this.optionsElement = required(overlay, '[data-battle="options"]');
    this.partyElement = required(overlay, '[data-battle="party"]');
    this.partyList = required(overlay, '[data-battle="party-list"]');
    this.bagElement = required(overlay, '[data-battle="bag-panel"]');
    this.bagList = required(overlay, '[data-battle="bag-list"]');
    this.playerCard = required(overlay, '[data-battle="player-card"]');
    this.rivalCard = required(overlay, '[data-battle="rival-card"]');
    this.rivalPortrait = required(overlay, '[data-battle="rival-portrait"]');
    this.playerPortrait = required(overlay, '[data-battle="player-portrait"]');

    required(overlay, '[data-battle-option="bond"]').addEventListener("click", () => {
      if (this.locked) return;
      this.callbacks.onAction({ kind: "bond" });
    });

    required(overlay, '[data-battle-option="switch"]').addEventListener("click", () => {
      if (this.locked) return;
      this.togglePanel(this.partyElement, true);
    });

    required(overlay, '[data-battle-option="bag"]').addEventListener("click", () => {
      if (this.locked) return;
      this.togglePanel(this.bagElement, true);
    });

    required(overlay, '[data-battle-option="flee"]').addEventListener("click", () => {
      if (this.locked) return;
      this.callbacks.onAction({ kind: "flee" });
    });

    required(overlay, '[data-battle-party="close"]').addEventListener("click", () => {
      this.togglePanel(this.partyElement, false);
    });

    required(overlay, '[data-battle-bag="close"]').addEventListener("click", () => {
      this.togglePanel(this.bagElement, false);
    });
  }

  open() {
    this.isBattleOpen = true;
    this.overlay.hidden = false;
  }

  close() {
    this.isBattleOpen = false;
    this.locked = false;
    this.togglePanel(this.partyElement, false);
    this.togglePanel(this.bagElement, false);
    this.overlay.hidden = true;
  }

  setLocked(locked: boolean) {
    this.locked = locked;
    this.movesElement.classList.toggle("is-locked", locked);
    this.optionsElement.classList.toggle("is-locked", locked);
  }

  render(state: BattleState, party: Party, activeIndex = 0) {
    this.renderFighter(this.rivalCard, state.rival.creature);
    this.renderFighter(this.playerCard, state.player.creature);
    this.renderPortrait(this.rivalPortrait, state.rival.creature);
    this.renderPortrait(this.playerPortrait, state.player.creature);
    this.renderMoves(state.player.creature);
    this.renderPartyList(state, party, activeIndex);
    this.renderBagList(party);

    required(this.overlay, '[data-battle="bonds"]').textContent = String(state.player.bonds);
  }

  appendLog(entry: BattleLogEntry) {
    const line = document.createElement("p");
    line.className = `battle-log-line battle-log-line--${entry.kind}`;
    line.textContent = entry.text;
    this.logElement.append(line);
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }

  clearLog() {
    this.logElement.innerHTML = "";
  }

  private renderFighter(card: HTMLElement, creature: Creature) {
    const species = getSpecies(creature.speciesId);
    const maxHp = creatureMaxHp(creature);
    const ratio = Math.max(0, Math.min(1, creature.currentHp / maxHp));

    required<HTMLElement>(card, ".fighter-name").textContent = creatureName(creature);
    required<HTMLElement>(card, ".fighter-level").textContent = `Nv ${creature.level}`;

    const types = required(card, ".fighter-types");
    types.innerHTML = species.types
      .map(
        (type) =>
          `<span class="type-chip" style="--type-color:${TYPE_COLORS[type]}">${TYPE_NAMES[type]}</span>`
      )
      .join("");

    const stages = required(card, ".fighter-stages");
    const activeStages = (["atk", "def", "spd"] as const).filter(
      (key) => creature.stages[key] !== 0
    );
    stages.innerHTML = activeStages
      .map(
        (key) =>
          `<span class="stage-chip" data-sign="${creature.stages[key] > 0 ? "up" : "down"}">${key} ${stageLabel(
            creature.stages[key]
          )}</span>`
      )
      .join("");

    const hp = required<HTMLElement>(card, ".hp-fill");
    hp.style.width = `${ratio * 100}%`;
    hp.dataset.level = ratio > 0.5 ? "alto" : ratio > 0.2 ? "medio" : "bajo";

    const status = required<HTMLElement>(card, ".fighter-status");
    status.textContent = creature.status ? statusLabel(creature.status) : "";
  }

  private renderPortrait(canvas: HTMLCanvasElement, creature: Creature) {
    const species = getSpecies(creature.speciesId);
    renderPortrait(canvas, {
      accent: species.accent,
      color: species.color,
      role: "soul"
    });
  }

  private renderMoves(creature: Creature) {
    this.movesElement.innerHTML = creature.moves
      .map((moveId, index) => {
        const move = MOVES[moveId];
        const pp = creature.pp[index] ?? 0;
        const power = move.power > 0 ? `Pot ${move.power}` : "Estado";
        const spent = pp <= 0 ? " is-empty" : "";
        return `
          <button type="button" class="battle-move${spent}" data-battle-move="${index}" style="--type-color:${TYPE_COLORS[move.type]}">
            <b>${move.name}</b>
            <small>${TYPE_NAMES[move.type]} · ${power} · PS ${pp}/${move.pp}</small>
          </button>
        `;
      })
      .join("");

    this.movesElement.querySelectorAll<HTMLButtonElement>("[data-battle-move]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.locked) return;
        const index = Number(button.dataset.battleMove);
        this.callbacks.onAction({ kind: "move", moveIndex: index });
      });
    });
  }

  private renderPartyList(state: BattleState, party: Party, activeIndex: number) {
    this.partyList.innerHTML = party.creatures
      .map((creature, index) => {
        const current = index === activeIndex ? state.player.creature : creature;
        const species = getSpecies(current.speciesId);
        const maxHp = creatureMaxHp(current);
        const active = index === activeIndex;
        return `
          <button type="button" class="battle-party-item${active ? " is-active" : ""}" data-battle-party-item="${index}">
            <span class="party-item-name">${creatureName(current)}</span>
            <span class="party-item-level">Nv ${current.level}</span>
            <span class="party-item-hp">${current.currentHp}/${maxHp}</span>
            <span class="party-item-types">${species.types.map((type) => TYPE_NAMES[type]).join(" / ")}</span>
          </button>
        `;
      })
      .join("");

    this.partyList
      .querySelectorAll<HTMLButtonElement>("[data-battle-party-item]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          if (this.locked) return;
          const index = Number(button.dataset.battlePartyItem);
          this.togglePanel(this.partyElement, false);
          this.callbacks.onAction({ kind: "switch", index });
        });
      });
  }

  private renderBagList(party: Party) {
    const entries = Object.entries(party.bag.items) as Array<[ItemId, number]>;
    const usable = entries.filter(([, count]) => count > 0);

    this.bagList.innerHTML = usable.length
      ? usable
          .map(([itemId, count]) => {
            const item = ITEMS[itemId];
            return `
              <button type="button" class="battle-bag-item" data-battle-bag-item="${itemId}">
                <span class="bag-item-name">${item.name}</span>
                <span class="bag-item-count">x${count}</span>
                <span class="bag-item-description">${item.description}</span>
              </button>
            `;
          })
          .join("")
      : `<p class="party-empty">El morral está vacío.</p>`;

    this.bagList
      .querySelectorAll<HTMLButtonElement>("[data-battle-bag-item]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          if (this.locked) return;
          const itemId = button.dataset.battleBagItem as ItemId;
          this.togglePanel(this.bagElement, false);
          this.callbacks.onAction({ kind: "item", itemId, targetIndex: 0 });
        });
      });
  }

  private togglePanel(panel: HTMLElement, visible: boolean) {
    panel.hidden = !visible;
  }
}

function statusLabel(status: string): string {
  if (status === "veneno") return "Envenenado";
  if (status === "dormido") return "Dormido";
  if (status === "paralizado") return "Paralizado";
  if (status === "quemadura") return "Quemado";
  if (status === "confusion") return "Confundido";
  return status;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Falta un elemento de la interfaz de batalla: ${selector}`);
  return element;
}
