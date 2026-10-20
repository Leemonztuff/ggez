import type { MoveId } from "./moves";
import type { TypeId } from "./types";

export type Species = {
  accent: string;
  baseStats: Stats;
  catchRate: number;
  color: string;
  description: string;
  evolution?: { into: string; level: number };
  id: string;
  learnset: Array<{ level: number; move: MoveId }>;
  name: string;
  title: string;
  types: TypeId[];
  xpYield: number;
};

export type Stats = {
  atk: number;
  def: number;
  hp: number;
  spd: number;
};

export const SPECIES: Record<string, Species> = {
  aural: {
    accent: "#e4f4d9",
    baseStats: { atk: 48, def: 55, hp: 50, spd: 45 },
    catchRate: 180,
    color: "#83c8cc",
    description: "Guarda la memoria de las lluvias que todavía no han llegado.",
    evolution: { into: "lluvia_viva", level: 16 },
    id: "aural",
    learnset: [
      { level: 1, move: "chorro" },
      { level: 4, move: "bricaje" },
      { level: 8, move: "mordisco" },
      { level: 13, move: "canto" }
    ],
    name: "Aural",
    title: "Alma de rocío",
    types: ["agua"],
    xpYield: 64
  },
  brizna: {
    accent: "#f3d88c",
    baseStats: { atk: 49, def: 49, hp: 45, spd: 45 },
    catchRate: 190,
    color: "#9acb83",
    description: "Pequeña guardiana de los brotes y de todo lo que vuelve a empezar.",
    evolution: { into: "musgo_ancestral", level: 16 },
    id: "brizna",
    learnset: [
      { level: 1, move: "latigo_hoja" },
      { level: 4, move: "bricaje" },
      { level: 9, move: "esporas" },
      { level: 14, move: "chorro" }
    ],
    name: "Brizna",
    title: "Alma de musgo",
    types: ["brote"],
    xpYield: 64
  },
  faro: {
    accent: "#fff2ba",
    baseStats: { atk: 62, def: 55, hp: 72, spd: 60 },
    catchRate: 45,
    color: "#f0d38a",
    description: "Su luz marca el camino incluso cuando el bosque se apaga.",
    id: "faro",
    learnset: [
      { level: 1, move: "destello" },
      { level: 1, move: "descanso" },
      { level: 12, move: "pulso" },
      { level: 18, move: "brisero" }
    ],
    name: "Faro",
    title: "Alma faro",
    types: ["luz", "bruma"],
    xpYield: 142
  },
  lluvia_viva: {
    accent: "#bdeef0",
    baseStats: { atk: 55, def: 60, hp: 70, spd: 50 },
    catchRate: 45,
    color: "#6fb9c6",
    description: "La lluvia que cayó una vez y decidió quedarse.",
    id: "lluvia_viva",
    learnset: [
      { level: 1, move: "chorro" },
      { level: 1, move: "mordisco" },
      { level: 10, move: "canto" },
      { level: 16, move: "brisero" }
    ],
    name: "Lluvia Viva",
    title: "Alma de lluvia",
    types: ["agua", "bruma"],
    xpYield: 142
  },
  musgo_ancestral: {
    accent: "#cde8a4",
    baseStats: { atk: 62, def: 63, hp: 65, spd: 55 },
    catchRate: 45,
    color: "#7fb069",
    description: "La raíz que recuerda todas las aldeas que ya no existen.",
    id: "musgo_ancestral",
    learnset: [
      { level: 1, move: "latigo_hoja" },
      { level: 1, move: "chorro" },
      { level: 12, move: "esporas" },
      { level: 20, move: "rocazo" }
    ],
    name: "Musgo Ancestral",
    title: "Alma de raíz",
    types: ["brote", "agua"],
    xpYield: 142
  },
  niebla_ronda: {
    accent: "#ded0f2",
    baseStats: { atk: 45, def: 55, hp: 50, spd: 50 },
    catchRate: 150,
    color: "#b8a7d8",
    description: "Ronda la pradera cuando nadie la está mirando.",
    id: "niebla_ronda",
    learnset: [
      { level: 1, move: "brisero" },
      { level: 5, move: "canto" },
      { level: 11, move: "chorro" }
    ],
    name: "Ronda de Niebla",
    title: "Alma errante",
    types: ["bruma"],
    xpYield: 64
  },
  roca_viva: {
    accent: "#e3c9a8",
    baseStats: { atk: 55, def: 65, hp: 55, spd: 38 },
    catchRate: 120,
    color: "#b08968",
    description: "Escucha el bosque con la paciencia de una montaña.",
    id: "roca_viva",
    learnset: [
      { level: 1, move: "rocazo" },
      { level: 6, move: "bricaje" },
      { level: 14, move: "esporas" }
    ],
    name: "Canto de Roca",
    title: "Alma de piedra",
    types: ["roca"],
    xpYield: 64
  },
  solin: {
    accent: "#fff2ba",
    baseStats: { atk: 52, def: 48, hp: 48, spd: 55 },
    catchRate: 175,
    color: "#e7b867",
    description: "Su luz tenue señala el camino a quienes regresan tarde.",
    evolution: { into: "faro", level: 18 },
    id: "solin",
    learnset: [
      { level: 1, move: "destello" },
      { level: 7, move: "pulso" },
      { level: 12, move: "descanso" }
    ],
    name: "Solin",
    title: "Alma de luciérnaga",
    types: ["luz"],
    xpYield: 64
  },
  sombra_lamp: {
    accent: "#c9c4ee",
    baseStats: { atk: 55, def: 45, hp: 45, spd: 60 },
    catchRate: 150,
    color: "#8a86a8",
    description: "Una sombra que aprendió aarder por dentro.",
    id: "sombra_lamp",
    learnset: [
      { level: 1, move: "sombra_fin" },
      { level: 6, move: "pulso" },
      { level: 13, move: "destello" }
    ],
    name: "Sombra de Luz",
    title: "Alma de penumbra",
    types: ["sombra"],
    xpYield: 64
  }
};

export const SPECIES_IDS = Object.keys(SPECIES);

export function getSpecies(speciesId: string): Species {
  const species = SPECIES[speciesId];

  if (!species) {
    throw new Error(`No existe la especie "${speciesId}".`);
  }

  return species;
}
