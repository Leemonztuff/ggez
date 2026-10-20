export const DAY_PHASES = ["amanecer", "atardecer", "dia", "noche"] as const;

export type DayPhase = (typeof DAY_PHASES)[number];

export type Weather = "lluvia" | "niebla" | "soleado" | "viento";

export const WEATHERS: Weather[] = ["soleado", "lluvia", "niebla", "viento"];

export type Biome = "bruma" | "claro" | "musgo" | "rocío" | "sombra";

export type EncounterEntry = {
  maxLevel: number;
  minLevel: number;
  phases: DayPhase[];
  speciesId: string;
  weight: number;
};

export type Zone = {
  biome: Biome;
  center: [number, number];
  description: string;
  encounters: EncounterEntry[];
  id: string;
  name: string;
  radius: number;
  safe: boolean;
};

export const ZONES: Zone[] = [
  {
    biome: "claro",
    center: [0, -1],
    description: "El corazón del claro, donde Mara enciende el fuego cada atardecer.",
    encounters: [],
    id: "claro-bruma",
    name: "Claro de Bruma",
    radius: 8.5,
    safe: true
  },
  {
    biome: "musgo",
    center: [-11, 2],
    description: "Musgo blando y raíces que se mueven cuando no las miras.",
    encounters: [
      { maxLevel: 8, minLevel: 3, phases: ["dia", "amanecer"], speciesId: "brizna", weight: 4 },
      { maxLevel: 14, minLevel: 8, phases: ["dia", "atardecer"], speciesId: "musgo_ancestral", weight: 2 },
      { maxLevel: 9, minLevel: 4, phases: ["dia", "noche"], speciesId: "niebla_ronda", weight: 3 },
      { maxLevel: 7, minLevel: 3, phases: ["amanecer", "dia"], speciesId: "aural", weight: 2 }
    ],
    id: "pradera-musgo",
    name: "Pradera de Musgo",
    radius: 7.5,
    safe: false
  },
  {
    biome: "rocío",
    center: [10, 2],
    description: "El agua quieta refleja un cielo que no existe arriba.",
    encounters: [
      { maxLevel: 8, minLevel: 3, phases: ["dia", "atardecer"], speciesId: "aural", weight: 4 },
      { maxLevel: 15, minLevel: 9, phases: ["noche", "dia"], speciesId: "lluvia_viva", weight: 2 },
      { maxLevel: 10, minLevel: 5, phases: ["noche", "amanecer"], speciesId: "niebla_ronda", weight: 3 },
      { maxLevel: 12, minLevel: 6, phases: ["dia"], speciesId: "solin", weight: 2 }
    ],
    id: "laguna-rocio",
    name: "Laguna de Rocío",
    radius: 7,
    safe: false
  },
  {
    biome: "sombra",
    center: [-3, -13],
    description: "Un barranco donde la luz llega tarde y las sombras Respuestas.",
    encounters: [
      { maxLevel: 11, minLevel: 5, phases: ["noche", "atardecer"], speciesId: "sombra_lamp", weight: 4 },
      { maxLevel: 10, minLevel: 4, phases: ["dia", "noche"], speciesId: "roca_viva", weight: 3 },
      { maxLevel: 13, minLevel: 7, phases: ["noche"], speciesId: "aural", weight: 2 },
      { maxLevel: 16, minLevel: 10, phases: ["noche", "dia"], speciesId: "faro", weight: 1 }
    ],
    id: "barranco-sombra",
    name: "Barranco de Sombra",
    radius: 8,
    safe: false
  },
  {
    biome: "bruma",
    center: [4, 14],
    description: "El sendero alto, donde las luciérnagas marcan el camino de vuelta.",
    encounters: [
      { maxLevel: 9, minLevel: 3, phases: ["atardecer", "noche"], speciesId: "solin", weight: 4 },
      { maxLevel: 16, minLevel: 10, phases: ["noche"], speciesId: "faro", weight: 2 },
      { maxLevel: 8, minLevel: 3, phases: ["amanecer", "dia"], speciesId: "brizna", weight: 3 },
      { maxLevel: 9, minLevel: 4, phases: ["noche", "dia"], speciesId: "niebla_ronda", weight: 2 }
    ],
    id: "sendero-alto",
    name: "Sendero Alto",
    radius: 7.5,
    safe: false
  }
];

export const DEFAULT_ZONE = ZONES[0];

export function zoneAt(x: number, z: number): Zone {
  let best = DEFAULT_ZONE;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const zone of ZONES) {
    const distance = Math.hypot(x - zone.center[0], z - zone.center[1]);

    if (distance <= zone.radius) {
      return zone;
    }

    if (distance < bestDistance) {
      best = zone;
      bestDistance = distance;
    }
  }

  return best;
}

export function phaseForHour(hour: number): DayPhase {
  if (hour >= 5 && hour < 8) return "amanecer";
  if (hour >= 8 && hour < 18) return "dia";
  if (hour >= 18 && hour < 21) return "atardecer";
  return "noche";
}

export function weatherLabel(weather: Weather): string {
  if (weather === "lluvia") return "Lluvia fina";
  if (weather === "niebla") return "Bruma densa";
  if (weather === "viento") return "Viento entre hojas";
  return "Cielo despejado";
}
