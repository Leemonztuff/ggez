import { creatureMaxHp, creatureName, type Creature } from "./creature";
import { createBag, type Bag } from "./inventory";
import { getSpecies } from "./species";

export type Party = {
  bag: Bag;
  creatures: Creature[];
  vinculos: number;
};

export const STARTING_BONDS = 5;
export const BONDS_PER_VICTORY = 2;
export const MAX_PARTY_SIZE = 6;

export function createEmptyParty(): Party {
  return {
    bag: createBag({ brote_curativo: 3, esencia: 1 }),
    creatures: [],
    vinculos: STARTING_BONDS
  };
}

export function partyLeader(party: Party): Creature | undefined {
  return party.creatures[0];
}

export function addToParty(party: Party, creature: Creature): boolean {
  if (party.creatures.length >= MAX_PARTY_SIZE) {
    return false;
  }

  party.creatures.push(creature);
  return true;
}

export function removeFromParty(party: Party, index: number): Creature | undefined {
  if (index < 0 || index >= party.creatures.length) {
    return undefined;
  }

  return party.creatures.splice(index, 1)[0];
}

export function healParty(party: Party) {
  party.creatures = party.creatures.map((creature) => ({
    ...creature,
    currentHp: Math.max(1, creature.currentHp),
    status: undefined,
    statusTurns: undefined
  }));
}

export function healPartyFully(party: Party) {
  party.creatures = party.creatures.map((creature) => ({
    ...creature,
    currentHp: creatureMaxHp(creature),
    status: undefined,
    statusTurns: undefined
  }));
}

export function xpReward(victorioso: Creature, vencido: Creature): number {
  const especie = getSpecies(vencido.speciesId);
  return Math.max(1, Math.floor((especie.xpYield * vencido.level) / 7));
}

export function evReward(vencido: Creature): { atk: number; def: number; hp: number; spd: number } {
  const especie = getSpecies(vencido.speciesId);
  const principal =
    especie.baseStats.atk >= especie.baseStats.spd ? "atk" : "spd";

  return { atk: principal === "atk" ? 2 : 0, def: 0, hp: 1, spd: principal === "spd" ? 2 : 0 };
}

export function battleBondReward(): number {
  return BONDS_PER_VICTORY;
}

export function describeParty(party: Party): string {
  if (party.creatures.length === 0) {
    return "Aún no has vinculado ningún alma.";
  }

  return party.creatures.map((creature) => creatureName(creature)).join(", ");
}
