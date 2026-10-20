import { describe, expect, test } from "bun:test";
import {
  calculardamage,
  iniciarBatalla,
  resolverTurno,
  type BattleState,
  type Combatant
} from "./battle";
import { createCreature, evolveCreature, gainXp, levelForXp, xpForLevel } from "./creature";
import { MOVES } from "./moves";
import { addToParty, createEmptyParty, xpReward } from "./roster";
import { typeEffectiveness } from "./types";

function combatant(speciesId: string, level: number, isPlayer: boolean): Combatant {
  return {
    creature: createCreature(speciesId, level),
    isPlayer,
    moves: createCreature(speciesId, level).moves,
    vinculos: 5
  };
}

describe("tabla de efectividad", () => {
  test("el brote es supereficaz contra el agua", () => {
    expect(typeEffectiveness("brote", ["agua"])).toBe(2);
  });

  test("el agua es supereficaz contra la bruma", () => {
    expect(typeEffectiveness("agua", ["bruma"])).toBe(2);
  });

  test("la roca es poco eficaz contra la bruma", () => {
    expect(typeEffectiveness("roca", ["bruma"])).toBe(0.5);
  });

  test("los tipos neutros mantienen el multiplicador", () => {
    expect(typeEffectiveness("brote", ["brote"])).toBe(1);
  });
});

describe("cálculo de daño", () => {
  test("el daño escala con la diferencia de ataque y defensa", () => {
    const atacante = createCreature("brizna", 20);
    const defensor = createCreature("musgo_ancestral", 20);
    const { damage } = calculardamage(atacante, defensor, MOVES.placaje, () => 0.99);
    const { damage: danoDebil } = calculardamage(atacante, defensor, MOVES.rocazo, () => 0.99);

    expect(danoDebil).toBeGreaterThan(0);
    expect(damage).toBeGreaterThan(0);
  });

  test("un golpe supereficaz causa más daño que uno normal", () => {
    const brizna = createCreature("brizna", 15);
    const aural = createCreature("aural", 15);

    const supereficaz = calculardamage(brizna, aural, MOVES.latigo_hoja, () => 0.99);
    const normal = calculardamage(brizna, brizna, MOVES.latigo_hoja, () => 0.99);

    expect(supereficaz.damage).toBeGreaterThan(normal.damage);
  });
});

describe("motor de batalla", () => {
  test("un movimiento reduce los PS del rival y queda registrado", () => {
    const status: BattleState = iniciarBatalla(
      combatant("brizna", 10, true),
      combatant("aural", 10, false)
    );
    const hpInicial = status.rival.creature.currentHp;

    const { status: siguiente, eventos } = resolverTurno(
      status,
      { kind: "movimiento", moveIndex: 0 },
      () => 0.99
    );

    expect(siguiente.rival.creature.currentHp).toBeLessThan(hpInicial);
    expect(eventos.some((evento) => evento.kind === "damage")).toBe(true);
  });

  test("el turno avanza mientras la batalla sigue viva", () => {
    const status = iniciarBatalla(combatant("brizna", 20, true), combatant("aural", 20, false));

    const { status: siguiente } = resolverTurno(
      status,
      { kind: "movimiento", moveIndex: 0 },
      () => 0.99
    );

    expect(siguiente.turno).toBe(status.turno + 1);
    expect(siguiente.fase).toBe("eleccion");
  });

  test("un vínculo puede capturar al rival", () => {
    const status = iniciarBatalla(combatant("brizna", 5, true), combatant("aural", 5, false));

    const { status: siguiente, eventos } = resolverTurno(status, { kind: "vinculo" }, () => 0);

    expect(siguiente.resultado).toBe("captura");
    expect(eventos.some((evento) => evento.kind === "capture")).toBe(true);
    expect(siguiente.player.vinculos).toBe(4);
  });

  test("sin vínculos el intento de captura no se resuelve", () => {
    const player = combatant("brizna", 5, true);
    player.vinculos = 0;
    const status = iniciarBatalla(player, combatant("aural", 5, false));

    const { status: siguiente, eventos } = resolverTurno(status, { kind: "vinculo" }, () => 0);

    expect(siguiente.resultado).toBeUndefined();
    expect(eventos.some((evento) => evento.text.includes("No te quedan vínculos"))).toBe(true);
  });

  test("la batalla termina cuando el rival cae", () => {
    const status = iniciarBatalla(combatant("faro", 30, true), combatant("sombra_lamp", 2, false));

    const { status: siguiente } = resolverTurno(
      status,
      { kind: "movimiento", moveIndex: 0 },
      () => 0.99
    );

    expect(siguiente.resultado).toBe("victoria");
    expect(siguiente.fase).toBe("fin");
  });
});

describe("progresión", () => {
  test("la experiencia determina el nivel", () => {
    expect(levelForXp(xpForLevel(12))).toBe(12);
  });

  test("ganar experiencia puede subir de nivel", () => {
    const creature = createCreature("brizna", 5);
    const resultado = gainXp(creature, 4000);

    expect(resultado.levelsGained).toBeGreaterThan(0);
    expect(resultado.creature.level).toBeGreaterThan(creature.level);
  });

  test("las especies evolucionan al alcanzar el nivel", () => {
    const creature = createCreature("brizna", 16);
    const evolucionada = evolveCreature(creature);

    expect(evolucionada.speciesId).toBe("musgo_ancestral");
    expect(evolucionada.level).toBe(16);
  });

  test("la recompensa de experiencia depende de la especie vencida", () => {
    const recompensa = xpReward(createCreature("brizna", 20), createCreature("aural", 20));

    expect(recompensa).toBeGreaterThan(0);
  });
});

describe("colección", () => {
  test("la colección admite un máximo de seis almas", () => {
    const party = createEmptyParty();

    for (let index = 0; index < 8; index += 1) {
      addToParty(party, createCreature("brizna", 5));
    }

    expect(party.creatures.length).toBe(6);
  });
});
