import { BoxGeometry, BufferGeometry, Euler, Group, Mesh, MeshStandardMaterial, NearestFilter, TextureLoader, Vector3 } from "three";

type Vec3 = [number, number, number];
type FaceName = "east" | "west" | "up" | "down" | "south" | "north";
type Face = { texture: string; uv: [number, number, number, number]; rotation: number };
type Element = { from: Vec3; to: Vec3; rotation?: { origin: Vec3; axis: "x" | "y" | "z"; angle: number; rescale: boolean }; faces: Partial<Record<FaceName, Face>> };
type Display = { rotation: Vec3; translation: Vec3; scale: Vec3 };
export type JavaItemModel = { elements: Element[]; textures: Record<string, string>; display: Partial<Record<"thirdperson_righthand" | "thirdperson_lefthand", Display>> };
export type JavaItemAsset = { model: JavaItemModel; textures: Record<string, string> };
const faces: FaceName[] = ["east", "west", "up", "down", "south", "north"];
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
function vector(value: unknown, fallback: Vec3, limit = 256): Vec3 {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length !== 3 || value.some(n => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > limit)) throw new Error("Invalid or oversized model coordinates.");
  return [...value] as Vec3;
}
function defaultUV(face: FaceName, a: Vec3, b: Vec3): Face["uv"] {
  switch (face) {
    case "down": return [a[0], 16-b[2], b[0], 16-a[2]];
    case "up": return [a[0], a[2], b[0], b[2]];
    case "north": return [16-b[0], 16-b[1], 16-a[0], 16-a[1]];
    case "south": return [a[0], 16-b[1], b[0], 16-a[1]];
    case "west": return [a[2], 16-b[1], b[2], 16-a[1]];
    case "east": return [16-b[2], 16-b[1], 16-a[2], 16-a[1]];
  }
}
export function parseJavaItemModel(raw: unknown): JavaItemModel {
  if (!record(raw) || !Array.isArray(raw.elements) || !raw.elements.length) throw new Error("Choose a Java block/item model with cuboid elements, not a .bbmodel project or an item-definition file. Export the model from Blockbench first.");
  if (raw.parent) throw new Error("This model inherits a parent. Export a self-contained Java model with its parent elements and display settings included.");
  if (raw.elements.length > 2048) throw new Error("Models are limited to 2,048 elements.");
  const textures: Record<string, string> = Object.create(null);
  if (!record(raw.textures) || Object.keys(raw.textures).length > 64) throw new Error("Invalid texture list (maximum 64 entries).");
  for (const [key, value] of Object.entries(raw.textures)) {
    if (typeof value !== "string" || value.length > 256 || !value) throw new Error("Invalid texture reference.");
    textures[key] = value;
  }
  const resolve = (ref: string): string => {
    const seen = new Set<string>();
    while (ref.startsWith("#")) {
      if (seen.has(ref) || !Object.hasOwn(textures, ref.slice(1))) throw new Error(`Missing or circular texture reference: ${ref}`);
      seen.add(ref); ref = textures[ref.slice(1)]!;
    }
    return ref;
  };
  const elements = raw.elements.map((e: unknown): Element => {
    if (!record(e) || !record(e.faces)) throw new Error("Invalid model element.");
    const from = vector(e.from, [0,0,0]), to = vector(e.to, [16,16,16]);
    if (to.some((n,i) => n < from[i]!)) throw new Error("Element bounds must be ordered from minimum to maximum.");
    const result: Element = { from, to, faces: {} };
    if (e.rotation !== undefined) {
      const r = e.rotation;
      if (!record(r) || !["x","y","z"].includes(r.axis) || typeof r.angle !== "number" || !Number.isFinite(r.angle) || Math.abs(r.angle) > 360) throw new Error("Unsupported element rotation. Use Java axis-angle rotations.");
      if (r.rescale && Math.abs(r.angle) > 45) throw new Error("Rescaled element rotations must be within 45 degrees.");
      result.rotation = { origin: vector(r.origin, [8,8,8]), axis: r.axis, angle: r.angle, rescale: r.rescale === true };
    }
    for (const name of faces) {
      const f = e.faces[name];
      if (f === undefined) continue;
      if (!record(f) || typeof f.texture !== "string") throw new Error("Each visible face needs a texture reference.");
      const uv = f.uv ?? defaultUV(name, from, to);
      if (!Array.isArray(uv) || uv.length !== 4 || uv.some(n => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 256)) throw new Error("Invalid face UV coordinates.");
      if (![0,90,180,270].includes(f.rotation ?? 0)) throw new Error("Face UV rotations must be 0, 90, 180, or 270 degrees.");
      result.faces[name] = { texture: resolve(f.texture), uv: [...uv] as Face["uv"], rotation: f.rotation ?? 0 };
    }
    return result;
  });
  const display: JavaItemModel["display"] = {};
  for (const slot of ["thirdperson_righthand", "thirdperson_lefthand"] as const) {
    const d = raw.display?.[slot];
    if (d === undefined) continue;
    if (!record(d)) throw new Error("Invalid hand display settings.");
    display[slot] = { rotation: vector(d.rotation, [0,0,0],360), translation: vector(d.translation,[0,0,0],80), scale: vector(d.scale,[1,1,1],4) };
  }
  if (!elements.some(e => Object.keys(e.faces).length)) throw new Error("The model has no visible faces.");
  const model = { elements, textures, display };
  if (javaTexturePaths(model).length > 64) throw new Error("Models are limited to 64 distinct textures.");
  return model;
}
export function javaTexturePaths(model: JavaItemModel): string[] {
  return [...new Set(model.elements.flatMap(e => Object.values(e.faces).map(f => f.texture)))];
}
export function normalizeJavaItemAsset(raw: unknown): JavaItemAsset {
  if (!record(raw) || !record(raw.textures)) throw new Error("Missing model textures.");
  const model = parseJavaItemModel(raw.model);
  const textures: Record<string,string> = Object.create(null);
  let bytes = 0;
  for (const path of javaTexturePaths(model)) {
    const data = raw.textures[path];
    if (typeof data !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) throw new Error(`Missing embedded PNG texture: ${path}`);
    if (data.length > 8*1024*1024*4/3+32) throw new Error("Each PNG must be smaller than 8 MB.");
    const header = atob(data.slice(data.indexOf(",")+1, data.indexOf(",")+45));
    const bytesAt = (offset: number) => [0,1,2,3].reduce((n,i)=>n*256+header.charCodeAt(offset+i),0);
    if (!header.startsWith("\x89PNG\r\n\x1a\n") || header.slice(12,16) !== "IHDR" ||
      !Number.isFinite(bytesAt(16)) || !Number.isFinite(bytesAt(20)) ||
      bytesAt(16) < 1 || bytesAt(20) < 1 || bytesAt(16) > 2048 || bytesAt(20) > 2048) {
      throw new Error("Textures must be valid PNGs no larger than 2048 × 2048 pixels.");
    }
    bytes += data.length;
    if (bytes > 24 * 1024 * 1024) throw new Error("Model textures exceed the 18 MB limit.");
    textures[path] = data;
  }
  return { model, textures };
}

/** Matches Blockbench's display_base, including Java left-hand mirroring.
 * Source convention: github.com/JannisX11/blockbench/js/display_mode/display_mode.js */
export function javaDisplayGroup(model: JavaItemModel, left: boolean): Group {
  const d = model.display[left ? "thirdperson_lefthand" : "thirdperson_righthand"]
    ?? model.display.thirdperson_righthand ?? { rotation:[0,0,0], translation:[0,0,0], scale:[1,1,1] };
  const sign = left ? -1 : 1;
  const g = new Group();
  g.name = "java-display-transform";
  g.position.set(d.translation[0]! * sign, d.translation[1]!, d.translation[2]!);
  g.rotation.set(d.rotation[0]! * Math.PI/180, d.rotation[1]! * sign * Math.PI/180, d.rotation[2]! * sign * Math.PI/180, "XYZ");
  g.scale.fromArray(d.scale);
  return g;
}
export async function createJavaItemGroup(asset: JavaItemAsset, left: boolean, applyHandDisplay = true): Promise<Group> {
  const group = new Group();
  group.userData.javaItem = true;
  const display = applyHandDisplay ? javaDisplayGroup(asset.model, left) : new Group();
  // Scene models retain authored geometry, without hand-specific transforms.
  // Java's block base is y=0; the shared geometry builder centers at (8,8,8).
  if (!applyHandDisplay) display.position.y = 8;
  group.add(display);
  const materials = new Map<string, MeshStandardMaterial>();
  try {
    for (const path of javaTexturePaths(asset.model)) {
      const texture = await new TextureLoader().loadAsync(asset.textures[path]!);
      if (texture.image.width > 2048 || texture.image.height > 2048) { texture.dispose(); throw new Error("Textures must be at most 2048 × 2048 pixels."); }
      texture.magFilter = texture.minFilter = NearestFilter;
      texture.generateMipmaps = false;
      // The existing viewport pipeline and Stylized shader consume sRGB bytes.
      materials.set(path, new MeshStandardMaterial({ map: texture, alphaTest: 0.01, transparent: true, roughness: 1, metalness: 0 }));
    }
    for (const e of asset.model.elements) {
      const geometry = new BoxGeometry(e.to[0]-e.from[0], e.to[1]-e.from[1], e.to[2]-e.from[2]);
      const uv = geometry.getAttribute("uv");
      const indices: number[] = [];
      const meshMaterials: MeshStandardMaterial[] = [];
      geometry.clearGroups();
      faces.forEach((name, i) => {
        const face = e.faces[name];
        if (!face) return;
        const [u1,v1,u2,v2] = face.uv;
        const corners = [[u1,v1],[u2,v1],[u2,v2],[u1,v2]];
        for (let j=0; j<4; j++) {
          // Java rotates the image clockwise, so sample the preceding UV corner.
          const corner = corners[([0,1,3,2][j]! + 4 - face.rotation/90)%4]!;
          uv.setXY(i*4+j, corner[0]!/16, 1-corner[1]!/16);
        }
        const start = indices.length;
        indices.push(...[0,2,1,2,3,1].map(n=>n+i*4));
        geometry.addGroup(start,6,meshMaterials.length);
        meshMaterials.push(materials.get(face.texture)!);
      });
      geometry.setIndex(indices);
      geometry.translate((e.from[0]+e.to[0])/2-8,(e.from[1]+e.to[1])/2-8,(e.from[2]+e.to[2])/2-8);
      if(e.rotation) {
        const r=e.rotation, origin=new Vector3(...r.origin).subScalar(8);
        geometry.translate(-origin.x,-origin.y,-origin.z);
        if(r.rescale) { const scale=new Vector3().setScalar(1/Math.cos(r.angle*Math.PI/180)); scale[r.axis]=1; geometry.scale(scale.x,scale.y,scale.z); }
        const angles=new Euler(); angles[r.axis]=r.angle*Math.PI/180;
        geometry.applyQuaternion(new Group().quaternion.setFromEuler(angles));
        geometry.translate(origin.x,origin.y,origin.z);
      }
      // Keep authored faces and UVs intact when the avatar itself is sculpted.
      const authored = new BufferGeometry().copy(geometry); geometry.dispose();
      authored.userData.javaItem = true;
      const mesh = new Mesh(authored, meshMaterials); mesh.name="java-item-element";
      display.add(mesh);
    }
    group.userData.disposeTextures = () => materials.forEach(m => m.map?.dispose());
    return group;
  } catch(error) {
    group.traverse(o=>{ if(o instanceof Mesh) o.geometry.dispose(); });
    materials.forEach(m=>{m.map?.dispose(); m.dispose();});
    throw error;
  }
}
