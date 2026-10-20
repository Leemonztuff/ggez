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
  | { kind: "movimiento"; moveIndex: number }
  | { kind: "cambiar"; creature: Creature }
  | { kind: "vinculo" }
  | { kind: "huir" }
  | { kind: "objeto"; itemId: ItemId; targetIndex: number };

export type BattleLogKind =
  | "info"
  | "damage"
  | "status"
  | "faint"
  | "capture"
  | "result"
  | "stage"
  | "item";

export type BattleLogEntry = {
  kind: BattleLogKind;
  text: string;
};

export type Combatant = {
  bondBonus: number;
  creature: Creature;
  flinched: boolean;
  isPlayer: boolean;
  moves: MoveId[];
  vinculos: number;
};

export type BattleResult = "victoria" | "derrota" | "huida" | "captura";

export type BattleModifiers = {
  accuracy?: (type: TypeId) => number;
  damage?: (type: TypeId) => number;
};

export type BattleState = {
  bag: Bag;
  fase: "eleccion" | "fin";
  log: BattleLogEntry[];
  player: Combatant;
  modificadores?: BattleModifiers;
  resultado?: BattleResult;
  rival: Combatant;
  turno: number;
};

export type TurnResolution = {
  status: BattleState;
  eventos: BattleLogEntry[];
};

const STRUGGLE_POWER = 50;
const STRUGGLE_RECOIL = 0.25;
const CONFUSION_CHANCE = 0.33;
const CRIT_CHANCES = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];

export const STRUGGLE_MOVE: Move = {
  accuracy: 100,
  category: "fisico",
  critStage: 0,
  description: "Un último recurso cuando ya no quedan PS de movimientos.",
  id: "esfuerzo",
  name: "Esfuerzo",
  pp: 0,
  power: STRUGGLE_POWER,
  priority: 0,
  recoil: STRUGGLE_RECOIL,
  type: "sombra"
};

export function resolveMove(moveId: AnyMoveId): Move {
  if (moveId === "esfuerzo") {
    return STRUGGLE_MOVE;
  }

  return MOVES[moveId];
}

export function iniciarBatalla(
  player: Combatant,
  rival: Combatant,
  bag: Bag
): BattleState {
  return {
    bag,
    fase: "eleccion",
    log: [
      {
        kind: "info",
        text: `${creatureName(player.creature)} se adelanta frente a ${creatureName(rival.creature)}.`
      }
    ],
    player,
    rival,
    turno: 1
  };
}

export function calculardamage(
  atacante: Creature,
  defensor: Creature,
  move: Move,
  rng: Rng,
  criticoForzado = false,
  modificadores?: BattleModifiers
): { damage: number; critico: boolean; efectividad: number } {
  const atk = statEnCombate(atacante, "atk");
  const def = statEnCombate(defensor, "def");
  const base =
    Math.floor(
      Math.floor(
        (Math.floor((2 * atacante.level) / 5 + 2) * move.power * atk) / Math.max(1, def)
      ) / 50
    ) + 2;
  const stab = getSpecies(atacante.speciesId).types.includes(move.type) ? 1.5 : 1;
  const efectividad = typeEffectiveness(move.type, getSpecies(defensor.speciesId).types);
  const clima = modificadores?.damage?.(move.type) ?? 1;
  const critChance = CRIT_CHANCES[Math.min(CRIT_CHANCES.length - 1, move.critStage)];
  const critico = criticoForzado || rng() < critChance;
  const variacion = 0.85 + rng() * 0.15;
  const damage = Math.max(
    1,
    Math.floor(base * stab * efectividad * clima * (critico ? 1.5 : 1) * variacion)
  );

  return { damage, critico, efectividad };
}

export function resolverTurno(
  state: BattleState,
  accion: BattleAction,
  rng: Rng
): TurnResolution {
  if (state.fase === "fin") {
    return { status: state, eventos: [] };
  }

  const eventos: BattleLogEntry[] = [];
  const player = cloneCombatant(state.player);
  const rival = cloneCombatant(state.rival);
  const bag = state.bag;
  let resultado: BattleResult | undefined = state.resultado;

  if (accion.kind === "vinculo") {
    resultado = resolverVinculo(player, rival, rng, eventos);
  } else if (accion.kind === "huir") {
    resultado = resolverHuida(player, rival, state.turno, rng, eventos);
  } else if (accion.kind === "objeto") {
    usarObjeto(accion, player, rival, bag, eventos);
  } else if (accion.kind === "cambiar") {
    const saliente = creatureName(player.creature);
    player.creature = { ...accion.creature, pp: restorePP(accion.creature).pp };
    eventos.push({
      kind: "info",
      text: `Retiras a ${saliente} y preparas a ${creatureName(player.creature)}.`
    });
  }

  if (!resultado && accion.kind !== "cambiar" && accion.kind !== "objeto") {
    const eleccionplayer = elegirMovimiento(player, accion);
    const eleccionRival = elegirMovimientoRival(rival, player, rng);
    const orden = ordenarTurno(player, rival, eleccionplayer, eleccionRival, rng);

    for (const lado of orden) {
      if (resultado) break;
      if (isFainted(player.creature) || isFainted(rival.creature)) break;

      if (lado === "player") {
        ejecutarMovimiento(player, rival, eleccionplayer, rng, eventos, state.modificadores);
      } else {
        ejecutarMovimiento(rival, player, eleccionRival, rng, eventos, state.modificadores);
      }
    }
  }

  if (!resultado) {
    aplicarstatussFinDeTurno(player, rng, eventos);
    aplicarstatussFinDeTurno(rival, rng, eventos);
  }

  if (!resultado) {
    if (isFainted(rival.creature)) {
      resultado = "victoria";
      eventos.push({
        kind: "result",
        text: `${creatureName(rival.creature)} cae y se disuelve en luz de bruma.`
      });
    } else if (isFainted(player.creature)) {
      resultado = "derrota";
      eventos.push({
        kind: "result",
        text: `${creatureName(player.creature)} ya no puede seguir luchando.`
      });
    }
  }

  return {
    status: {
      bag,
      fase: resultado ? "fin" : "eleccion",
      log: [...state.log, ...eventos],
      player,
      resultado,
      rival,
      turno: state.turno + (resultado ? 0 : 1)
    },
    eventos
  };
}

export function statEnCombate(creature: Creature, key: "atk" | "def" | "spd"): number {
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

export function precisionEfectiva(
  atacante: Creature,
  defensor: Creature,
  precision: number,
  moveType?: TypeId,
  modificadores?: BattleModifiers
): number {
  const clima = moveType ? modificadores?.accuracy?.(moveType) ?? 1 : 1;

  return (
    precision *
    stageMultiplier(atacante.stages.acc, true) *
    stageMultiplier(defensor.stages.eva, true) *
    clima
  );
}

export function elegirMovimientoRival(
  rival: Combatant,
  objetivo: Combatant,
  rng: Rng
): { moveId: AnyMoveId; moveIndex: number } {
  const disponibles = rival.creature.moves
    .map((moveId, index) => ({ moveId, index }))
    .filter(({ index }) => (rival.creature.pp[index] ?? 0) > 0);

  if (disponibles.length === 0) {
    return { moveId: "esfuerzo", moveIndex: -1 };
  }

  let mejor = disponibles[0];
  let mejordamage = -1;

  for (const candidato of disponibles) {
    const move = MOVES[candidato.moveId];    const estimacion =
      move.category === "status"
        ? 0
        : calculardamage(rival.creature, objetivo.creature, move, () => 0.99).damage *
          typeEffectiveness(move.type, getSpecies(objetivo.creature.speciesId).types);

    if (estimacion > mejordamage) {
      mejor = candidato;
      mejordamage = estimacion;
    }
  }

  return { moveId: mejor.moveId, moveIndex: mejor.index };
}

function elegirMovimiento(
  combatiente: Combatant,
  accion: BattleAction
): { moveId: AnyMoveId; moveIndex: number } {
  if (accion.kind !== "movimiento") {
    return { moveId: "esfuerzo", moveIndex: -1 };
  }

  const index = accion.moveIndex;
  const moveId = combatiente.creature.moves[index];
  const pp = combatiente.creature.pp[index] ?? 0;

  if (!moveId || pp <= 0) {
    return { moveId: "esfuerzo", moveIndex: -1 };
  }

  return { moveId, moveIndex: index };
}

function ejecutarMovimiento(
  actor: Combatant,
  objetivo: Combatant,
  eleccion: { moveId: AnyMoveId; moveIndex: number },
  rng: Rng,
  eventos: BattleLogEntry[],
  modificadores?: BattleModifiers
) {
  const creature = actor.creature;

  if (!puedeActuar(creature, rng, eventos)) {
    return;
  }

  if (actor.flinched) {
    actor.flinched = false;
    eventos.push({
      kind: "info",
      text: `${creatureName(creature)} se tambalea y no achieves a actuar.`
    });
    return;
  }

  if (creature.status === "confusion" && rng() < CONFUSION_CHANCE) {
    const dano = Math.max(1, Math.floor(creatureMaxHp(creature) / 8));
    creature.currentHp = Math.max(0, creature.currentHp - dano);
    eventos.push({
      kind: "damage",
      text: `${creatureName(creature)} está confundido y se golpea a sí mismo (${dano}).`
    });
    return;
  }

  if (eleccion.moveId === "esfuerzo") {
    ejecutarEsfuerzo(actor, objetivo, rng, eventos);
    return;
  }

  const move = resolveMove(eleccion.moveId);

  if (eleccion.moveIndex >= 0 && actor.creature.pp[eleccion.moveIndex] > 0) {
    actor.creature.pp[eleccion.moveIndex] -= 1;
  }

  if (
    rng() * 100 >=
    precisionEfectiva(actor.creature, objetivo.creature, move.accuracy, move.type, modificadores)
  ) {
    eventos.push({ kind: "info", text: `El golpe de ${creatureName(creature)} falla.` });
    return;
  }

  if (move.category === "status") {
    aplicarEfecto(actor, objetivo, move, rng, eventos);
    return;
  }

  const golpes = move.multiHit
    ? 1 + Math.floor(rng() * move.multiHit.max)
    : 1;
  let total = 0;
  let ultimoEfecto = 1;

  for (let golpe = 0; golpe < golpes; golpe += 1) {
    if (move.multiHit && golpe > 0 && rng() * 100 >= move.multiHit.precision) {
      break;
    }

    const resultado = calculardamage(actor.creature, objetivo.creature, move, rng, false, modificadores);
    objetivo.creature.currentHp = Math.max(0, objetivo.creature.currentHp - resultado.damage);
    total += resultado.damage;
    ultimoEfecto = resultado.efectividad;
  }

  const mensajeEfecto =
    ultimoEfecto > 1 ? "¡Es supereficaz!" : ultimoEfecto < 1 ? "No es muy eficaz..." : "";
  eventos.push({
    kind: "damage",
    text: `${creatureName(actor.creature)} usa ${move.name} y causa ${total} de daño. ${mensajeEfecto}`.trim()
  });

  if (move.drain) {
    const curado = Math.max(1, Math.floor(total * move.drain));
    const maxHp = creatureMaxHp(actor.creature);
    actor.creature.currentHp = Math.min(maxHp, actor.creature.currentHp + curado);
    eventos.push({
      kind: "info",
      text: `${creatureName(actor.creature)} absorbe ${curado} de PS.`
    });
  }

  if (move.recoil) {
    const rebote = Math.max(1, Math.floor(total * move.recoil));
    actor.creature.currentHp = Math.max(0, actor.creature.currentHp - rebote);
    eventos.push({
      kind: "damage",
      text: `${creatureName(actor.creature)} sufre ${rebote} de daño por el rechazo.`
    });
  }

  if (move.flinch && rng() < move.flinch) {
    objetivo.flinched = true;
    eventos.push({
      kind: "status",
      text: `${creatureName(objetivo.creature)} queda tambaleante.`
    });
  }

  if (isFainted(objetivo.creature)) {
    eventos.push({ kind: "faint", text: `${creatureName(objetivo.creature)} se apaga.` });
  }
}

function ejecutarEsfuerzo(
  actor: Combatant,
  objetivo: Combatant,
  rng: Rng,
  eventos: BattleLogEntry[]
) {
  const movimiento = STRUGGLE_MOVE;
  const { damage } = calculardamage(actor.creature, objetivo.creature, movimiento, rng, true);
  objetivo.creature.currentHp = Math.max(0, objetivo.creature.currentHp - damage);
  const rebote = Math.max(1, Math.floor(creatureMaxHp(actor.creature) * STRUGGLE_RECOIL));
  actor.creature.currentHp = Math.max(0, actor.creature.currentHp - rebote);

  eventos.push({
    kind: "damage",
    text: `¡Sin PS de movimientos, ${creatureName(actor.creature)} usa Esfuerzo y causa ${damage} de daño!`
  });
  eventos.push({
    kind: "damage",
    text: `${creatureName(actor.creature)} sufre ${rebote} de daño por el esfuerzo.`
  });
}

function puedeActuar(creature: Creature, rng: Rng, eventos: BattleLogEntry[]): boolean {
  if (creature.status === "dormido") {
    eventos.push({
      kind: "info",
      text: `${creatureName(creature)} duerme profundamente y no puede moverse.`
    });
    return false;
  }

  if (creature.status === "paralizado" && rng() < 0.25) {
    eventos.push({
      kind: "info",
      text: `${creatureName(creature)} está paralizado y no puede moverse.`
    });
    return false;
  }

  return true;
}

function aplicarEfecto(
  actor: Combatant,
  objetivo: Combatant,
  move: Move,
  rng: Rng,
  eventos: BattleLogEntry[]
) {
  const efecto = move.effect;

  if (!efecto) return;

  if (efecto.kind === "curacion") {
    const maxHp = creatureMaxHp(actor.creature);
    const recuperado = Math.max(0, Math.round(maxHp * efecto.ratio));
    actor.creature.currentHp = Math.min(maxHp, actor.creature.currentHp + recuperado);
    eventos.push({
      kind: "status",
      text: `${creatureName(actor.creature)} recupera ${recuperado} de PS con ${move.name}.`
    });
    return;
  }

  if (efecto.kind === "etapas") {
    const objetivoEtapas = efecto.target === "propio" ? actor : objetivo;
    objetivoEtapas.creature.stages = applyStages(
      objetivoEtapas.creature.stages,
      efecto.cambios
    );
    const resumen = Object.entries(efecto.cambios)
      .map(([key, amount]) => `${key} ${(amount ?? 0) > 0 ? "+" : ""}${amount}`)
      .join(", ");
    eventos.push({
      kind: "stage",
      text: `${creatureName(objetivoEtapas.creature)}: ${resumen}.`
    });
    return;
  }

  if (efecto.kind === "confusion") {
    if (rng() < efecto.chance) {
      objetivo.creature.status = "confusion";
      objetivo.creature.statusTurns = undefined;
      eventos.push({
        kind: "status",
        text: `${creatureName(objetivo.creature)} quedó confundido.`
      });
    }
    return;
  }

  if (objetivo.creature.status) {
    eventos.push({
      kind: "status",
      text: `${creatureName(objetivo.creature)} ya está afectado y resiste el status.`
    });
    return;
  }

  objetivo.creature.status = efecto.status;
  objetivo.creature.statusTurns =
    efecto.status === "dormido" ? 1 + Math.floor(rng() * 3) : undefined;

  eventos.push({
    kind: "status",
    text: `${creatureName(objetivo.creature)} quedó ${efecto.status}.`
  });
}

function aplicarstatussFinDeTurno(combatiente: Combatant, rng: Rng, eventos: BattleLogEntry[]) {
  const creature = combatiente.creature;

  if (creature.status === "veneno") {
    const dano = Math.max(1, Math.floor(creatureMaxHp(creature) / 16));
    creature.currentHp = Math.max(0, creature.currentHp - dano);
    eventos.push({
      kind: "damage",
      text: `${creatureName(creature)} sufre ${dano} de daño por veneno.`
    });
  }

  if (creature.status === "quemadura") {
    const dano = Math.max(1, Math.floor(creatureMaxHp(creature) / 16));
    creature.currentHp = Math.max(0, creature.currentHp - dano);
    eventos.push({
      kind: "damage",
      text: `${creatureName(creature)} sufre ${dano} de daño por la quemadura.`
    });
  }

  if (creature.status === "dormido" && creature.statusTurns !== undefined) {
    creature.statusTurns -= 1;

    if (creature.statusTurns <= 0) {
      creature.status = undefined;
      creature.statusTurns = undefined;
      eventos.push({
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
      eventos.push({
        kind: "status",
        text: `${creatureName(creature)} recupera la lucidez.`
      });
    }
  }

  void rng;
}

function ordenarTurno(
  player: Combatant,
  rival: Combatant,
  eleccionplayer: { moveId: AnyMoveId; moveIndex: number },
  eleccionRival: { moveId: AnyMoveId; moveIndex: number },
  rng: Rng
): Array<"player" | "rival"> {
  const prioridadplayer = resolveMove(eleccionplayer.moveId).priority;
  const prioridadRival = resolveMove(eleccionRival.moveId).priority;

  if (prioridadplayer !== prioridadRival) {
    return prioridadplayer > prioridadRival ? ["player", "rival"] : ["rival", "player"];
  }

  const velocidadplayer = statEnCombate(player.creature, "spd");
  const velocidadRival = statEnCombate(rival.creature, "spd");

  if (velocidadplayer === velocidadRival) {
    return rng() < 0.5 ? ["player", "rival"] : ["rival", "player"];
  }

  return velocidadplayer > velocidadRival ? ["player", "rival"] : ["rival", "player"];
}

function resolverVinculo(
  player: Combatant,
  rival: Combatant,
  rng: Rng,
  eventos: BattleLogEntry[]
): BattleResult | undefined {
  if (player.vinculos <= 0) {
    eventos.push({ kind: "info", text: "No te quedan vínculos para crear." });
    return undefined;
  }

  player.vinculos -= 1;
  const especie = getSpecies(rival.creature.speciesId);
  const maxHp = creatureMaxHp(rival.creature);
  const restante = Math.max(0, rival.creature.currentHp) / maxHp;
  const ventajaNivel = Math.max(
    0.5,
    Math.min(1.5, rival.creature.level / Math.max(1, player.creature.level))
  );
  const probabilidad = Math.max(
    0.05,
    Math.min(
      0.95,
      (especie.catchRate / 255) * (1.6 - restante) * ventajaNivel + player.bondBonus
    )
  );

  eventos.push({
    kind: "capture",
    text: `Lanzas un vínculo hacia ${creatureName(rival.creature)}...`
  });

  if (rng() < probabilidad) {
    eventos.push({
      kind: "capture",
      text: `¡${creatureName(rival.creature)} acepta el vínculo y se une a tu colección!`
    });
    return "captura";
  }

  eventos.push({
    kind: "capture",
    text: `¡El vínculo se rompe! ${creatureName(rival.creature)} sigue libre.`
  });
  return undefined;
}

function resolverHuida(
  player: Combatant,
  rival: Combatant,
  turno: number,
  rng: Rng,
  eventos: BattleLogEntry[]
): BattleResult | undefined {
  const velocidadplayer = statEnCombate(player.creature, "spd");
  const velocidadRival = statEnCombate(rival.creature, "spd");
  const probabilidad = Math.max(
    0.15,
    Math.min(0.95, 0.35 + (velocidadplayer - velocidadRival) * 0.02 + turno * 0.05)
  );

  if (rng() < probabilidad) {
    eventos.push({
      kind: "result",
      text: "Escapas entre la bruma antes de que el alma note la ausencia."
    });
    return "huida";
  }

  eventos.push({ kind: "info", text: "No has podido huir. El claro te cierra el paso." });
  return undefined;
}

function usarObjeto(
  accion: Extract<BattleAction, { kind: "objeto" }>,
  player: Combatant,
  rival: Combatant,
  bag: Bag,
  eventos: BattleLogEntry[]
) {
  const item = ITEMS[accion.itemId];

  if (!item) {
    eventos.push({ kind: "info", text: "Ese objeto no existe." });
    return;
  }

  if ((bag.items[accion.itemId] ?? 0) <= 0) {
    eventos.push({ kind: "info", text: `No tienes ${item.name}.` });
    return;
  }

  bag.items[accion.itemId] = (bag.items[accion.itemId] ?? 0) - 1;

  if (bag.items[accion.itemId] === 0) {
    delete bag.items[accion.itemId];
  }

  if (item.kind === "cura") {
    const objetivo = accion.targetIndex === 1 ? rival : player;
    const maxHp = creatureMaxHp(objetivo.creature);
    const curado = Math.max(0, Math.min(maxHp - objetivo.creature.currentHp, item.cureAmount ?? 0));
    objetivo.creature.currentHp += curado;
    eventos.push({
      kind: "item",
      text: `${creatureName(objetivo.creature)} recupera ${curado} de PS con ${item.name}.`
    });
    return;
  }

  if (item.kind === "revivir") {
    const objetivo = accion.targetIndex === 1 ? rival : player;
    objetivo.creature.currentHp = Math.max(1, Math.floor(creatureMaxHp(objetivo.creature) * (item.reviveRatio ?? 0.5)));
    objetivo.creature.status = undefined;
    eventos.push({
      kind: "item",
      text: `${item.name} devuelve la vida a ${creatureName(objetivo.creature)}.`
    });
    return;
  }

  if (item.kind === "mejora" && item.stage) {
    const objetivo = accion.targetIndex === 1 ? rival : player;
    objetivo.creature.stages = applyStages(objetivo.creature.stages, {
      [item.stage]: item.stages ?? 1
    });
    eventos.push({
      kind: "item",
      text: `${creatureName(objetivo.creature)} sube su ${item.stage} durante la batalla.`
    });
    return;
  }

  if (item.kind === "restaurar") {
    const objetivo = accion.targetIndex === 1 ? rival : player;
    objetivo.creature = restorePP(objetivo.creature);
    eventos.push({
      kind: "item",
      text: `${creatureName(objetivo.creature)} recupera los PS de sus movimientos.`
    });
    return;
  }

  if (item.kind === "vinculo") {
    player.bondBonus += item.bondBonus ?? 0.2;
    eventos.push({
      kind: "item",
      text: `${item.name} refuerza tu próximo vínculo.`
    });
  }
}

function cloneCombatant(combatiente: Combatant): Combatant {
  return {
    ...combatiente,
    creature: {
      ...combatiente.creature,
      moves: [...combatiente.creature.moves],
      pp: [...combatiente.creature.pp],
      stages: { ...combatiente.creature.stages }
    },
    moves: [...combatiente.moves]
  };
}

export function puedeUsarMovimiento(combatiente: Combatant, index: number): boolean {
  return (combatiente.creature.pp[index] ?? 0) > 0;
}

export function tienePP(combatiente: Combatant): boolean {
  return hasPPLeft(combatiente.creature);
}

export type { StatusId };
