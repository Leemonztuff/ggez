import type { Weather } from "./zones";

export type Lighting = {
  ambientIntensity: number;
  background: string;
  fogColor: string;
  fogDensity: number;
  hemiColor: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
};

const NOCHE: Lighting = {
  ambientIntensity: 0.35,
  background: "#1b2436",
  fogColor: "#2c3a4a",
  fogDensity: 1.25,
  hemiColor: "#6f86b8",
  hemiGround: "#2a2f3c",
  hemiIntensity: 0.7,
  sunColor: "#9fb6e8",
  sunIntensity: 0.8
};

const AMANECER: Lighting = {
  ambientIntensity: 0.5,
  background: "#f0c9a4",
  fogColor: "#e0b391",
  fogDensity: 1.1,
  hemiColor: "#ffd9b0",
  hemiGround: "#6b6552",
  hemiIntensity: 1.5,
  sunColor: "#ffb877",
  sunIntensity: 2.1
};

const DIA: Lighting = {
  ambientIntensity: 0.55,
  background: "#c7dce0",
  fogColor: "#c9dfd1",
  fogDensity: 1,
  hemiColor: "#eff8ea",
  hemiGround: "#667765",
  hemiIntensity: 2.2,
  sunColor: "#fff2d4",
  sunIntensity: 3.2
};

const ATARDECER: Lighting = {
  ambientIntensity: 0.5,
  background: "#e6b98d",
  fogColor: "#d8a982",
  fogDensity: 1.15,
  hemiColor: "#ffd0a1",
  hemiGround: "#5f5a4c",
  hemiIntensity: 1.6,
  sunColor: "#ff9f5c",
  sunIntensity: 2.4
};

export function lightingFor(hour: number, weather: Weather): Lighting {
  let base: Lighting = DIA;

  if (hour >= 21 || hour < 5) {
    base = NOCHE;
  } else if (hour < 8) {
    base = AMANECER;
  } else if (hour < 18) {
    base = DIA;
  } else {
    base = ATARDECER;
  }

  if (weather === "lluvia") {
    return {
      ...base,
      ambientIntensity: base.ambientIntensity * 0.75,
      background: "#8fa3ab",
      fogColor: "#94a8a6",
      fogDensity: base.fogDensity * 1.35,
      sunColor: "#c8d2d6",
      sunIntensity: base.sunIntensity * 0.6
    };
  }

  if (weather === "niebla") {
    return {
      ...base,
      background: "#b9c3bd",
      fogColor: "#c2ccc4",
      fogDensity: base.fogDensity * 1.6,
      sunIntensity: base.sunIntensity * 0.75
    };
  }

  if (weather === "viento") {
    return {
      ...base,
      fogDensity: base.fogDensity * 0.85,
      sunIntensity: base.sunIntensity * 1.1
    };
  }

  return base;
}
