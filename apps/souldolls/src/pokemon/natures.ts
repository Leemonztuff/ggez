import type { StatKey } from "./stats";

export type Nature = {
  id: string;
  menos: StatKey;
  mas: StatKey;
  name: string;
};

export const NATURES: Nature[] = [
  { id: "sereno", menos: "atk", mas: "def", name: "Sereno" },
  { id: "audaz", menos: "def", mas: "atk", name: "Audaz" },
  { id: "veloz", menos: "spd", mas: "atk", name: "Veloz" },
  { id: "tranquilo", menos: "atk", mas: "spd", name: "Tranquilo" },
  { id: "duro", menos: "spd", mas: "def", name: "Duro" },
  { id: "arrogante", menos: "def", mas: "spd", name: "Arrogante" },
  { id: "cristalino", menos: "hp", mas: "atk", name: "Cristalino" },
  { id: "firme", menos: "atk", mas: "hp", name: "Firme" },
  { id: "poco común", menos: "hp", mas: "def", name: "Poco común" },
  { id: "relajado", menos: "def", mas: "hp", name: "Relajado" },
  { id: "nervioso", menos: "spd", mas: "hp", name: "Nervioso" },
  { id: "preocupado", menos: "hp", mas: "spd", name: "Preocupado" },
  { id: "modesto", menos: "atk", mas: "spd", name: "Modesto" },
  { id: "capaz", menos: "spd", mas: "atk", name: "Capaz" },
  { id: "apacible", menos: "def", mas: "spd", name: "Apacible" },
  { id: "juguetón", menos: "hp", mas: "def", name: "Juguetón" },
  { id: "osado", menos: "hp", mas: "atk", name: "Osado" },
  { id: "encajado", menos: "def", mas: "hp", name: "Encajado" },
  { id: "cínimo", menos: "spd", mas: "def", name: "Cínimo" },
  { id: "dócil", menos: "hp", mas: "spd", name: "Dócil" },
  { id: "sosegado", menos: "atk", mas: "def", name: "Sosegado" },
  { id: "razonable", menos: "spd", mas: "atk", name: "Razonable" },
  { id: "elegante", menos: "def", mas: "spd", name: "Elegante" },
  { id: "acertijo", menos: "atk", mas: "spd", name: "Acertijo" }
];

export const NEUTRAL_NATURE_ID = "sereno";

export function getNature(natureId: string): Nature {
  return (
    NATURES.find((nature) => nature.id === natureId) ??
    NATURES.find((nature) => nature.id === NEUTRAL_NATURE_ID) ??
    NATURES[0]
  );
}

export function natureMultiplier(natureId: string, stat: StatKey): number {
  const nature = getNature(natureId);

  if (nature.mas === stat) return 1.1;
  if (nature.menos === stat) return 0.9;
  return 1;
}
