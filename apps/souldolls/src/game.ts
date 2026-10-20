import {
  createGameplayRuntime,
  createGameplayRuntimeSceneFromRuntimeScene,
  type GameplayRuntime,
  type GameplayRuntimeHost
} from "@ggez/gameplay-runtime";
import { createThreeRuntimeSceneInstance, type ThreeRuntimeSceneInstance } from "@ggez/three-runtime/loader";
import {
  ACESFilmicToneMapping,
  CircleGeometry,
  Clock,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Sprite,
  SRGBColorSpace,
  WebGLRenderer
} from "three";
import { createGameInput } from "./input";
import { loadGame, saveGame } from "./save";
import { createCharacterSprite, createCreatureSprite } from "./sprites";
import { GameUI } from "./ui";
import type { ActorTarget } from "./types";
import { createSouldollsSystems } from "./gameplay/systems";
import {
  createSouldollsRuntimeScene,
  SOULDOLLS_ENTITY_IDS,
  WILD_CREATURES,
  type WildDefinition
} from "./scene/souldolls-scene";
import { BattleUI, type BattleUiAction } from "./pokemon/battle-ui";
import {
  iniciarBatalla,
  resolverTurno,
  type BattleLogEntry,
  type BattleState
} from "./pokemon/battle";
import {
  creatureName,
  createCreature,
  evolveCreature,
  gainXp,
  type Creature
} from "./pokemon/creature";
import {
  addToParty,
  createEmptyParty,
  healParty,
  partyLeader,
  xpReward,
  type Party
} from "./pokemon/roster";
import { getSpecies } from "./pokemon/species";

const WALK_SPEED = 4.4;
const PLAYER_RADIUS = 0.4;
const PLAYER_HEIGHT = 1.8;
const PLAYER_BASE_Y = 0.72;
const WORLD_LIMIT_X = 15.5;
const WORLD_LIMIT_Z = 16.5;
const WILD_SPEED = 1.15;
const WILD_RADIUS = 3.6;
const CONTACT_DISTANCE = 1.15;

type CharacterBinding = {
  base: { x: number; y: number; z: number };
  kind: "keeper" | "player" | "wild";
  phase: number;
  sprite: Sprite;
};

type WildState = {
  definition: WildDefinition;
  lastWritten: { x: number; z: number };
  target: { x: number; z: number };
  timer: number;
  visual: { x: number; z: number };
};

type ActiveBattle = {
  activeIndex: number;
  status: BattleState;
  rival: Creature;
  wild: WildState;
};

export async function createSouldollsGame(root: HTMLElement) {
  const saved = loadGame();
  const party: Party = saved
    ? { creatures: saved.party, vinculos: saved.vinculos }
    : createEmptyParty();

  const bindings = new Map<string, CharacterBinding>();
  const nearbyTargets = new Set<string>();
  const wilds = new Map<string, WildState>();
  let battle: ActiveBattle | undefined;

  const ui = new GameUI(root, {
    interact: () => interact(),
    party: () => ui.toggleParty(party),
    setDirection: (direction, pressed) => {
      if (pressed) input.directions.add(direction);
      else input.directions.delete(direction);
    }
  });

  const battleUi = new BattleUI(root, {
    onAction: (action) => submitBattleAction(action)
  });

  const stage = root.querySelector<HTMLElement>("[data-world]");
  if (!stage) throw new Error("No se encontró el escenario 3D del juego.");

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-label", "Claro de Bruma, escenario de exploración 3D");
  stage.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color("#c7dce0");

  const runtimeScene = createSouldollsRuntimeScene();
  const instance = await createThreeRuntimeSceneInstance(runtimeScene, {
    applyToRenderer: renderer,
    applyToScene: scene
  });
  scene.add(instance.root);
  configureSceneShadows(instance);

  const camera = new PerspectiveCamera(43, 1, 0.1, 100);
  const cameraOffset = { x: 0, y: 11.5, z: 13.5 };

  const targets = createActorTargets();

  const host: GameplayRuntimeHost = {
    applyEntityWorldTransform(entityId, transform) {
      const binding = bindings.get(entityId);
      if (!binding) return;
      binding.base.x = transform.position.x;
      binding.base.y = transform.position.y;
      binding.base.z = transform.position.z;
    }
  };

  const runtime: GameplayRuntime = createGameplayRuntime({
    host,
    scene: createGameplayRuntimeSceneFromRuntimeScene(runtimeScene),
    systems: createSouldollsSystems()
  });

  const initialTransform = runtime.getEntityWorldTransform(SOULDOLLS_ENTITY_IDS.player);
  const playerPosition = {
    x: saved?.position.x ?? initialTransform?.position.x ?? 0,
    z: saved?.position.z ?? initialTransform?.position.z ?? 13.2
  };

  createCharacters(scene, bindings, wilds);
  const playerMarker = createPlayerMarker(scene);

  runtime.onEvent((event) => {
    const targetId = event.targetId;

    if (event.event === "trigger.enter" && targetId) {
      nearbyTargets.add(targetId);
      return;
    }

    if (event.event === "trigger.exit" && targetId) {
      nearbyTargets.delete(targetId);
      return;
    }

    if (event.event === "mara.entrega") {
      deliverStarter();
      return;
    }

    if (event.event === "interact.started" && targetId) {
      const target = targets.get(targetId);
      if (!target) return;

      if (target.type === "keeper") {
        ui.showDialogue(
          "Mara, guardabosques",
          "El bosque te ha sentido llegar. Toma a Brizna: un Alma de musgo que ya confía en ti. Después, desafía a las luces del claro y créales un vínculo."
        );
        return;
      }

      const wild = wilds.get(targetId);
      if (wild) {
        startBattle(wild);
      }
    }
  });

  runtime.start();

  const sun = resolveSun(instance);
  const sunAnchor = instance.nodesById.get("node:souldolls:light:directional");
  configureSunShadow(sun);

  const input = createGameInput(root, {
    interact: () => interact(),
    toggleParty: () => ui.toggleParty(party)
  });

  const setSize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(setSize);
  resizeObserver.observe(stage);
  setSize();

  function interact() {
    if (ui.isDialogueOpen || ui.isPartyOpen || battleUi.isBattleOpen) return;

    const targetId = findNearbyTarget();

    if (!targetId) {
      ui.showToast("Sigue el sendero; hay alguien cerca.");
      return;
    }

    runtime.emitEvent({
      event: "interact.requested",
      sourceId: "player",
      sourceKind: "system",
      targetId
    });
  }

  function findNearbyTarget(): string | undefined {
    let nearest: string | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const targetId of nearbyTargets) {
      const target = targets.get(targetId);
      if (!target) continue;

      const transform = runtime.getTargetWorldTransform(targetId);
      if (!transform) continue;

      const distance = Math.hypot(
        playerPosition.x - transform.position.x,
        playerPosition.z - transform.position.z
      );

      if (distance < nearestDistance) {
        nearest = targetId;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  function deliverStarter() {
    if (party.creatures.length > 0) {
      return;
    }

    const starter = createCreature("brizna", 5);
    addToParty(party, starter);
    party.vinculos += 1;
    persistGame();
    ui.showToast("Brizna se une a tu colección");
  }

  function startBattle(wild: WildState) {
    if (battle) return;

    const leader = partyLeader(party);

    if (!leader) {
      ui.showToast("Necesitas un alma propia para desafiar. Habla con Mara.");
      return;
    }

    const species = getSpecies(wild.definition.speciesId);
    const rival = createCreature(wild.definition.speciesId, wild.definition.level);
    const status = iniciarBatalla(
      {
        creature: { ...leader },
        isPlayer: true,
        moves: [...leader.moves],
        vinculos: party.vinculos
      },
      {
        creature: rival,
        isPlayer: false,
        moves: [...rival.moves],
        vinculos: 0
      }
    );

    battle = { activeIndex: 0, status, rival, wild };
    battleUi.clearLog();
    battleUi.open();
    battleUi.render(status, party, 0);
    battleUi.appendLog({
      kind: "info",
      text: `¡${species.name} salvaje aparece! Usa Vínculo para intentar unificarlo.`
    });
  }

  function submitBattleAction(action: BattleUiAction) {
    if (!battle || battle.status.fase === "fin") return;

    if (action.kind === "cambiar") {
      const next = party.creatures[action.index];
      if (!next || action.index === battle.activeIndex) return;
      party.creatures[battle.activeIndex] = battle.status.player.creature;
      battle.activeIndex = action.index;
      battle.status = {
        ...battle.status,
        player: { ...battle.status.player, creature: { ...next } }
      };
    }

    const engineAction =
      action.kind === "cambiar"
        ? { kind: "cambiar" as const, creature: party.creatures[action.index] }
        : action;

    const resolution = resolverTurno(battle.status, engineAction, Math.random);
    battle.status = resolution.status;
    party.vinculos = battle.status.player.vinculos;
    battleUi.setLocked(true);
    battleUi.render(battle.status, party, battle.activeIndex);
    playEvents(resolution.eventos, () => {
      if (!battle) return;
      if (battle.status.fase === "fin") {
        finishBattle();
      } else {
        battleUi.setLocked(false);
      }
    });
  }

  function playEvents(events: BattleLogEntry[], done: () => void) {
    if (events.length === 0) {
      done();
      return;
    }

    const [first, ...rest] = events;
    battleUi.appendLog(first);
    window.setTimeout(() => playEvents(rest, done), 420);
  }

  function finishBattle() {
    if (!battle) return;

    const finished = battle;
    battle = undefined;

    party.creatures[finished.activeIndex] = finished.status.player.creature;
    party.vinculos = finished.status.player.vinculos;

    if (finished.status.resultado === "captura") {
      const captured = finished.rival;
      const added = addToParty(party, captured);
      releaseWild(finished.wild, true);

      if (added) {
        ui.showToast(`${creatureName(captured)} acepta el vínculo y se une a tu colección`);
      } else {
        ui.showToast("Tu colección está llena: el alma vuelve al claro");
      }
    } else if (finished.status.resultado === "victoria") {
      const leader = party.creatures[finished.activeIndex];
      const reward = xpReward(leader, finished.rival);
      const result = gainXp(leader, reward);
      let leveled = result.creature;

      if (result.levelsGained > 0) {
        leveled = evolveCreature(leveled);
        ui.showToast(
          `${creatureName(leveled)} alcanzó el nivel ${leveled.level}${
            leveled.speciesId !== result.creature.speciesId ? " y evolucionó" : ""
          }`
        );
      }

      party.creatures[finished.activeIndex] = leveled;
      party.vinculos += 2;
      releaseWild(finished.wild, true);
      healParty(party);
    } else if (finished.status.resultado === "derrota") {
      healParty(party);
      playerPosition.x = 0;
      playerPosition.z = 13.2;
      runtime.setTargetLocalTransform(SOULDOLLS_ENTITY_IDS.player, {
        position: { x: playerPosition.x, y: PLAYER_BASE_Y, z: playerPosition.z },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      ui.showToast("El claro te devuelve al sendero con tus almas descansadas");
    }

    persistGame();
    battleUi.close();
    battleUi.setLocked(false);
  }

  function releaseWild(wild: WildState, defeated: boolean) {
    if (!defeated) return;

    const binding = bindings.get(wild.definition.entityId);
    binding?.sprite.removeFromParent();
    setWildHooks(wild, false);
    wild.timer = 999;

    if (wild.definition.roaming) {
      window.setTimeout(() => {
        const respawn = bindings.get(wild.definition.entityId);
        if (respawn) {
          scene.add(respawn.sprite);
        }
        setWildHooks(wild, true);
        wild.timer = 0;
      }, 8000);
    }
  }

  function setWildHooks(wild: WildState, enabled: boolean) {
    const speciesId = wild.definition.speciesId;

    for (const hookId of [
      `hook:wild:${speciesId}:interact`,
      `hook:wild:${speciesId}:proximity`
    ]) {
      const target = runtime.getHookTarget(wild.definition.entityId, hookId);
      if (target) {
        target.hook.enabled = enabled;
      }
    }
  }

  function persistGame() {
    saveGame({
      party: party.creatures,
      position: { x: playerPosition.x, z: playerPosition.z },
      version: 2,
      vinculos: party.vinculos
    });
  }

  function update() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const blocked = ui.isDialogueOpen || ui.isPartyOpen || battleUi.isBattleOpen;
    let moveX = 0;
    let moveZ = 0;

    if (!blocked) {
      if (input.directions.has("left")) moveX -= 1;
      if (input.directions.has("right")) moveX += 1;
      if (input.directions.has("up")) moveZ -= 1;
      if (input.directions.has("down")) moveZ += 1;
    }

    const moving = moveX !== 0 || moveZ !== 0;

    if (moving) {
      const length = Math.hypot(moveX, moveZ);
      playerPosition.x = clamp(
        playerPosition.x + (moveX / length) * WALK_SPEED * delta,
        -WORLD_LIMIT_X,
        WORLD_LIMIT_X
      );
      playerPosition.z = clamp(
        playerPosition.z + (moveZ / length) * WALK_SPEED * delta,
        -WORLD_LIMIT_Z,
        WORLD_LIMIT_Z
      );

      runtime.setTargetLocalTransform(SOULDOLLS_ENTITY_IDS.player, {
        position: { x: playerPosition.x, y: PLAYER_BASE_Y, z: playerPosition.z },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
    }

    runtime.updateActor({
      height: PLAYER_HEIGHT,
      id: "player",
      position: { x: playerPosition.x, y: PLAYER_BASE_Y, z: playerPosition.z },
      radius: PLAYER_RADIUS,
      tags: ["player"]
    });

    runtime.update(delta);

    if (!battleUi.isBattleOpen) {
      updateWilds(delta);
    }

    animateCharacters(clock.elapsedTime, moving);
    updateSunLight();
    updateCamera(delta);

    const nearbyTargetId = findNearbyTarget();
    const nearby = nearbyTargetId ? targets.get(nearbyTargetId) : undefined;

    ui.update({
      bondCount: party.vinculos,
      hasStarter: party.creatures.length > 0,
      nearbyName: nearby?.name,
      nearbyType: nearby?.type,
      partySize: party.creatures.length
    });

    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(update);
  }

  function updateWilds(delta: number) {
    wilds.forEach((wild) => {
      if (!wild.definition.roaming) return;
      if (wild.timer > 100) return;

      wild.timer -= delta;

      const deltaX = wild.target.x - wild.visual.x;
      const deltaZ = wild.target.z - wild.visual.z;
      const distance = Math.hypot(deltaX, deltaZ);

      if (distance < 0.12 || wild.timer <= 0) {
        wild.timer = 2.4 + Math.random() * 2.6;
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.4 + Math.random() * WILD_RADIUS;
        wild.target = {
          x: clamp(wild.definition.home[0] + Math.cos(angle) * radius, -14, 14),
          z: clamp(wild.definition.home[1] + Math.sin(angle) * radius, -15, 15)
        };
      } else {
        wild.visual.x += (deltaX / distance) * WILD_SPEED * delta;
        wild.visual.z += (deltaZ / distance) * WILD_SPEED * delta;
      }

      const written = Math.hypot(
        wild.visual.x - wild.lastWritten.x,
        wild.visual.z - wild.lastWritten.z
      );

      if (written > 0.5) {
        wild.lastWritten = { x: wild.visual.x, z: wild.visual.z };
        runtime.setTargetLocalTransform(wild.definition.entityId, {
          position: { x: wild.visual.x, y: 0.68, z: wild.visual.z },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
      }

      if (
        Math.hypot(
          playerPosition.x - wild.visual.x,
          playerPosition.z - wild.visual.z
        ) < CONTACT_DISTANCE
      ) {
        startBattle(wild);
      }
    });
  }

  function animateCharacters(elapsed: number, moving: boolean) {
    bindings.forEach((binding, entityId) => {
      let offset = 0;

      if (binding.kind === "player") {
        offset = moving
          ? Math.abs(Math.sin(elapsed * 13)) * 0.045
          : Math.sin(elapsed * 2.5) * 0.018;
      } else if (binding.kind === "wild") {
        offset = Math.sin(elapsed * 2.1 + binding.phase) * 0.12;
      }

      const wild = wilds.get(entityId);

      if (wild) {
        binding.sprite.position.set(wild.visual.x, 0.68 + offset, wild.visual.z);
        return;
      }

      binding.sprite.position.set(binding.base.x, binding.base.y + offset, binding.base.z);
    });

    playerMarker.position.set(playerPosition.x, -0.09, playerPosition.z);
  }

  function updateCamera(delta: number) {
    const targetX = playerPosition.x + cameraOffset.x;
    const targetY = PLAYER_BASE_Y + cameraOffset.y;
    const targetZ = playerPosition.z + cameraOffset.z;
    const smoothing = Math.min(1, delta * 3.5);
    camera.position.x += (targetX - camera.position.x) * smoothing;
    camera.position.y += (targetY - camera.position.y) * smoothing;
    camera.position.z += (targetZ - camera.position.z) * smoothing;
    camera.lookAt(playerPosition.x, 0.2, playerPosition.z - 1.2);
  }

  function updateSunLight() {
    if (!sun || !sunAnchor) return;
    sunAnchor.position.set(playerPosition.x, 0, playerPosition.z);
    sun.parent?.position.set(-12, 22, 10);
    sun.position.set(0, 0, 0);
    sun.target.position.set(12, -22, -10);
  }

  const clock = new Clock();
  let animationFrame = 0;

  update();
  window.addEventListener("pagehide", dispose, { once: true });

  function dispose() {
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    input.dispose();
    runtime.dispose();
    instance.dispose();
    renderer.dispose();
  }

  return { dispose };
}

function createActorTargets(): Map<string, ActorTarget> {
  const targets = new Map<string, ActorTarget>();

  targets.set(SOULDOLLS_ENTITY_IDS.keeper, {
    entityId: SOULDOLLS_ENTITY_IDS.keeper,
    name: "Mara",
    type: "keeper"
  });

  for (const wild of WILD_CREATURES) {
    targets.set(wild.entityId, {
      entityId: wild.entityId,
      name: getSpecies(wild.speciesId).name,
      type: "wild"
    });
  }

  return targets;
}

function createCharacters(
  scene: Scene,
  bindings: Map<string, CharacterBinding>,
  wilds: Map<string, WildState>
) {
  const register = (
    entityId: string,
    sprite: Sprite,
    kind: CharacterBinding["kind"],
    phase: number
  ) => {
    sprite.renderOrder = 2;
    scene.add(sprite);
    bindings.set(entityId, {
      base: { x: 0, y: 0.72, z: 0 },
      kind,
      phase,
      sprite
    });
  };

  register(
    SOULDOLLS_ENTITY_IDS.player,
    createCharacterSprite({ accent: "#f4cf86", color: "#688d73", role: "player" }),
    "player",
    0
  );

  const keeperSprite = createCharacterSprite({
    accent: "#dbb278",
    color: "#657d6c",
    role: "keeper"
  });
  keeperSprite.scale.set(1.05, 1.48, 1);
  register(SOULDOLLS_ENTITY_IDS.keeper, keeperSprite, "keeper", 0);

  for (const wild of WILD_CREATURES) {
    const species = getSpecies(wild.speciesId);
    const sprite = createCreatureSprite(species);
    register(wild.entityId, sprite, "wild", wild.home[0]);

    wilds.set(wild.entityId, {
      definition: wild,
      lastWritten: { x: wild.home[0], z: wild.home[1] },
      target: { x: wild.home[0], z: wild.home[1] },
      timer: 0,
      visual: { x: wild.home[0], z: wild.home[1] }
    });
  }
}

function createPlayerMarker(scene: Scene): Mesh<CircleGeometry, MeshStandardMaterial> {
  const playerMarker = new Mesh(
    new CircleGeometry(0.48, 28),
    new MeshStandardMaterial({
      color: "#f2df9b",
      depthWrite: false,
      opacity: 0.46,
      roughness: 1,
      transparent: true
    })
  );
  playerMarker.rotation.x = -Math.PI / 2;
  playerMarker.position.set(0, -0.09, 13.2);
  playerMarker.renderOrder = 1;
  scene.add(playerMarker);
  return playerMarker;
}

function configureSceneShadows(instance: ThreeRuntimeSceneInstance) {
  instance.nodesById.forEach((object, nodeId) => {
    const castShadow = nodeId.includes("tree");
    const receiveShadow = !nodeId.includes("water") && !nodeId.includes("flowers");

    object.traverse((child) => {
      if (!(child as Mesh).isMesh) return;
      const mesh = child as Mesh;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
    });
  });
}

function resolveSun(instance: ThreeRuntimeSceneInstance): DirectionalLight | undefined {
  return instance.lights.find((light) => (light as DirectionalLight).isDirectionalLight) as
    | DirectionalLight
    | undefined;
}

function configureSunShadow(sun: DirectionalLight | undefined) {
  if (!sun) return;

  const shadowCamera = sun.shadow.camera as OrthographicCamera;
  shadowCamera.left = -26;
  shadowCamera.right = 26;
  shadowCamera.top = 26;
  shadowCamera.bottom = -26;
  shadowCamera.near = 1;
  shadowCamera.far = 90;
  shadowCamera.updateProjectionMatrix();

  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
