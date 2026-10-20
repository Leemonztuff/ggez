export const TYPE_IDS = ["brote", "bruma", "agua", "roca", "sombra", "luz"] as const;

export type TypeId = (typeof TYPE_IDS)[number];

export const TYPE_NAMES: Record<TypeId, string> = {
  agua: "Agua",
  bruma: "Bruma",
  brote: "Brote",
  luz: "Luz",
  roca: "Roca",
  sombra: "Sombra"
};

export const TYPE_COLORS: Record<TypeId, string> = {
  agua: "#83c8cc",
  bruma: "#b8a7d8",
  brote: "#9acb83",
  luz: "#e7b867",
  roca: "#b08968",
  sombra: "#8a86a8"
};

const TYPE_CHART: Record<TypeId, Partial<Record<TypeId, number>>> = {
  agua: { bruma: 2, roca: 2 },
  bruma: { sombra: 2, roca: 0.5 },
  brote: { agua: 2, roca: 0.5 },
  luz: { bruma: 2, sombra: 0.5 },
  roca: { brote: 2, bruma: 0.5 },
  sombra: { luz: 2, roca: 0.5 }
};

export function typeEffectiveness(attackType: TypeId, defenderTypes: TypeId[]): number {
  return defenderTypes.reduce(
    (multiplier, defenderType) => multiplier * (TYPE_CHART[attackType][defenderType] ?? 1),
    1
  );
}

export function typeLabel(types: TypeId[]): string {
  return types.map((type) => TYPE_NAMES[type]).join(" / ");
}
