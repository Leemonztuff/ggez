import type { RuntimeGeometry, RuntimeMaterial, RuntimeNode, RuntimeScene } from "@ggez/runtime-format";
import type { SceneHook, Vec3 } from "@ggez/shared";
import {
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  PlaneGeometry,
  Shape,
  SphereGeometry
} from "three";
import { geometryFromBuffer } from "./geometry";
import { getSpecies } from "../pokemon/species";

export const SOULDOLLS_ENTITY_IDS = {
  keeper: "entity:npc:mara",
  player: "entity:player-spawn"
} as const;

export const INTERACTION_DISTANCE = 2.4;
const PLAYER_RADIUS = 0.4;

export type WildDefinition = {
  entityId: string;
  home: [number, number];
  level: number;
  roaming: boolean;
  speciesId: string;
};

const MATERIALS = {
  bark: { color: "#79644e", id: "material:souldolls:bark", metallicFactor: 0, name: "Bark", roughnessFactor: 1 },
  earth: { color: "#947957", id: "material:souldolls:earth", metallicFactor: 0, name: "Earth", roughnessFactor: 1 },
  flower: {
    color: "#f4e7b6",
    emissiveColor: "#91804b",
    emissiveIntensity: 0.12,
    id: "material:souldolls:flower",
    metallicFactor: 0,
    name: "Flower",
    roughnessFactor: 0.9
  },
  grass: { color: "#91b87c", id: "material:souldolls:grass", metallicFactor: 0, name: "Grass", roughnessFactor: 1 },
  leaves: { color: "#547b64", id: "material:souldolls:leaves", metallicFactor: 0, name: "Leaves", roughnessFactor: 1 },
  leavesTip: { color: "#6f9570", id: "material:souldolls:leaves-tip", metallicFactor: 0, name: "Leaves Tip", roughnessFactor: 1 },
  shrine: { color: "#8e8b7c", id: "material:souldolls:shrine", metallicFactor: 0, name: "Shrine Stone", roughnessFactor: 0.92 },
  trailA: { color: "#ba9872", id: "material:souldolls:trail-a", metallicFactor: 0, name: "Trail A", roughnessFactor: 1 },
  trailB: { color: "#c3a27a", id: "material:souldolls:trail-b", metallicFactor: 0, name: "Trail B", roughnessFactor: 1 },
  water: { color: "#82c4c5", id: "material:souldolls:water", metallicFactor: 0, name: "Water", roughnessFactor: 0.82 }
} satisfies Record<string, RuntimeMaterial>;

const TREE_POSITIONS: Array<[number, number, number]> = [
  [-13, -16, 1.2], [-8, -18, 0.86], [1, -18, 1.15], [9, -16, 1.08],
  [14, -11, 0.92], [-15, -8, 1.12], [14, -4, 1.18], [-15, 1, 0.88],
  [15, 5, 1.04], [-14, 9, 1.2], [12, 12, 0.94], [-10, 15, 1.08],
  [2, 17, 1.15], [8, 17, 0.88], [-17, -3, 0.8], [17, 1, 0.78]
];

const FLOWER_CENTERS: Array<[number, number]> = [
  [-5.5, 8], [4.8, 8.7], [7.2, 1.5], [-5.2, -3.2],
  [4.2, -12], [-8.5, -12], [9.2, 7.4], [-10, 4]
];

const TRAIL_POINTS: Array<[number, number]> = [
  [-1, 15], [0.5, 10], [-0.5, 6], [-1, 2], [0, -2],
  [0.8, -6], [-0.8, -10], [0, -14]
];

const ISLAND_CONTOUR: Array<[number, number]> = [
  [-11, -19], [-4, -21], [5, -20], [12, -16], [17, -9], [18, 0],
  [16, 9], [12, 16], [5, 20], [-4, 21], [-12, 18], [-17, 11],
  [-19, 2], [-17, -7], [-15, -14]
];

export const WILD_CREATURES: WildDefinition[] = [
  {
    entityId: "entity:wild:aural",
    home: [6.7, -5.6],
    level: 6,
    roaming: false,
    speciesId: "aural"
  },
  {
    entityId: "entity:wild:solin",
    home: [-7, 2.8],
    level: 6,
    roaming: false,
    speciesId: "solin"
  }
];

export type SanctuaryDefinition = {
  entityId: string;
  name: string;
  position: [number, number];
};

export const SANCTUARIES: SanctuaryDefinition[] = [
  { entityId: "entity:sanctuary:musgo", name: "Círculo de Musgo", position: [-3.5, 8.5] },
  { entityId: "entity:sanctuary:sombra", name: "Círculo de Sombra", position: [8.5, -11.5] }
];

export function wildEntityId(speciesId: string): string {
  return `entity:wild:${speciesId}`;
}

export function createSouldollsRuntimeScene(): RuntimeScene {
  const nodes: RuntimeNode[] = [];
  const geometry = createGeometryLibrary();

  nodes.push(
    primitiveNode({
      geometry: geometry.water,
      id: "node:souldolls:water",
      materialId: MATERIALS.water.id,
      name: "Water",
      position: { x: 0, y: -0.78, z: 0 }
    })
  );

  nodes.push(
    primitiveNode({
      geometry: geometry.island,
      id: "node:souldolls:island",
      materialId: MATERIALS.earth.id,
      name: "Island",
      position: { x: 0, y: -0.95, z: 0 }
    })
  );

  nodes.push(
    primitiveNode({
      geometry: geometry.meadow,
      id: "node:souldolls:meadow",
      materialId: MATERIALS.grass.id,
      name: "Meadow",
      position: { x: 0, y: -0.116, z: 0 }
    })
  );

  TRAIL_POINTS.slice(0, -1).forEach(([x1, z1], index) => {
    const [x2, z2] = TRAIL_POINTS[index + 1];
    const deltaX = x2 - x1;
    const deltaZ = z2 - z1;
    const length = Math.hypot(deltaX, deltaZ) + 0.55;
    const segment = new CylinderGeometry(1, 1, 0.035, 4);
    segment.scale(1.75, 1, length / 2);
    segment.rotateY(Math.atan2(deltaX, deltaZ));

    nodes.push(
      primitiveNode({
        geometry: geometryFromBuffer(segment, MATERIALS[index % 2 ? "trailA" : "trailB"]),
        id: `node:souldolls:trail:${index}`,
        materialId: MATERIALS[index % 2 ? "trailA" : "trailB"].id,
        name: `Trail ${index}`,
        position: { x: (x1 + x2) / 2, y: -0.07, z: (z1 + z2) / 2 }
      })
    );
  });

  TREE_POSITIONS.forEach(([x, z, scale], index) => {
    const groupId = `node:souldolls:tree:${index}`;

    nodes.push({
      data: {},
      id: groupId,
      kind: "group",
      name: `Tree ${index}`,
      transform: transform({ x, y: -0.12, z }, undefined, { x: scale, y: scale, z: scale })
    });

    nodes.push(
      primitiveNode({
        geometry: geometry.trunk,
        id: `${groupId}:trunk`,
        materialId: MATERIALS.bark.id,
        name: `Tree ${index} Trunk`,
        parentId: groupId,
        position: { x: 0, y: 0.63, z: 0 }
      })
    );

    nodes.push(
      primitiveNode({
        geometry: geometry.leaves,
        id: `${groupId}:leaves`,
        materialId: MATERIALS.leaves.id,
        name: `Tree ${index} Leaves`,
        parentId: groupId,
        position: { x: 0, y: 1.82, z: 0 }
      })
    );

    nodes.push(
      primitiveNode({
        geometry: geometry.leavesTip,
        id: `${groupId}:leaves-tip`,
        materialId: MATERIALS.leavesTip.id,
        name: `Tree ${index} Leaves Tip`,
        parentId: groupId,
        position: { x: 0, y: 2.72, z: 0 }
      })
    );
  });

  FLOWER_CENTERS.forEach(([x, z], patchIndex) => {
    const groupId = `node:souldolls:flowers:${patchIndex}`;

    nodes.push({
      data: {},
      id: groupId,
      kind: "group",
      name: `Flower Patch ${patchIndex}`,
      transform: transform({ x, y: 0, z })
    });

    for (let index = 0; index < 5; index += 1) {
      nodes.push(
        primitiveNode({
          geometry: geometry.flower,
          id: `${groupId}:${index}`,
          materialId: MATERIALS.flower.id,
          name: `Flower ${patchIndex}.${index}`,
          parentId: groupId,
          position: {
            x: Math.cos(index * 1.26) * 0.36,
            y: -0.015,
            z: Math.sin(index * 1.26) * 0.36
          },
          scale: { x: 1, y: 0.6, z: 1 }
        })
      );
    }
  });

  nodes.push({
    data: {
      castShadow: false,
      color: "#eff8ea",
      enabled: true,
      groundColor: "#667765",
      intensity: 2.2,
      type: "hemisphere"
    },
    id: "node:souldolls:light:hemisphere",
    kind: "light",
    name: "Sky Light",
    transform: transform({ x: 0, y: 0, z: 0 })
  });

  nodes.push({
    data: {
      castShadow: true,
      color: "#fff2d4",
      enabled: true,
      intensity: 3.2,
      shadowMapSize: 2048,
      type: "directional"
    },
    id: "node:souldolls:light:directional",
    kind: "light",
    name: "Sun",
    transform: transform({ x: 0, y: 0, z: 0 })
  });

  const entities: RuntimeScene["entities"] = [
    {
      id: SOULDOLLS_ENTITY_IDS.player,
      name: "Mara",
      properties: {},
      transform: transform({ x: 0, y: 0.72, z: 13.2 }),
      type: "player-spawn"
    },
    {
      hooks: [
        interactableHook("hook:keeper:interact", "Hablar con Mara"),
        proximityHook("hook:keeper:proximity"),
        {
          config: {
            actions: [
              { event: "mara.entrega", payload: { species: "brizna" }, type: "emit" },
              { flag: "mara_gift", type: "set_flag", value: true }
            ],
            trigger: { event: "interact.started", fromEntity: SOULDOLLS_ENTITY_IDS.keeper, once: true }
          },
          enabled: true,
          id: "hook:keeper:sequence",
          type: "sequence"
        }
      ],
      id: SOULDOLLS_ENTITY_IDS.keeper,
      name: "Mara, guardabosques",
      properties: {},
      transform: transform({ x: 1.7, y: 0.72, z: -3.4 }),
      type: "npc-spawn"
    }
  ];

  for (const wild of WILD_CREATURES) {
    const species = getSpecies(wild.speciesId).name;

    entities.push({
      hooks: [
        interactableHook(`hook:wild:${wild.speciesId}:interact`, `Desafiar a ${species}`),
        proximityHook(`hook:wild:${wild.speciesId}:proximity`)
      ],
      id: wild.entityId,
      name: species,
      properties: {
        level: wild.level,
        roaming: wild.roaming,
        species: wild.speciesId
      },
      transform: transform({ x: wild.home[0], y: 0.68, z: wild.home[1] }),
      type: "smart-object"
    });
  }

  for (const sanctuary of SANCTUARIES) {
    const groupId = `node:souldolls:sanctuary:${sanctuary.entityId.split(":").pop()}`;

    nodes.push({
      data: {},
      id: groupId,
      kind: "group",
      name: sanctuary.name,
      transform: transform({ x: sanctuary.position[0], y: 0, z: sanctuary.position[1] })
    });

    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2;
      nodes.push(
        primitiveNode({
          geometry: geometry.shrine,
          id: `${groupId}:${index}`,
          materialId: MATERIALS.shrine.id,
          name: `${sanctuary.name} ${index}`,
          parentId: groupId,
          position: {
            x: Math.cos(angle) * 1.15,
            y: 0.28,
            z: Math.sin(angle) * 1.15
          },
          scale: { x: 1, y: 1, z: 1 }
        })
      );
    }

    entities.push({
      hooks: [
        interactableHook(
          `hook:sanctuary:${sanctuary.entityId.split(":").pop()}:interact`,
          `Descansar en ${sanctuary.name}`
        ),
        proximityHook(`hook:sanctuary:${sanctuary.entityId.split(":").pop()}:proximity`)
      ],
      id: sanctuary.entityId,
      name: sanctuary.name,
      properties: { tipo: "santuario" },
      transform: transform({ x: sanctuary.position[0], y: 0.4, z: sanctuary.position[1] }),
      type: "smart-object"
    });
  }

  return {
    assets: [],
    entities,
    layers: [{ id: "layer:world", locked: false, name: "World", visible: true }],
    materials: Object.values(MATERIALS),
    metadata: {
      exportedAt: "2026-04-20T00:00:00.000Z",
      format: "web-hammer-engine",
      version: 7
    },
    nodes,
    settings: {
      player: {
        cameraMode: "top-down",
        canCrouch: false,
        canInteract: true,
        canJump: false,
        canRun: true,
        crouchHeight: 1.2,
        height: 1.8,
        interactKey: "KeyE",
        jumpHeight: 1,
        movementSpeed: 4.4,
        runningSpeed: 6
      },
      world: {
        ambientColor: "#ffffff",
        ambientIntensity: 0,
        fogColor: "#c9dfd1",
        fogFar: 76,
        fogNear: 28,
        gravity: { x: 0, y: -9.81, z: 0 },
        lod: { enabled: false, levels: [] },
        physicsEnabled: false,
        skybox: {
          affectsLighting: false,
          blur: 0,
          enabled: false,
          format: "image",
          intensity: 1,
          lightingIntensity: 1,
          name: "",
          source: ""
        },
        toneMapping: "aces"
      }
    }
  };
}

function interactableHook(id: string, prompt: string): SceneHook {
  return {
    config: { prompt, range: INTERACTION_DISTANCE },
    enabled: true,
    id,
    type: "interactable"
  };
}

function proximityHook(id: string): SceneHook {
  return {
    config: { filters: ["player"], radius: INTERACTION_DISTANCE - PLAYER_RADIUS, shape: "sphere" },
    enabled: true,
    id,
    type: "trigger_volume"
  };
}

function transform(position: Vec3, rotation?: Vec3, scale?: Vec3) {
  return {
    position,
    rotation: rotation ?? { x: 0, y: 0, z: 0 },
    scale: scale ?? { x: 1, y: 1, z: 1 }
  };
}

function primitiveNode(input: {
  geometry: RuntimeGeometry;
  id: string;
  materialId: string;
  name: string;
  parentId?: string;
  position: Vec3;
  scale?: Vec3;
}): RuntimeNode {
  return {
    data: {
      materialId: input.materialId,
      role: "prop",
      shape: "cube",
      size: { x: 1, y: 1, z: 1 }
    },
    geometry: input.geometry,
    id: input.id,
    kind: "primitive",
    name: input.name,
    parentId: input.parentId,
    transform: transform(input.position, undefined, input.scale)
  };
}

function createGeometryLibrary() {
  const water = new PlaneGeometry(240, 240);
  water.rotateX(-Math.PI / 2);

  const meadow = new PlaneGeometry(35, 41);
  meadow.rotateX(-Math.PI / 2);

  const islandShape = new Shape();
  islandShape.moveTo(ISLAND_CONTOUR[0][0], -ISLAND_CONTOUR[0][1]);
  for (const [x, z] of ISLAND_CONTOUR.slice(1)) {
    islandShape.lineTo(x, -z);
  }
  islandShape.closePath();

  const island = new ExtrudeGeometry(islandShape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.24,
    bevelThickness: 0.16,
    depth: 0.72,
    steps: 1
  });
  island.rotateX(-Math.PI / 2);

  return {
    flower: geometryFromBuffer(new SphereGeometry(0.1, 5, 4), MATERIALS.flower),
    island: geometryFromBuffer(island, MATERIALS.earth),
    leaves: geometryFromBuffer(new ConeGeometry(1.22, 1.9, 7), MATERIALS.leaves),
    leavesTip: geometryFromBuffer(new ConeGeometry(0.92, 1.8, 7), MATERIALS.leavesTip),
    meadow: geometryFromBuffer(meadow, MATERIALS.grass),
    shrine: geometryFromBuffer(new CylinderGeometry(0.28, 0.34, 0.56, 6), MATERIALS.shrine),
    trunk: geometryFromBuffer(new CylinderGeometry(0.2, 0.27, 1.5, 6), MATERIALS.bark),
    water: geometryFromBuffer(water, MATERIALS.water)
  };
}
