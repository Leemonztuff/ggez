import { describe, expect, test } from "bun:test";
import {
  createGameplayRuntime,
  createGameplayRuntimeSceneFromRuntimeScene
} from "@ggez/gameplay-runtime";
import { parseRuntimeScene } from "@ggez/runtime-format";
import { createSouldollsSystems } from "./gameplay/systems";
import { createSouldollsRuntimeScene, WILD_CREATURES } from "./scene/souldolls-scene";

describe("integración con la plataforma", () => {
  test("la escena del claro es una escena de runtime válida", () => {
    const escena = parseRuntimeScene(JSON.stringify(createSouldollsRuntimeScene()));

    expect(escena.metadata.format).toBe("web-hammer-engine");
    expect(escena.entities.length).toBe(WILD_CREATURES.length + 2);
    expect(escena.nodes.length).toBeGreaterThan(50);
  });

  test("las creatures salvajes declaran hooks de interacción y proximidad", () => {
    const escena = createSouldollsRuntimeScene();

    for (const wild of WILD_CREATURES) {
      const entidad = escena.entities.find((item) => item.id === wild.entityId);
      const tipos = (entidad?.hooks ?? []).map((hook) => hook.type);

      expect(tipos).toContain("interactable");
      expect(tipos).toContain("trigger_volume");
    }
  });

  test("acercarse a un alma dispara el trigger y permite interactuar", () => {
    const escena = createSouldollsRuntimeScene();
    const runtime = createGameplayRuntime({
      scene: createGameplayRuntimeSceneFromRuntimeScene(escena),
      systems: createSouldollsSystems()
    });

    const eventos: string[] = [];
    runtime.onEvent((event) => {
      eventos.push(event.event);
    });

    const wild = WILD_CREATURES[0];
    const entidad = escena.entities.find((item) => item.id === wild.entityId);
    const position = entidad?.transform.position ?? { x: 0, y: 0, z: 0 };

    runtime.updateActor({
      height: 1.8,
      id: "player",
      position: { x: position.x, y: 0.72, z: position.z },
      radius: 0.4,
      tags: ["player"]
    });

    runtime.start();
    runtime.update(0.016);

    expect(eventos).toContain("trigger.enter");

    runtime.emitEvent({
      event: "interact.requested",
      sourceId: "player",
      sourceKind: "system",
      targetId: wild.entityId
    });
    runtime.update(0.016);

    expect(eventos).toContain("interact.started");
  });

  test("hablar con Mara entrega el primer vínculo una sola vez", () => {
    const escena = createSouldollsRuntimeScene();
    const runtime = createGameplayRuntime({
      scene: createGameplayRuntimeSceneFromRuntimeScene(escena),
      systems: createSouldollsSystems()
    });

    const eventos: string[] = [];
    runtime.onEvent((event) => {
      eventos.push(event.event);
    });

    const keeper = escena.entities.find((item) => item.id === "entity:npc:mara");
    const position = keeper?.transform.position ?? { x: 0, y: 0, z: 0 };

    runtime.updateActor({
      height: 1.8,
      id: "player",
      position: { x: position.x, y: 0.72, z: position.z },
      radius: 0.4,
      tags: ["player"]
    });

    runtime.start();
    runtime.update(0.016);

    runtime.emitEvent({
      event: "interact.requested",
      sourceId: "player",
      sourceKind: "system",
      targetId: "entity:npc:mara"
    });
    runtime.update(0.016);

    expect(eventos).toContain("mara.entrega");
    expect(runtime.getWorldState("mara_gift")).toBe(true);

    runtime.emitEvent({
      event: "interact.requested",
      sourceId: "player",
      sourceKind: "system",
      targetId: "entity:npc:mara"
    });
    runtime.update(0.016);

    expect(eventos.filter((evento) => evento === "mara.entrega")).toHaveLength(1);
  });
});
