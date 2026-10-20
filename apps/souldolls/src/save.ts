import { createCreature, type Creature } from "./pokemon/creature";
import type { ItemId } from "./pokemon/items";

const SAVE_KEY = "souldolls.save.v3";
const LEGACY_SAVE_KEY = "souldolls.save.v2";

export type SavedGame = {
  bag: Partial<Record<ItemId, number>>;
  party: Creature[];
  position: { x: number; z: number };
  version: 3;
  vinculos: number;
};

export function loadGame(): SavedGame | undefined {
  const raw = window.localStorage.getItem(SAVE_KEY) ?? window.localStorage.getItem(LEGACY_SAVE_KEY);

  if (!raw) return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateSave(parsed);

    if (!migrated) {
      throw new TypeError("El formato del archivo de partida no es válido.");
    }

    return migrated;
  } catch (error) {
    console.error("No se pudo cargar la partida de Souldolls.", error);
    return undefined;
  }
}

export function saveGame(game: SavedGame) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch (error) {
    console.error("No se pudo guardar la partida de Souldolls.", error);
  }
}

export function clearGame() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    window.localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch (error) {
    console.error("No se pudo borrar la partida de Souldolls.", error);
  }
}

function migrateSave(value: unknown): SavedGame | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<SavedGame> & { version?: number };

  if (candidate.version !== 2 && candidate.version !== 3) {
    return undefined;
  }

  if (!Array.isArray(candidate.party)) {
    return undefined;
  }

  if (!candidate.position || typeof candidate.position.x !== "number") {
    return undefined;
  }

  const party = candidate.party.map((creature) => normalizeCreature(creature));

  return {
    bag: candidate.bag ?? { brote_curativo: 3, esencia: 1 },
    party,
    position: { x: candidate.position.x, z: candidate.position.z },
    version: 3,
    vinculos: typeof candidate.vinculos === "number" ? candidate.vinculos : 5
  };
}

function normalizeCreature(value: unknown): Creature {
  const candidate = (value ?? {}) as Partial<Creature>;
  const base = createCreature(candidate.speciesId ?? "brizna", candidate.level ?? 5, {
    rng: () => 0.5
  });

  return {
    ...base,
    currentHp: typeof candidate.currentHp === "number" ? candidate.currentHp : base.currentHp,
    equipped: candidate.equipped,
    evs: candidate.evs ?? base.evs,
    ivs: candidate.ivs ?? base.ivs,
    level: candidate.level ?? base.level,
    moves: candidate.moves?.length ? candidate.moves : base.moves,
    natureId: candidate.natureId ?? base.natureId,
    nickname: candidate.nickname,
    pp: candidate.pp?.length === candidate.moves?.length ? candidate.pp : base.pp,
    speciesId: candidate.speciesId ?? base.speciesId,
    stages: base.stages,
    status: undefined,
    statusTurns: undefined,
    xp: candidate.xp ?? base.xp
  };
}
