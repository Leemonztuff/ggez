export const ITEM_IDS = [
  "brote_curativo",
  "neblina_curativa",
  "flor_vigente",
  "canto_agudo",
  "canto_grave",
  "vinculo_extra",
  "esencia",
  "foco"
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export type ItemTrigger = "hp_bajo" | "hp_critico" | "manual";

export type Item = {
  bondBonus?: number;
  cureAmount?: number;
  description: string;
  id: ItemId;
  kind: "cura" | "mejora" | "revivir" | "vinculo" | "restaurar";
  name: string;
  reviveRatio?: number;
  stage?: "atk" | "def" | "spd";
  stages?: number;
  trigger: ItemTrigger;
};

export const ITEMS: Record<ItemId, Item> = {
  brote_curativo: {
    cureAmount: 30,
    description: "Restaura 30 PS a una sola alma.",
    id: "brote_curativo",
    kind: "cura",
    name: "Brote curativo",
    trigger: "manual"
  },
  canto_agudo: {
    description: "Eleva el ataque de tu alma durante la batalla.",
    id: "canto_agudo",
    kind: "mejora",
    name: "Canto agudo",
    stage: "atk",
    stages: 1,
    trigger: "manual"
  },
  canto_grave: {
    description: "Eleva la defensa de tu alma durante la batalla.",
    id: "canto_grave",
    kind: "mejora",
    name: "Canto grave",
    stage: "def",
    stages: 1,
    trigger: "manual"
  },
  esencia: {
    description: "Restaura por completo los PS de movimiento de un alma.",
    id: "esencia",
    kind: "restaurar",
    name: "Esencia de bruma",
    trigger: "manual"
  },
  foco: {
    description: "Afina el golpe: +1 de precisión permanente en la batalla.",
    id: "foco",
    kind: "mejora",
    name: "Foco de luz",
    stage: "spd",
    stages: 1,
    trigger: "hp_bajo"
  },
  flor_vigente: {
    description: "Revive a un alma debilitada con la mitad de sus PS.",
    id: "flor_vigente",
    kind: "revivir",
    name: "Flor vigente",
    reviveRatio: 0.5,
    trigger: "manual"
  },
  neblina_curativa: {
    cureAmount: 60,
    description: "Restaura 60 PS a una sola alma.",
    id: "neblina_curativa",
    kind: "cura",
    name: "Neblina curativa",
    trigger: "manual"
  },
  vinculo_extra: {
    bondBonus: 0.2,
    description: "Refuerza el siguiente vínculo que lances.",
    id: "vinculo_extra",
    kind: "vinculo",
    name: "Vínculo reforzado",
    trigger: "manual"
  }
};

export function getItem(itemId: ItemId): Item {
  return ITEMS[itemId];
}
