import type { RuntimeGeometry, RuntimeMaterial } from "@ggez/runtime-format";
import type { BufferGeometry } from "three";

export function geometryFromBuffer(
  geometry: BufferGeometry,
  material: RuntimeMaterial
): RuntimeGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();

  geometry.dispose();

  return {
    primitives: [
      {
        indices: index
          ? Array.from(index.array as ArrayLike<number>)
          : Array.from({ length: position.count }, (_, vertexIndex) => vertexIndex),
        material,
        normals: Array.from(normal.array as ArrayLike<number>),
        positions: Array.from(position.array as ArrayLike<number>),
        uvs: uv ? Array.from(uv.array as ArrayLike<number>) : []
      }
    ]
  };
}
