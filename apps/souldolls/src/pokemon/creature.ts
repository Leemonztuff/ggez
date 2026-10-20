import { ITEMS, type ItemId } from "./items";
import { MOVES, type MoveId, type StatusId } from "./moves";
import { NATURES, NEUTRAL_NATURE_ID, natureMultiplier } from "./natures";
import { getSpecies, type Stats } from "./species";
import { createStages, type StatStages } from "./stats";

export type Creature = {
  currentHp: number;
  equipped?: ItemId;
  evs: Stats;
  ivs: Stats;
  level: number;
  moves: MoveId[];
  nickname?: string;
  natureId: string;
  pp: number[];
  speciesId: string;
  stages: StatStages;
  status?: StatusId;
  statusTurns?: number;
  xp: number;
};

export type Rng = () => number;

export const MAX_PARTY_SIZE = 6;
export const MAX_EV_PER_STAT = 252;
export const MAX_EV_TOTAL = 510;

export function xpForLevel(level: number): number {
  return level * level * level;
}

export function levelForXp(xp: number): number {
  let level = 1;

  while (xpForLevel(level + 1) <= xp && level < 100) {
    level += 1;
  }

  return level;
}

export function computeStats(
  speciesId: string,
  level: number,
  bonus: { evs?: Stats; ivs?: Stats; natureId?: string } = {}
): Stats {
  const species = getSpecies(speciesId);
  const ivs = bonus.ivs ?? zeroStats();
  const evs = bonus.evs ?? zeroStats();
  const natureId = bonus.natureId ?? NEUTRAL_NATURE_ID;
  const nature = NATURES.find((item) => item.id === natureId);

  const effort = (key: keyof Stats) => Math.floor(evs[key] / 4);

  return {
    atk: Math.round(
      natureMultiplier(natureId, "atk") *
        (Math.floor(((2 * species.baseStats.atk + ivs.atk + effort("atk")) * level) / 100) + 5)
    ),
    def: Math.round(
      natureMultiplier(natureId, "def") *
        (Math.floor(((2 * species.baseStats.def + ivs.def + effort("def")) * level) / 100) + 5)
    ),
    hp:
      Math.floor(((2 * species.baseStats.hp + ivs.hp + effort("hp")) * level) / 100) + level + 10,
    spd: Math.round(
      natureMultiplier(natureId, "spd") *
        (Math.floor(((2 * species.baseStats.spd + ivs.spd + effort("spd")) * level) / 100) + 5)
    )
  };
}

export function movesForLevel(speciesId: string, level: number): MoveId[] {
  const species = getSpecies(speciesId);
  return species.learnset
    .filter((entry) => entry.level <= level)
    .sort((left, right) => left.level - right.level)
    .slice(-4)
    .map((entry) => entry.move);
}

export function createCreature(
  speciesId: string,
  level: number,
  options: { evs?: Stats; ivs?: Stats; natureId?: string; rng?: Rng } = {}
): Creature {
  const rng = options.rng ?? Math.random;
  const ivs = options.ivs ?? randomStats(rng);
  const evs = options.evs ?? zeroStats();
  const natureId = options.natureId ?? pickNature(rng);
  const moves = movesForLevel(speciesId, level);
  const stats = computeStats(speciesId, level, { evs, ivs, natureId });

  return {
    currentHp: stats.hp,
    evs,
    ivs,
    level,
    moves,
    natureId,
    pp: moves.map((moveId) => MOVES[moveId].pp),
    speciesId,
    stages: createStages(),
    xp: xpForLevel(level)
  };
}

export function creatureName(creature: Creature): string {
  return creature.nickname ?? getSpecies(creature.speciesId).name;
}

export function creatureMaxHp(creature: Creature): number {
  return computeStats(creature.speciesId, creature.level, {
    evs: creature.evs,
    ivs: creature.ivs,
    natureId: creature.natureId
  }).hp;
}

export function creatureStat(creature: Creature, key: keyof Stats): number {
  return computeStats(creature.speciesId, creature.level, {
    evs: creature.evs,
    ivs: creature.ivs,
    natureId: creature.natureId
  })[key];
}

export function isFainted(creature: Creature): boolean {
  return creature.currentHp <= 0;
}

export function healCreature(creature: Creature): Creature {
  return {
    ...creature,
    currentHp: creatureMaxHp(creature),
    stages: createStages(),
    status: undefined,
    statusTurns: undefined
  };
}

export function restorePP(creature: Creature): Creature {
  return { ...creature, pp: creature.moves.map((moveId) => MOVES[moveId].pp) };
}

export function hasPPLeft(creature: Creature): boolean {
  return creature.moves.some((_, index) => creature.pp[index] > 0);
}

export type LevelUpResult = {
  creature: Creature;
  learnedMove?: MoveId;
  levelsGained: number;
};

export function gainXp(creature: Creature, amount: number): LevelUpResult {
  const nextXp = creature.xp + amount;
  const nextLevel = levelForXp(nextXp);

  if (nextLevel <= creature.level) {
    return { creature: { ...creature, xp: nextXp }, levelsGained: 0 };
  }

  const previousMaxHp = creatureMaxHp(creature);
  const nextStats = computeStats(creature.speciesId, nextLevel, {
    evs: creature.evs,
    ivs: creature.ivs,
    natureId: creature.natureId
  });
  const gainedHp = Math.max(0, nextStats.hp - previousMaxHp);

  let moves = [...creature.moves];
  let pp = [...creature.pp];
  let learnedMove: MoveId | undefined;

  for (const entry of getSpecies(creature.speciesId).learnset) {
    if (entry.level > creature.level && entry.level <= nextLevel) {
      learnedMove = entry.move;
    }
  }

  if (learnedMove && !moves.includes(learnedMove)) {
    if (moves.length >= 4) {
      moves = moves.slice(1);
      pp = pp.slice(1);
    }

    moves = [...moves, learnedMove];
    pp = [...pp, MOVES[learnedMove].pp];
  }

  return {
    creature: {
      ...creature,
      currentHp: Math.min(nextStats.hp, creature.currentHp + gainedHp),
      level: nextLevel,
      moves,
      pp,
      xp: nextXp
    },
    learnedMove,
    levelsGained: nextLevel - creature.level
  };
}

export function gainEVs(creature: Creature, rewards: Partial<Stats>): Creature {
  const evs: Stats = { ...creature.evs };
  let total = evs.atk + evs.def + evs.hp + evs.spd;

  for (const [key, amount] of Object.entries(rewards) as Array<[keyof Stats, number]>) {
    if (!amount) continue;
    const allowed = Math.min(MAX_EV_PER_STAT, evs[key] + amount);
    const capped = Math.min(allowed, evs[key] + Math.max(0, MAX_EV_TOTAL - total));
    total += capped - evs[key];
    evs[key] = capped;
  }

  return { ...creature, evs };
}

export function evolveCreature(creature: Creature): Creature {
  const evolution = getSpecies(creature.speciesId).evolution;

  if (!evolution || creature.level < evolution.level) {
    return creature;
  }

  const evolved = getSpecies(evolution.into);
  const stats = computeStats(evolved.id, creature.level, {
    evs: creature.evs,
    ivs: creature.ivs,
    natureId: creature.natureId
  });
  const hpRatio = creature.currentHp / creatureMaxHp(creature);
  const moves = movesForLevel(evolved.id, creature.level);

  return {
    ...creature,
    currentHp: Math.max(1, Math.round(stats.hp * hpRatio)),
    moves,
    pp: moves.map((moveId) => MOVES[moveId].pp),
    speciesId: evolved.id
  };
}

export function equippedItem(creature: Creature) {
  return creature.equipped ? ITEMS[creature.equipped] : undefined;
}

function zeroStats(): Stats {
  return { atk: 0, def: 0, hp: 0, spd: 0 };
}

function randomStats(rng: Rng): Stats {
  return {
    atk: Math.floor(rng() * 32),
    def: Math.floor(rng() * 32),
    hp: Math.floor(rng() * 32),
    spd: Math.floor(rng() * 32)
  };
}

function pickNature(rng: Rng): string {
  return NATURES[Math.floor(rng() * NATURES.length)].id;
}
