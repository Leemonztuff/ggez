import { getSpecies } from "../pokemon/species";
import type { DayPhase, Weather, Zone } from "./zones";

export type Encounter = {
  level: number;
  speciesId: string;
};

export function rollEncounter(
  zone: Zone,
  phase: DayPhase,
  weather: Weather,
  rng: () => number = Math.random
): Encounter | undefined {
  if (zone.safe) {
    return undefined;
  }

  const candidates = zone.encounters.filter((entry) => entry.phases.includes(phase));

  if (candidates.length === 0) {
    return undefined;
  }

  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  let elegido = candidates[0];

  for (const candidato of candidates) {
    roll -= candidato.weight;

    if (roll <= 0) {
      elegido = candidato;
      break;
    }
  }

  const especie = getSpecies(elegido.speciesId);
  const levelSpan = Math.max(0, elegido.maxLevel - elegido.minLevel);
  let nivel = elegido.minLevel + Math.floor(rng() * (levelSpan + 1));

  if (weather === "lluvia" && especie.types.includes("agua")) {
    nivel = Math.min(elegido.maxLevel, nivel + 1);
  }

  if (weather === "noche" && especie.types.includes("sombra")) {
    nivel = Math.min(elegido.maxLevel, nivel + 1);
  }

  return { level: nivel, speciesId: elegido.speciesId };
}

export function encounterChancePerSecond(zone: Zone, phase: DayPhase): number {
  if (zone.safe) {
    return 0;
  }

  if (phase === "noche") {
    return 0.11;
  }

  if (phase === "atardecer") {
    return 0.08;
  }

  return 0.055;
}
