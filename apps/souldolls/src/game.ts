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
  Fog,
  HemisphereLight,
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
  SANCTUARIES,
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
  gainEVs,
  gainXp,
  type Creature
} from "./pokemon/creature";
import {
  addToParty,
  createEmptyParty,
  evReward,
  healPartyFully,
  partyLeader,
  xpReward,
  type Party
} from "./pokemon/roster";
import { getSpecies } from "./pokemon/species";
import { WorldClock, WeatherCycle } from "./world/clock";
import { encounterChancePerSecond, rollEncounter } from "./world/encounters";
import { lightingFor, type Lighting } from "./world/lighting";
import { zoneAt, type Zone } from "./world/zones";

const WALK_SPEED = 4.4;
const PLAYER_RADIUS = 0.4;
const PLAYER_HEIGHT = 1.8;
const PLAYER_BASE_Y = 0.72;
const WORLD_LIMIT_X = 15.5;
const WORLD_LIMIT_Z = 16.5;
const MAX_BONDS = 12;

type CharacterBinding = {
  base: { x: number; y: number; z: number };
  kind: "keeper" | "player" | "wild";
  phase: number;
  sprite: Sprite;
};

type ActiveBattle = {
  activeIndex: number;
  entityId?: string;
  rival: Creature;
  state: BattleState;
};

export async function createSouldollsGame(root: HTMLElement) {
  const saved = loadGame();
  const party: Party = saved
    ? { bag: { items: { ...saved.bag } }, creatures: saved.party, vinculos: saved.vinculos }
    : createEmptyParty();

  const bindings = new Map<string, CharacterBinding>();
  const nearbyTargets = new Set<string>();
  const worldClock = new WorldClock();
  const weather = new WeatherCycle();
  let battle: ActiveBattle | undefined;
  let encounterAccumulator = 0;
  let currentZone: Zone = zoneAt(saved?.position.x ?? 0, saved?.position.z ?? 13.2);
  let lightingKey = "";

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

  createCharacters(scene, bindings);
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

      if (target.type === "santuario") {
        restAtSanctuary(target.name);
        return;
      }

      const wild = wilds.get(targetId);
      if (wild) {
        startBattle({
          creature: createCreature(wild.definition.speciesId, wild.definition.level),
          entityId: targetId
        });
      }
    }
  });

  runtime.start();

  const sun = resolveSun(instance);
  const sunAnchor = instance.nodesById.get("node:souldolls:light:directional");
  const hemisphere = instance.lights.find(
    (light) => (light as HemisphereLight).isHemisphereLight
  ) as HemisphereLight | undefined;
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

  function restAtSanctuary(name: string) {
    healPartyFully(party);

    if (party.vinculos < MAX_BONDS) {
      party.vinculos += 1;
    }

    persistGame();
    ui.showDialogue(
      name,
      "Las piedras tibias descansan a tu colección y una chispa de bruma vuelve a tu morral."
    );
  }

  function startBattle(input: { creature: Creature; entityId?: string }) {
    if (battle) return;

    const leader = partyLeader(party);

    if (!leader) {
      ui.showToast("Necesitas un alma propia para desafiar. Habla con Mara.");
      return;
    }

    const state = iniciarBatalla(
      {
        bondBonus: 0,
        creature: { ...leader },
        flinched: false,
        isPlayer: true,
        moves: [...leader.moves],
        vinculos: party.vinculos
      },
      {
        bondBonus: 0,
        creature: input.creature,
        flinched: false,
        isPlayer: false,
        moves: [...input.creature.moves],
        vinculos: 0
      },
      party.bag
    );

    state.modificadores = weatherModifiers(weather.weather);

    battle = { activeIndex: 0, entityId: input.entityId, rival: input.creature, state };
    battleUi.clearLog();
    battleUi.open();
    battleUi.render(battle.state, party, 0);
    battleUi.appendLog({
      kind: "info",
      text: `¡${creatureName(input.creature)} salvaje aparece en ${currentZone.name}!`
    });
  }

  function submitBattleAction(action: BattleUiAction) {
    if (!battle || battle.state.fase === "fin") return;

    if (action.kind === "cambiar") {
      const next = party.creatures[action.index];
      if (!next || action.index === battle.activeIndex) return;
      party.creatures[battle.activeIndex] = battle.state.player.creature;
      battle.activeIndex = action.index;
      battle.state = {
        ...battle.state,
        player: { ...battle.state.player, creature: { ...next } }
      };
    }

    const engineAction =
      action.kind === "cambiar"
        ? { kind: "cambiar" as const, creature: party.creatures[action.index] }
        : action;

    const resolution = resolverTurno(battle.state, engineAction, Math.random);
    battle.state = resolution.state;
    party.vinculos = battle.state.player.vinculos;
    battleUi.setLocked(true);
    battleUi.render(battle.state, party, battle.activeIndex);
    playEvents(resolution.events, () => {
      if (!battle) return;
      if (battle.state.fase === "fin") {
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

    party.creatures[finished.activeIndex] = finished.state.player.creature;
    party.vinculos = finished.state.player.vinculos;

    if (finished.state.result === "captura") {
      const captured = finished.rival;
      const added = addToParty(party, captured);
      releaseWorldWild(finished.entityId);

      if (added) {
        ui.showToast(`${creatureName(captured)} acepta el vínculo y se une a tu colección`);
      } else {
        ui.showToast("Tu colección está llena: el alma vuelve al claro");
      }
    } else if (finished.state.result === "victoria") {
      const leader = party.creatures[finished.activeIndex];
      const reward = xpReward(leader, finished.rival);
      const result = gainXp(leader, reward);
      let leveled = gainEVs(result.creature, evReward(finished.rival));

      if (result.levelsGained > 0) {
        leveled = evolveCreature(leveled);
        ui.showToast(
          `${creatureName(leveled)} alcanzó el nivel ${leveled.level}${
            leveled.speciesId !== result.creature.speciesId ? " y evolucionó" : ""
          }`
        );
      } else {
        ui.showToast(`${creatureName(leveled)} gana ${reward} de experiencia`);
      }

      party.creatures[finished.activeIndex] = leveled;
      party.vinculos += 2;
      releaseWorldWild(finished.entityId);
      healPartyFully(party);
    } else if (finished.state.result === "derrota") {
      healPartyFully(party);
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

  function releaseWorldWild(entityId: string | undefined) {
    if (!entityId) return;

    bindings.get(entityId)?.sprite.removeFromParent();

    for (const target of runtime.getHookTargets()) {
      if (target.targetId === entityId) {
        target.hook.enabled = false;
      }
    }
  }

  function persistGame() {
    saveGame({
      bag: party.bag.items,
      party: party.creatures,
      position: { x: playerPosition.x, z: playerPosition.z },
      version: 3,
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
      worldClock.advance(delta);
      weather.advance(delta);
      currentZone = zoneAt(playerPosition.x, playerPosition.z);
      updateEncounters(delta);
    }

    applyLighting();
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
      partySize: party.creatures.length,
      timeLabel: worldClock.timeLabel,
      weather: weather.weather,
      zoneName: currentZone.name
    });

    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(update);
  }

  function updateEncounters(delta: number) {
    if (currentZone.safe) {
      encounterAccumulator = 0;
      return;
    }

    encounterAccumulator += delta * encounterChancePerSecond(currentZone, worldClock.phase);

    if (encounterAccumulator < 1) {
      return;
    }

    encounterAccumulator = 0;
    const encounter = rollEncounter(currentZone, worldClock.phase, weather.weather);

    if (!encounter) {
      return;
    }

    startBattle({ creature: createCreature(encounter.speciesId, encounter.level) });
  }

  function applyLighting() {
    const lighting = lightingFor(worldClock.hour, weather.weather);
    const key = `${lighting.sunColor}|${lighting.sunIntensity}|${lighting.background}|${weather.weather}`;

    if (key === lightingKey) {
      return;
    }

    lightingKey = key;

    if (sun) {
      sun.color.set(lighting.sunColor);
      sun.intensity = lighting.sunIntensity;
    }

    if (hemisphere) {
      hemisphere.color.set(lighting.hemiColor);
      hemisphere.groundColor.set(lighting.hemiGround);
      hemisphere.intensity = lighting.hemiIntensity;
    }

    if (scene.background instanceof Color) {
      scene.background.set(lighting.background);
    }

    if (scene.fog instanceof Fog) {
      scene.fog.color.set(lighting.fogColor);
      scene.fog.near = 28 / lighting.fogDensity;
      scene.fog.far = 76 / lighting.fogDensity;
    }
  }

  function animateCharacters(elapsed: number, moving: boolean) {
    bindings.forEach((binding) => {
      let offset = 0;

      if (binding.kind === "player") {
        offset = moving
          ? Math.abs(Math.sin(elapsed * 13)) * 0.045
          : Math.sin(elapsed * 2.5) * 0.018;
      } else if (binding.kind === "wild") {
        offset = Math.sin(elapsed * 2.1 + binding.phase) * 0.12;
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

  for (const sanctuary of SANCTUARIES) {
    targets.set(sanctuary.entityId, {
      entityId: sanctuary.entityId,
      name: sanctuary.name,
      type: "santuario"
    });
  }

  return targets;
}

function createCharacters(scene: Scene, bindings: Map<string, CharacterBinding>) {
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
    register(wild.entityId, createCreatureSprite(species), "wild", wild.home[0]);
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

function weatherModifiers(weather: Weather) {
  return {
    accuracy: (type: string) => (weather === "viento" && type === "brote" ? 0.9 : 1),
    damage: (type: string) => {
      if (weather === "lluvia") {
        return type === "agua" ? 1.5 : type === "bruma" ? 0.8 : 1;
      }

      if (weather === "niebla") {
        return type === "bruma" || type === "sombra" ? 1.3 : 1;
      }

      if (weather === "viento") {
        return type === "brote" ? 1.2 : 1;
      }

      return type === "luz" ? 1.2 : 1;
    }
  };
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
