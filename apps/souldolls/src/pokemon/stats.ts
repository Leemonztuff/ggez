export type StatKey = "atk" | "def" | "hp" | "spd";

export type StageKey = "acc" | "atk" | "def" | "eva" | "spd";

export type StatStages = Record<StageKey, number>;

export const MAX_STAGE = 6;
export const MIN_STAGE = -6;

export function createStages(): StatStages {
  return { acc: 0, atk: 0, def: 0, eva: 0, spd: 0 };
}

const STAGE_MULTIPLIERS = [2 / 3, 1 / 2, 1 / 2, 1 / 2, 1 / 2, 1 / 2, 1];
const ACCURACY_MULTIPLIERS = [3 / 9, 1 / 3, 1 / 3, 1 / 3, 1 / 3, 1 / 3, 1];
const POSITIVE_MULTIPLIERS = [1, 3 / 2, 2, 5 / 2, 3, 7 / 2, 4];

export function stageMultiplier(stage: number, accuracy = false): number {
  const clamped = Math.max(MIN_STAGE, Math.min(MAX_STAGE, Math.round(stage)));
  const index = clamped + 6;

  if (clamped < 0) {
    const table = accuracy ? ACCURACY_MULTIPLIERS : STAGE_MULTIPLIERS;
    return table[index];
  }

  return POSITIVE_MULTIPLIERS[index];
}

export function applyStages(
  stages: StatStages,
  changes: Partial<Record<StageKey, number>>
): StatStages {
  const next: StatStages = { ...stages };

  for (const [key, amount] of Object.entries(changes) as Array<[StageKey, number]>) {
    next[key] = Math.max(MIN_STAGE, Math.min(MAX_STAGE, next[key] + amount));
  }

  return next;
}

export function stageLabel(stage: number): string {
  if (stage === 0) return "—";
  if (stage > 0) return `+${stage}`;
  return String(stage);
}
