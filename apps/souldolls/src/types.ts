import type { Weather } from "./world/zones";

export type ActorTarget = {
  description?: string;
  entityId: string;
  name: string;
  soulId?: string;
  type: "keeper" | "santuario" | "wild";
};

export type HudState = {
  bondCount: number;
  hasStarter: boolean;
  nearbyName?: string;
  nearbyType?: ActorTarget["type"];
  partySize: number;
  timeLabel: string;
  weather: Weather;
  zoneName: string;
};
