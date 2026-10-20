import {
  CanvasTexture,
  NearestFilter,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial
} from "three";

export type CharacterLook = {
  accent: string;
  color: string;
  role: "keeper" | "player" | "soul";
};

export function createCharacterSprite(look: CharacterLook): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 128;

  renderPortrait(canvas, look);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;

  const sprite = new Sprite(
    new SpriteMaterial({
      alphaTest: 0.08,
      depthWrite: false,
      map: texture,
      transparent: true
    })
  );
  sprite.scale.set(0.95, 1.35, 1);
  sprite.renderOrder = 2;
  return sprite;
}

export function createCreatureSprite(species: { accent: string; color: string }): Sprite {
  const sprite = createCharacterSprite({
    accent: species.accent,
    color: species.color,
    role: "soul"
  });
  sprite.scale.set(0.9, 1.15, 1);
  return sprite;
}

export function renderPortrait(canvas: HTMLCanvasElement, look: CharacterLook) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo crear el dibujo del personaje.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  drawCharacter(context, look);
}

function drawCharacter(context: CanvasRenderingContext2D, look: CharacterLook) {
  const pixel = (x: number, y: number, width: number, height: number, color: string) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };

  const outline = "#243c38";

  if (look.role === "soul") {
    pixel(28, 22, 40, 55, outline);
    pixel(34, 14, 28, 12, outline);
    pixel(22, 35, 9, 20, outline);
    pixel(65, 35, 9, 20, outline);
    pixel(33, 23, 30, 47, look.color);
    pixel(27, 38, 12, 10, look.color);
    pixel(57, 38, 12, 10, look.color);
    pixel(39, 13, 18, 12, look.accent);
    pixel(29, 56, 10, 17, look.accent);
    pixel(57, 56, 10, 17, look.accent);
    pixel(37, 44, 5, 7, outline);
    pixel(55, 44, 5, 7, outline);
    pixel(44, 55, 9, 4, "#fff5dc");
    pixel(38, 75, 20, 12, look.color);
    pixel(28, 84, 40, 8, `${look.color}cc`);
    pixel(19, 91, 58, 4, `${look.accent}88`);
    return;
  }

  const isKeeper = look.role === "keeper";
  const skin = isKeeper ? "#d39a71" : "#e5aa82";
  const hair = isKeeper ? "#42544a" : "#59493f";
  const coat = look.color;
  const scarf = look.accent;

  pixel(25, 25, 46, 28, outline);
  pixel(31, 18, 34, 35, skin);
  pixel(29, 18, 38, 13, hair);
  pixel(27, 28, 7, 22, hair);
  pixel(62, 27, 7, 18, hair);
  pixel(35, 37, 5, 5, outline);
  pixel(53, 37, 5, 5, outline);
  pixel(41, 49, 14, 3, outline);
  pixel(24, 56, 48, 42, outline);
  pixel(30, 56, 36, 38, coat);
  pixel(29, 69, 38, 8, scarf);
  pixel(34, 96, 12, 17, outline);
  pixel(51, 96, 12, 17, outline);
  pixel(30, 110, 20, 7, "#493f38");
  pixel(48, 110, 20, 7, "#493f38");

  if (isKeeper) {
    pixel(24, 15, 48, 8, outline);
    pixel(30, 7, 36, 12, scarf);
    pixel(37, 11, 20, 5, "#fff1cb");
  } else {
    pixel(30, 23, 36, 5, look.accent);
    pixel(36, 6, 24, 6, look.accent);
  }
}
