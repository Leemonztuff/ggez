export type ActorTarget = {
  description?: string;
  entityId: string;
  name: string;
  soulId?: string;
  type: "keeper" | "wild";
};

export type HudState = {
  bondCount: number;
  hasStarter: boolean;
  nearbyName?: string;
  nearbyType?: ActorTarget["type"];
  partySize: number;
};
