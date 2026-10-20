import type { StageKey } from "./stats";
import type { TypeId } from "./types";

export const MOVE_IDS = [
  "bricaje",
  "latigo_hoja",
  "latigo_bruto",
  "esporas",
  "toxina",
  "mordisco",
  "chorro",
  "torrente",
  "brisero",
  "canto",
  "niebla",
  "rocazo",
  "muro_piedra",
  "sombra_fin",
  "pulso",
  "destello",
  "fogonazo",
  "descanso",
  "zarpazo",
  "guardia"
] as const;

export type MoveId = (typeof MOVE_IDS)[number];

export type AnyMoveId = MoveId | "esfuerzo";

export type MoveCategory = "especial" | "status" | "fisico";

export type StatusId = "confusion" | "dormido" | "paralizado" | "quemadura" | "veneno";

export type MoveEffect =
  | { kind: "confusion"; chance: number }
  | { kind: "curacion"; ratio: number }
  | { kind: "status"; status: StatusId }
  | { kind: "etapas"; cambios: Partial<Record<StageKey, number>>; target: "propio" | "rival" };

export type Move = {
  accuracy: number;
  category: MoveCategory;
  critStage: number;
  description: string;
  drain?: number;
  effect?: MoveEffect;
  flinch?: number;
  id: AnyMoveId;
  multiHit?: { max: number; precision: number };
  name: string;
  pp: number;
  power: number;
  priority: number;
  recoil?: number;
  type: TypeId;
};

export const MOVES: Record<MoveId, Move> = {
  brisero: {
    accuracy: 100,
    category: "especial",
    critStage: 0,
    description: "Una ráfaga de bruma que desorienta al rival.",
    effect: { kind: "confusion", chance: 0.3 },
    id: "brisero",
    name: "Brisero",
    pp: 20,
    power: 50,
    priority: 0,
    type: "bruma"
  },
  canto: {
    accuracy: 75,
    category: "status",
    critStage: 0,
    description: "Un arrullo que duerme al rival.",
    effect: { kind: "status", status: "dormido" },
    id: "canto",
    name: "Canto",
    pp: 15,
    power: 0,
    priority: 0,
    type: "bruma"
  },
  bricaje: {
    accuracy: 100,
    category: "fisico",
    critStage: 0,
    description: "Un embestida con todo el cuerpo.",
    id: "bricaje",
    name: "Placaje",
    pp: 35,
    power: 40,
    priority: 0,
    type: "brote"
  },
  guardia: {
    accuracy: 100,
    category: "status",
    critStage: 0,
    description: "Una guardia de piedra que refuerza la defensa.",
    effect: { kind: "etapas", cambios: { def: 1, spd: -1 }, target: "propio" },
    id: "guardia",
    name: "Guardia",
    pp: 20,
    power: 0,
    priority: 0,
    type: "roca"
  },
  chorro: {
    accuracy: 100,
    category: "especial",
    critStage: 0,
    description: "Un chorro de rocío que cleanse las hojas.",
    id: "chorro",
    name: "Chorro",
    pp: 25,
    power: 45,
    priority: 0,
    type: "agua"
  },
  descanso: {
    accuracy: 100,
    category: "status",
    critStage: 0,
    description: "Recupera la mitad de los PS.",
    effect: { kind: "curacion", ratio: 0.5 },
    id: "descanso",
    name: "Descanso",
    pp: 10,
    power: 0,
    priority: 0,
    type: "luz"
  },
  destello: {
    accuracy: 100,
    category: "especial",
    critStage: 1,
    description: "Un fogonazo que ciega al rival.",
    id: "destello",
    name: "Destello",
    pp: 25,
    power: 50,
    priority: 0,
    type: "luz"
  },
  esporas: {
    accuracy: 75,
    category: "status",
    critStage: 0,
    description: "Esporas que envenenan al rival.",
    effect: { kind: "status", status: "veneno" },
    id: "esporas",
    name: "Esporas",
    pp: 20,
    power: 0,
    priority: 0,
    type: "brote"
  },
  fogonazo: {
    accuracy: 100,
    category: "especial",
    critStage: 0,
    description: "Una ráfaga de chispas que golpea varias veces.",
    id: "fogonazo",
    name: "Fogonazo",
    multiHit: { max: 2, precision: 70 },
    pp: 15,
    power: 75,
    priority: 0,
    type: "luz"
  },
  latigo_bruto: {
    accuracy: 85,
    category: "fisico",
    critStage: 0,
    description: "Un latigazo brutal que hiere también a quien lo lanza.",
    id: "latigo_bruto",
    name: "Latigazo bruto",
    pp: 10,
    power: 90,
    priority: 0,
    recoil: 0.25,
    type: "brote"
  },
  latigo_hoja: {
    accuracy: 100,
    category: "especial",
    critStage: 0,
    description: "Un latigazo de hojas afiladas.",
    id: "latigo_hoja",
    name: "Latigazo de hoja",
    pp: 25,
    power: 45,
    priority: 0,
    type: "brote"
  },
  mordisco: {
    accuracy: 95,
    category: "fisico",
    critStage: 0,
    description: "Un mordisco húmedo y rápido.",
    flinch: 0.2,
    id: "mordisco",
    name: "Mordisco",
    pp: 20,
    power: 50,
    priority: 0,
    type: "agua"
  },
  muro_piedra: {
    accuracy: 100,
    category: "status",
    critStage: 0,
    description: "Levanta un muro de roca y afianza la defensa.",
    effect: { kind: "etapas", cambios: { def: 2, atk: -1 }, target: "propio" },
    id: "muro_piedra",
    name: "Muro de piedra",
    pp: 15,
    power: 0,
    priority: 0,
    type: "roca"
  },
  niebla: {
    accuracy: 100,
    category: "status",
    critStage: 0,
    description: "Una nube baja que nubla los ojos del rival.",
    effect: { kind: "etapas", cambios: { acc: -1 }, target: "rival" },
    id: "niebla",
    name: "Niebla",
    pp: 20,
    power: 0,
    priority: 0,
    type: "bruma"
  },
  pulso: {
    accuracy: 90,
    category: "status",
    critStage: 0,
    description: "Un pulso de sombra que paraliza.",
    effect: { kind: "status", status: "paralizado" },
    id: "pulso",
    name: "Pulso",
    pp: 20,
    power: 0,
    priority: 0,
    type: "sombra"
  },
  rocazo: {
    accuracy: 90,
    category: "fisico",
    critStage: 0,
    description: "Una piedra lanzada con fuerza.",
    id: "rocazo",
    name: "Rocazo",
    pp: 20,
    power: 50,
    priority: 0,
    type: "roca"
  },
  sombra_fin: {
    accuracy: 100,
    category: "especial",
    critStage: 0,
    description: "La sombra devora la luz del rival.",
    id: "sombra_fin",
    name: "Sombra fin",
    pp: 15,
    power: 55,
    priority: 0,
    type: "sombra"
  },
  torrente: {
    accuracy: 100,
    category: "especial",
    critStage: 0,
    description: "Una torrentera que roba la vida del rival.",
    drain: 0.5,
    id: "torrente",
    name: "Torrente",
    pp: 15,
    power: 70,
    priority: 0,
    type: "agua"
  },
  toxina: {
    accuracy: 100,
    category: "especial",
    critStage: 0,
    description: "Un canto tóxico que deja la piel en llamas.",
    effect: { kind: "status", status: "quemadura" },
    id: "toxina",
    name: "Toxina",
    pp: 10,
    power: 90,
    priority: 0,
    type: "brote"
  },
  zarpazo: {
    accuracy: 100,
    category: "fisico",
    critStage: 0,
    description: "Un zarpazo que hace dudar al rival.",
    flinch: 0.3,
    id: "zarpazo",
    name: "Zarpazo",
    pp: 20,
    power: 60,
    priority: 0,
    type: "sombra"
  }
};
