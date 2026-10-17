import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector3, type Mesh } from "three";

const variants = new WeakMap<BufferGeometry, { source: BufferGeometry; dispose: () => void }>();

/** Actual rounded geometry, confined to the optional avatar type. Original UVs
 * and texel colors survive; adjoining voxels remain flush rather than beaded. */
function sculpt(source: BufferGeometry): BufferGeometry | null {
  const pos = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const color = source.getAttribute("color");
  const box = source.type === "BoxGeometry" && pos.count === 24;
  if (!box && (!color || source.index || pos.count % 36 !== 0)) return null;
  const stride = box ? 24 : 36;
  const visibleFaces = box && source.index ? new Set(Array.from(source.index.array).map(index => Math.floor(index / 4))) : null;
  const cells = [];
  for (let start = 0; start < pos.count; start += stride) {
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = start; i < start + stride; i++) {
      const v = new Vector3().fromBufferAttribute(pos, i);
      min.min(v); max.max(v);
    }
    cells.push({ start, center: min.clone().add(max).multiplyScalar(0.5), size: max.sub(min) });
  }
  const key = (center: Vector3, size: Vector3) => [...center.toArray(), ...size.toArray()].map(v => v.toFixed(3)).join(",");
  const occupied = new Set(cells.map(c => key(c.center, c.size)));
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [];
  const bakedShade = [0.82, 0.82, 1.08, 0.68, 1, 0.9];
  const template = new BoxGeometry(1, 1, 1, 3, 3, 3);
  const tp = template.getAttribute("position"), tn = template.getAttribute("normal"), tu = template.getAttribute("uv");
  const indices = template.index!;
  for (const cell of cells) {
    const { start } = cell;
    const size = cell.size.clone(), center = cell.center.clone();
    // Preserve the original half-pixel shell instead of inflating every texel.
    const radius = box ? 0.055 : 0.025;
    const half = size.clone().multiplyScalar(0.5);
    const coreMin = half.clone().negate().addScalar(radius);
    const coreMax = half.clone().addScalar(-radius);
    const hiddenFaces = new Set<number>();
    if (!box) for (const axis of ["x", "y", "z"] as const) {
      if (cell.size[axis] < 0.75) continue;
      for (const direction of [-1, 1]) {
        const neighbor = cell.center.clone(); neighbor[axis] += direction * cell.size[axis];
        if (occupied.has(key(neighbor, cell.size))) {
          hiddenFaces.add((axis === "x" ? 0 : axis === "y" ? 2 : 4) + (direction < 0 ? 1 : 0));
          if (direction < 0) coreMin[axis] -= radius * 2;
          else coreMax[axis] += radius * 2;
        }
      }
    }
    // Three intervals place vertices directly at the bevel boundaries, rather
    // than spending triangles across large flat faces.
    for (let i = 0; i < indices.count; i++) {
      const index = indices.getX(i), face = Math.floor(index / 16);
      if (hiddenFaces.has(face)) continue;
      // Honor omitted articulated joint caps and their custom texture layout.
      if (visibleFaces && !visibleFaces.has(face)) continue;
      const p = new Vector3().fromBufferAttribute(tp, index);
      for (const axis of ["x", "y", "z"] as const) {
        p[axis] = Math.abs(p[axis]) > 0.49 ? Math.sign(p[axis]) * half[axis] : Math.sign(p[axis]) * (half[axis] - radius);
      }
      const anchor = p.clone().clamp(coreMin, coreMax);
      const n = p.clone().sub(anchor);
      if (n.lengthSq() > 1e-10) n.normalize(); else n.fromBufferAttribute(tn, index);
      p.copy(anchor).addScaledVector(n, radius).add(center);
      positions.push(...p.toArray()); normals.push(...n.toArray());
      if (box && uv) {
        const faceWidth = face < 2 ? size.z : size.x;
        const faceHeight = face === 2 || face === 3 ? size.z : size.y;
        const remap = (value: number, extent: number) => value < 0.01 ? 0 : value > 0.99 ? 1 : value < 0.5 ? radius / extent : 1 - radius / extent;
        const s = remap(tu.getX(index), faceWidth), t = remap(tu.getY(index), faceHeight), offset = face * 4;
        // BoxGeometry orders face vertices top-left, top-right, bottom-left, bottom-right.
        for (const component of [0, 1]) {
          const get = (j: number) => component === 0 ? uv.getX(offset + j) : uv.getY(offset + j);
          uvs.push((get(0) * (1 - s) + get(1) * s) * t + (get(2) * (1 - s) + get(3) * s) * (1 - t));
        }
      } else if (color) {
        const ci = start + face * 6;
        // Remove legacy baked face darkening: the studio lights now do that job.
        const shade = bakedShade[face]!;
        colors.push(Math.min(1, color.getX(ci) / shade), Math.min(1, color.getY(ci) / shade), Math.min(1, color.getZ(ci) / shade), color.itemSize === 4 ? color.getW(ci) : 1);
      }
    }
  }
  template.dispose();
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(positions, 3));
  result.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  if (uvs.length) result.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  if (colors.length) result.setAttribute("color", new Float32BufferAttribute(colors, 4));
  result.userData.sculptedAvatar = true;
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

export function syncStylizedAvatarGeometry(mesh: Mesh, enabled: boolean): void {
  const current = variants.get(mesh.geometry);
  if (enabled && current) return;
  if (!enabled) {
    if (current) {
      const rounded = mesh.geometry;
      rounded.removeEventListener("dispose", current.dispose);
      mesh.geometry = current.source;
      variants.delete(rounded);
      rounded.dispose();
    }
    return;
  }
  const source = mesh.geometry;
  const rounded = sculpt(source);
  if (!rounded) return;
  const parent = mesh.parent;
  const root = parent?.name.endsWith("Leg-advanced-rig") ? parent
    : parent?.parent?.name.endsWith("Leg-advanced-rig") ? parent.parent : null;
  if (root) {
    // A continuous hip-to-boot taper, with identical widths at both knee caps.
    // Anchor the inner shell edge so flaring does not merge the feet at rest.
    const outward = root.name.startsWith("left") ? 1 : -1;
    const offsetY = mesh.position.y + (parent === root ? 0 : parent!.position.y);
    const positions = rounded.getAttribute("position");
    const normals = rounded.getAttribute("normal");
    const normal = new Vector3();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const height = y + offsetY;
      const factor = 0.86 + 0.28 * Math.max(0, Math.min(1, -height / 12));
      const derivative = height < 0 && height > -12 ? -0.28 / 12 : 0;
      normal.set(normals.getX(i) / factor,
        normals.getY(i) - derivative * ((x + outward * 2.5) * normals.getX(i) + z * normals.getZ(i)) / factor,
        normals.getZ(i) / factor).normalize();
      positions.setXYZ(i, x * factor + outward * 2.5 * (factor - 0.86), y, z * factor);
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    rounded.computeBoundingBox(); rounded.computeBoundingSphere();
  }
  const dispose = () => source.dispose();
  rounded.addEventListener("dispose", dispose);
  variants.set(rounded, { source, dispose });
  mesh.geometry = rounded;
}
