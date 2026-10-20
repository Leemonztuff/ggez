import {
  creatureMaxHp,
  creatureName,
  creatureStat,
  hasPPLeft,
  isFainted,
  restorePP,
  type Creature,
  type Rng
} from "./creature";
import { ITEMS, type ItemId } from "./items";
import { MOVES, type AnyMoveId, type Move, type MoveId, type StatusId } from "./moves";
import type { Bag } from "./inventory";
import { getSpecies } from "./species";
import { applyStages, stageMultiplier, type StageKey } from "./stats";
import { typeEffectiveness, type TypeId } from "./types";

export type BattleAction =
  | { kind: "move"; moveIndex: number }
  | { kind: "switch"; creature: Creature }
  | { kind: "bond" }
  | { kind: "flee" }
  | { kind: "item"; itemId: ItemId; targetIndex: number };

export type BattleLogKind =
  | "capture"
  | "damage"
  | "faint"
  | "info"
  | "item"
  | "result"
  | "stage"
  | "status";

export type BattleLogEntry = {
  kind: BattleLogKind;
  text: string;
};

export type Combatant = {
  bondBonus: number;
  bonds: number;
  creature: Creature;
  flinched: boolean;
  isPlayer: boolean;
  moves: MoveId[];
};

export type BattleResult = "captured" | "defeat" | "fled" | "victory";

export type BattleModifiers = {
  accuracy?: (type: TypeId) => number;
  damage?: (type: TypeId) => number;
};

export type BattleState = {
  bag: Bag;
  log: BattleLogEntry[];
  modifiers?: BattleModifiers;
  phase: "over" | "select";
  player: Combatant;
  result?: BattleResult;
  rival: Combatant;
  turn: number;
};

export type TurnResolution = {
  events: BattleLogEntry[];
  state: BattleState;
};

const STRUGGLE_POWER = 50;
const STRUGGLE_RECOIL = 0.25;
const CONFUSION_CHANCE = 0.33;
const CRIT_CHANCES = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];

export const STRUGGLE_MOVE: Move = {
  accuracy: 100,
  category: "physical",
  critStage: 0,
  description: "Un último recurso cuando ya no quedan PS de movimientos.",
  id: "esfuerzo",
  name: "Esfuerzo",
  pp: 0,
  power: STRUGGLE_POWER,
  priority: 0,
  type: "sombra"
};

export function resolveMove(moveId: AnyMoveId): Move {
  if (moveId === "esfuerzo") {
    return STRUGGLE_MOVE;
  }

  return MOVES[moveId];
}

export function startBattle(player: Combatant, rival: Combatant, bag: Bag): BattleState {
  return {
    bag,
    log: [
      {
        kind: "info",
        text: `${creatureName(player.creature)} se adelanta frente a ${creatureName(rival.creature)}.`
      }
    ],
    phase: "select",
    player,
    rival,
    turn: 1
  };
}

export function computeDamage(
  attacker: Creature,
  defender: Creature,
  move: Move,
  rng: Rng,
  forcedCritical = false,
  modifiers?: BattleModifiers
): { critical: boolean; damage: number; effectiveness: number } {
  const attack = combatStat(attacker, "atk");
  const defense = combatStat(defender, "def");
  const base =
    Math.floor(
      Math.floor(
        (Math.floor((2 * attacker.level) / 5 + 2) * move.power * attack) / Math.max(1, defense)
      ) / 50
    ) + 2;
  const stab = getSpecies(attacker.speciesId).types.includes(move.type) ? 1.5 : 1;
  const effectiveness = typeEffectiveness(move.type, getSpecies(defender.speciesId).types);
  const weather = modifiers?.damage?.(move.type) ?? 1;
  const critChance = CRIT_CHANCES[Math.min(CRIT_CHANCES.length - 1, move.critStage)];
  const critical = forcedCritical || rng() < critChance;
  const variation = 0.85 + rng() * 0.15;
  const damage = Math.max(
    1,
    Math.floor(base * stab * effectiveness * weather * (critical ? 1.5 : 1) * variation)
  );

  return { critical, damage, effectiveness };
}

export function combatStat(creature: Creature, key: "atk" | "def" | "spd"): number {
  let value = creatureStat(creature, key);
  const stageKey: StageKey = key;
  value *= stageMultiplier(creature.stages[stageKey]);

  if (key === "atk" && creature.status === "quemadura") {
    value *= 0.5;
  }

  if (key === "atk" && creature.status === "confusion") {
    value *= 0.5;
  }

  if (key === "spd" && creature.status === "paralizado") {
    value *= 0.5;
  }

  return Math.max(1, Math.round(value));
}

export function effectiveAccuracy(
  attacker: Creature,
  defender: Creature,
  accuracy: number,
  moveType?: TypeId,
  modifiers?: BattleModifiers
): number {
  const weather = moveType ? modifiers?.accuracy?.(moveType) ?? 1 : 1;

  return (
    accuracy *
    stageMultiplier(attacker.stages.acc, true) *
    stageMultiplier(defender.stages.eva, true) *
    weather
  );
}

export function resolveTurn(
  state: BattleState,
  action: BattleAction,
  rng: Rng
): TurnResolution {
  if (state.phase === "over") {
    return { events: [], state };
  }

  const events: BattleLogEntry[] = [];
  const player = cloneCombatant(state.player);
  const rival = cloneCombatant(state.rival);
  const bag = state.bag;
  let result: BattleResult | undefined = state.result;

  if (action.kind === "bond") {
    result = resolveCapture(player, rival, rng, events);
  } else if (action.kind === "flee") {
    result = resolveFlee(player, rival, state.turn, rng, events);
  } else if (action.kind === "item") {
    useItem(action, player, rival, bag, events);
  } else if (action.kind === "switch") {
    const leaving = creatureName(player.creature);
    player.creature = { ...action.creature, pp: restorePP(action.creature).pp };
    events.push({
      kind: "info",
      text: `Retiras a ${leaving} y preparas a ${creatureName(player.creature)}.`
    });
  }

  if (!result && action.kind !== "switch" && action.kind !== "item") {
    const playerChoice = choosePlayerMove(player, action);
    const rivalChoice = chooseRivalMove(rival, player, rng);
    const order = resolveTurnOrder(player, rival, playerChoice, rivalChoice, rng);

    for (const side of order) {
      if (result) break;
      if (isFainted(player.creature) || isFainted(rival.creature)) break;

      if (side === "player") {
        executeMove(player, rival, playerChoice, rng, events, state.modifiers);
      } else {
        executeMove(rival, player, rivalChoice, rng, events, state.modifiers);
      }
    }
  }

  if (!result) {
    applyEndOfTurn(player, events);
    applyEndOfTurn(rival, events);
  }

  if (!result) {
    if (isFainted(rival.creature)) {
      result = "victory";
      events.push({
        kind: "result",
        text: `${creatureName(rival.creature)} cae y se disuelve en luz de bruma.`
      });
    } else if (isFainted(player.creature)) {
      result = "defeat";
      events.push({
        kind: "result",
        text: `${creatureName(player.creature)} ya no puede seguir luchando.`
      });
    }
  }

  return {
    events,
    state: {
      bag,
      log: [...state.log, ...events],
      modifiers: state.modifiers,
      phase: result ? "over" : "select",
      player,
      result,
      rival,
      turn: state.turn + (result ? 0 : 1)
    }
  };
}

export function chooseRivalMove(
  rival: Combatant,
  target: Combatant,
  rng: Rng
): { moveId: AnyMoveId; moveIndex: number } {
  const available = rival.creature.moves
    .map((moveId, index) => ({ moveId, index }))
    .filter(({ index }) => (rival.creature.pp[index] ?? 0) > 0);

  if (available.length === 0) {
    return { moveId: "esfuerzo", moveIndex: -1 };
  }

  let best = available[0];
  let bestScore = -1;

  for (const candidate of available) {
    const move = MOVES[candidate.moveId];
    const score =
      move.category === "status"
        ? 0
        : computeDamage(rival.creature, target.creature, move, () => 0.99).damage *
          typeEffectiveness(move.type, getSpecies(target.creature.speciesId).types);

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return { moveId: best.moveId, moveIndex: best.index };
}

function choosePlayerMove(
  combatant: Combatant,
  action: BattleAction
): { moveId: AnyMoveId; moveIndex: number } {
  if (action.kind !== "move") {
    return { moveId: "esfuerzo", moveIndex: -1 };
  }

  const index = action.moveIndex;
  const moveId = combatant.creature.moves[index];

  if (!moveId || (combatant.creature.pp[index] ?? 0) <= 0) {
    return { moveId: "esfuerzo", moveIndex: -1 };
  }

  return { moveId, moveIndex: index };
}

function executeMove(
  actor: Combatant,
  target: Combatant,
  choice: { moveId: AnyMoveId; moveIndex: number },
  rng: Rng,
  events: BattleLogEntry[],
  modifiers?: BattleModifiers
) {
  const creature = actor.creature;

  if (!canAct(creature, rng, events)) {
    return;
  }

  if (actor.flinched) {
    actor.flinched = false;
    events.push({
      kind: "info",
      text: `${creatureName(creature)} se tambalea y no achieves a actuar.`
    });
    return;
  }

  if (creature.status === "confusion" && rng() < CONFUSION_CHANCE) {
    const damage = Math.max(1, Math.floor(creatureMaxHp(creature) / 8));
    creature.currentHp = Math.max(0, creature.currentHp - damage);
    events.push({
      kind: "damage",
      text: `${creatureName(creature)} está confundido y se golpea a sí mismo (${damage}).`
    });
    return;
  }

  if (choice.moveId === "esfuerzo") {
    executeStruggle(actor, target, rng, events);
    return;
  }

  const move = resolveMove(choice.moveId);

  if (choice.moveIndex >= 0 && actor.creature.pp[choice.moveIndex] > 0) {
    actor.creature.pp[choice.moveIndex] -= 1;
  }

  const accuracy = effectiveAccuracy(actor.creature, target.creature, move.accuracy, move.type, modifiers);

  if (rng() * 100 >= accuracy) {
    events.push({ kind: "info", text: `El golpe de ${creatureName(creature)} falla.` });
    return;
  }

  if (move.category === "status") {
    applyEffect(actor, target, move, rng, events);
    return;
  }

  const hits = move.multiHit ? 1 + Math.floor(rng() * move.multiHit.max) : 1;
  let total = 0;
  let lastEffectiveness = 1;

  for (let hit = 0; hit < hits; hit += 1) {
    if (move.multiHit && hit > 0 && rng() * 100 >= move.multiHit.precision) {
      break;
    }

    const outcome = computeDamage(actor.creature, target.creature, move, rng, false, modifiers);
    target.creature.currentHp = Math.max(0, target.creature.currentHp - outcome.damage);
    total += outcome.damage;
    lastEffectiveness = outcome.effectiveness;
  }

  const note =
    lastEffectiveness > 1 ? "¡Es supereficaz!" : lastEffectiveness < 1 ? "No es muy eficaz..." : "";
  events.push({
    kind: "damage",
    text: `${creatureName(actor.creature)} usa ${move.name} y causa ${total} de daño. ${note}`.trim()
  });

  if (move.drain) {
    const healed = Math.max(1, Math.floor(total * move.drain));
    const maxHp = creatureMaxHp(actor.creature);
    actor.creature.currentHp = Math.min(maxHp, actor.creature.currentHp + healed);
    events.push({
      kind: "info",
      text: `${creatureName(actor.creature)} absorbe ${healed} de PS.`
    });
  }

  if (move.recoil) {
    const recoil = Math.max(1, Math.floor(total * move.recoil));
    actor.creature.currentHp = Math.max(0, actor.creature.currentHp - recoil);
    events.push({
      kind: "damage",
      text: `${creatureName(actor.creature)} sufre ${recoil} de daño por el rechazo.`
    });
  }

  if (move.flinch && rng() < move.flinch) {
    target.flinched = true;
    events.push({
      kind: "status",
      text: `${creatureName(target.creature)} queda tambaleante.`
    });
  }

  if (isFainted(target.creature)) {
    events.push({ kind: "faint", text: `${creatureName(target.creature)} se apaga.` });
  }
}

function executeStruggle(
  actor: Combatant,
  target: Combatant,
  rng: Rng,
  events: BattleLogEntry[]
) {
  const { damage } = computeDamage(actor.creature, target.creature, STRUGGLE_MOVE, rng, true);
  target.creature.currentHp = Math.max(0, target.creature.currentHp - damage);
  const recoil = Math.max(1, Math.floor(creatureMaxHp(actor.creature) * STRUGGLE_RECOIL));
  actor.creature.currentHp = Math.max(0, actor.creature.currentHp - recoil);

  events.push({
    kind: "damage",
    text: `¡Sin PS de movimientos, ${creatureName(actor.creature)} usa Esfuerzo y causa ${damage} de daño!`
  });
  events.push({
    kind: "damage",
    text: `${creatureName(actor.creature)} sufre ${recoil} de daño por el esfuerzo.`
  });
}

function canAct(creature: Creature, rng: Rng, events: BattleLogEntry[]): boolean {
  if (creature.status === "dormido") {
    events.push({
      kind: "info",
      text: `${creatureName(creature)} duerme profundamente y no puede moverse.`
    });
    return false;
  }

  if (creature.status === "paralizado" && rng() < 0.25) {
    events.push({
      kind: "info",
      text: `${creatureName(creature)} está paralizado y no puede moverse.`
    });
    return false;
  }

  return true;
}

function applyEffect(
  actor: Combatant,
  target: Combatant,
  move: Move,
  rng: Rng,
  events: BattleLogEntry[]
) {
  const effect = move.effect;

  if (!effect) return;

  if (effect.kind === "heal") {
    const maxHp = creatureMaxHp(actor.creature);
    const healed = Math.max(0, Math.round(maxHp * effect.ratio));
    actor.creature.currentHp = Math.min(maxHp, actor.creature.currentHp + healed);
    events.push({
      kind: "status",
      text: `${creatureName(actor.creature)} recupera ${healed} de PS con ${move.name}.`
    });
    return;
  }

  if (effect.kind === "stages") {
    const receiver = effect.target === "self" ? actor : target;
    receiver.creature.stages = applyStages(receiver.creature.stages, effect.cambios);
    const summary = Object.entries(effect.cambios)
      .map(([key, amount]) => `${key} ${(amount ?? 0) > 0 ? "+" : ""}${amount}`)
      .join(", ");
    events.push({
      kind: "stage",
      text: `${creatureName(receiver.creature)}: ${summary}.`
    });
    return;
  }

  if (effect.kind === "confusion") {
    if (rng() < effect.chance) {
      target.creature.status = "confusion";
      target.creature.statusTurns = 3;
      events.push({
        kind: "status",
        text: `${creatureName(target.creature)} quedó confundido.`
      });
    }
    return;
  }

  if (target.creature.status) {
    events.push({
      kind: "status",
      text: `${creatureName(target.creature)} ya está afectado y resiste el estado.`
    });
    return;
  }

  target.creature.status = effect.status;
  target.creature.statusTurns =
    effect.status === "dormido" ? 1 + Math.floor(rng() * 3) : undefined;

  events.push({
    kind: "status",
    text: `${creatureName(target.creature)} quedó ${effect.status}.`
  });
}

function applyEndOfTurn(combatant: Combatant, events: BattleLogEntry[]) {
  const creature = combatant.creature;

  if (creature.status === "veneno" || creature.status === "quemadura") {
    const damage = Math.max(1, Math.floor(creatureMaxHp(creature) / 16));
    creature.currentHp = Math.max(0, creature.currentHp - damage);
    events.push({
      kind: "damage",
      text: `${creatureName(creature)} sufre ${damage} de daño por ${creature.status}.`
    });
  }

  if (creature.status === "dormido" && creature.statusTurns !== undefined) {
    creature.statusTurns -= 1;

    if (creature.statusTurns <= 0) {
      creature.status = undefined;
      creature.statusTurns = undefined;
      events.push({
        kind: "status",
        text: `${creatureName(creature)} se despierta y vuelve a estar alerta.`
      });
    }
  }

  if (creature.status === "confusion") {
    creature.statusTurns = (creature.statusTurns ?? 3) - 1;

    if (creature.statusTurns <= 0) {
      creature.status = undefined;
      creature.statusTurns = undefined;
      events.push({
        kind: "status",
        text: `${creatureName(creature)} recupera la lucidez.`
      });
    }
  }
}

function resolveTurnOrder(
  player: Combatant,
  rival: Combatant,
  playerChoice: { moveId: AnyMoveId; moveIndex: number },
  rivalChoice: { moveId: AnyMoveId; moveIndex: number },
  rng: Rng
): Array<"player" | "foe"> {
  const playerPriority = resolveMove(playerChoice.moveId).priority;
  const rivalPriority = resolveMove(rivalChoice.moveId).priority;

  if (playerPriority !== rivalPriority) {
    return playerPriority > rivalPriority ? ["player", "foe"] : ["foe", "player"];
  }

  const playerSpeed = combatStat(player.creature, "spd");
  const rivalSpeed = combatStat(rival.creature, "spd");

  if (playerSpeed === rivalSpeed) {
    return rng() < 0.5 ? ["player", "foe"] : ["foe", "player"];
  }

  return playerSpeed > rivalSpeed ? ["player", "foe"] : ["foe", "player"];
}

function resolveCapture(
  player: Combatant,
  rival: Combatant,
  rng: Rng,
  events: BattleLogEntry[]
): BattleResult | undefined {
  if (player.bonds <= 0) {
    events.push({ kind: "info", text: "No te quedan vínculos para crear." });
    return undefined;
  }

  player.bonds -= 1;
  const species = getSpecies(rival.creature.speciesId);
  const maxHp = creatureMaxHp(rival.creature);
  const remaining = Math.max(0, rival.creature.currentHp) / maxHp;
  const levelEdge = Math.max(
    0.5,
    Math.min(1.5, rival.creature.level / Math.max(1, player.creature.level))
  );
  const chance = Math.max(
    0.05,
    Math.min(
      0.95,
      (species.catchRate / 255) * (1.6 - remaining) * levelEdge + player.bondBonus
    )
  );

  events.push({
    kind: "capture",
    text: `Lanzas un vínculo hacia ${creatureName(rival.creature)}...`
  });

  if (rng() < chance) {
    events.push({
      kind: "capture",
      text: `¡${creatureName(rival.creature)} acepta el vínculo y se une a tu colección!`
    });
    return "captured";
  }

  events.push({
    kind: "capture",
    text: `¡El vínculo se rompe! ${creatureName(rival.creature)} sigue libre.`
  });
  return undefined;
}

function resolveFlee(
  player: Combatant,
  rival: Combatant,
  turn: number,
  rng: Rng,
  events: BattleLogEntry[]
): BattleResult | undefined {
  const playerSpeed = combatStat(player.creature, "spd");
  const rivalSpeed = combatStat(rival.creature, "spd");
  const chance = Math.max(
    0.15,
    Math.min(0.95, 0.35 + (playerSpeed - rivalSpeed) * 0.02 + turn * 0.05)
  );

  if (rng() < chance) {
    events.push({
      kind: "result",
      text: "Escapas entre la bruma antes de que el alma note la ausencia."
    });
    return "fled";
  }

  events.push({ kind: "info", text: "No has podido huir. El claro te cierra el paso." });
  return undefined;
}

function useItem(
  action: Extract<BattleAction, { kind: "item" }>,
  player: Combatant,
  rival: Combatant,
  bag: Bag,
  events: BattleLogEntry[]
) {
  const item = ITEMS[action.itemId];

  if (!item) {
    events.push({ kind: "info", text: "Ese objeto no existe." });
    return;
  }

  if ((bag.items[action.itemId] ?? 0) <= 0) {
    events.push({ kind: "info", text: `No tienes ${item.name}.` });
    return;
  }

  bag.items[action.itemId] = (bag.items[action.itemId] ?? 0) - 1;

  if (bag.items[action.itemId] === 0) {
    delete bag.items[action.itemId];
  }

  if (item.kind === "cura") {
    const receiver = action.targetIndex === 1 ? rival : player;
    const maxHp = creatureMaxHp(receiver.creature);
    const healed = Math.max(
      0,
      Math.min(maxHp - receiver.creature.currentHp, item.cureAmount ?? 0)
    );
    receiver.creature.currentHp += healed;
    events.push({
      kind: "item",
      text: `${creatureName(receiver.creature)} recupera ${healed} de PS con ${item.name}.`
    });
    return;
  }

  if (item.kind === "revivir") {
    const receiver = action.targetIndex === 1 ? rival : player;
    receiver.creature.currentHp = Math.max(
      1,
      Math.floor(creatureMaxHp(receiver.creature) * (item.reviveRatio ?? 0.5))
    );
    receiver.creature.status = undefined;
    events.push({
      kind: "item",
      text: `${item.name} devuelve la vida a ${creatureName(receiver.creature)}.`
    });
    return;
  }

  if (item.kind === "mejora" && item.stage) {
    const receiver = action.targetIndex === 1 ? rival : player;
    receiver.creature.stages = applyStages(receiver.creature.stages, {
      [item.stage]: item.stages ?? 1
    });
    events.push({
      kind: "item",
      text: `${creatureName(receiver.creature)} sube su ${item.stage} durante la batalla.`
    });
    return;
  }

  if (item.kind === "restaurar") {
    const receiver = action.targetIndex === 1 ? rival : player;
    receiver.creature = restorePP(receiver.creature);
    events.push({
      kind: "item",
      text: `${creatureName(receiver.creature)} recupera los PS de sus movimientos.`
    });
    return;
  }

  if (item.kind === "vinculo") {
    player.bondBonus += item.bondBonus ?? 0.2;
    events.push({
      kind: "item",
      text: `${item.name} refuerza tu próximo vínculo.`
    });
  }
}

function cloneCombatant(combatant: Combatant): Combatant {
  return {
    ...combatant,
    creature: {
      ...combatant.creature,
      moves: [...combatant.creature.moves],
      pp: [...combatant.creature.pp],
      stages: { ...combatant.creature.stages }
    },
    moves: [...combatant.moves]
  };
}

export function canUseMove(combatant: Combatant, index: number): boolean {
  return (combatant.creature.pp[index] ?? 0) > 0;
}

export function hasMovePP(combatant: Combatant): boolean {
  return hasPPLeft(combatant.creature);
}

export type { StatusId };
