import {
  Color, DepthTexture, DirectionalLight, Group, MeshStandardMaterial, Vector3, type Box3,
  PCFShadowMap, Vector2, Matrix4, Float32BufferAttribute, type BufferGeometry, type Material, type Texture, type WebGLRenderer, type WebGLRenderTarget,
} from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { SkinViewer } from "skinview3d";
import { StudioHighlight } from "./studioHighlight";
import type { RenderAppearance } from "./renderAppearance";

// Give box surfaces a narrow rounded lighting transition without changing their
// silhouette, UVs, selection geometry, or Classic appearance.
export function prepareStylizedGeometry(geometry: BufferGeometry): void {
  if (geometry.userData.sculptedAvatar) return;
  if (geometry.hasAttribute("studioLocal")) return;
  const position = geometry.getAttribute("position");
  if (!position) return;
  const isBox = geometry.type === "BoxGeometry";
  if (!isBox && (geometry.index || position.count % 36 !== 0)) return;
  const local = new Float32Array(position.count * 3);
  const half = new Float32Array(position.count * 3);
  const stride = isBox ? position.count : 36;
  const boxes: { start: number; min: number[]; max: number[]; center: number[]; size: number[] }[] = [];
  for (let start = 0; start < position.count; start += stride) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = start; i < start + stride; i++) {
      const point = [position.getX(i), position.getY(i), position.getZ(i)];
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis]!, point[axis]!);
        max[axis] = Math.max(max[axis]!, point[axis]!);
      }
    }
    boxes.push({ start, min, max, center: min.map((v, axis) => (v + max[axis]!) / 2), size: min.map((v, axis) => max[axis]! - v) });
  }
  const boxKey = (center: number[], size: number[]) => [...center, ...size].map(v => v.toFixed(3)).join(",");
  const occupied = new Set(boxes.map(box => boxKey(box.center, box.size)));
  for (const { start, min, max, center, size } of boxes) {
    // Adjacent skin texels form a continuous surface, not separate rounded
    // tiles. Suppress internal bevels while retaining exposed contour edges.
    if (!isBox) for (let axis = 0; axis < 3; axis++) {
      if (size[axis]! < 0.9) continue;
      for (const sign of [-1, 1]) {
        const neighbor = [...center];
        neighbor[axis] = neighbor[axis]! + sign * size[axis]!;
        if (occupied.has(boxKey(neighbor, size))) {
          if (sign < 0) min[axis] = min[axis]! - 0.2;
          else max[axis] = max[axis]! + 0.2;
        }
      }
    }
    for (let i = start; i < start + stride; i++) {
      const point = [position.getX(i), position.getY(i), position.getZ(i)];
      for (let axis = 0; axis < 3; axis++) {
        local[i * 3 + axis] = point[axis]! - (min[axis]! + max[axis]!) / 2;
        half[i * 3 + axis] = (max[axis]! - min[axis]!) / 2;
      }
    }
  }
  geometry.setAttribute("studioLocal", new Float32BufferAttribute(local, 3));
  geometry.setAttribute("studioHalf", new Float32BufferAttribute(half, 3));
}

// Keep the original alpha, skin texels and UVs. No global color-management changes:
// skinview3d uses a legacy color pipeline which Classic must continue to reproduce.
export function createStylizedMaterial(source: Material): MeshStandardMaterial {
  const original = source as MeshStandardMaterial;
  const material = new MeshStandardMaterial({
    map: original.map ?? null,
    color: original.color?.clone() ?? new Color(0xffffff),
    vertexColors: original.vertexColors,
    transparent: original.transparent,
    opacity: original.opacity,
    alphaTest: original.alphaTest,
    side: original.side,
    depthWrite: original.depthWrite,
    depthTest: original.depthTest,
    polygonOffset: original.polygonOffset,
    polygonOffsetFactor: original.polygonOffsetFactor,
    polygonOffsetUnits: original.polygonOffsetUnits,
    roughness: 0.8,
    metalness: 0,
  });
  material.name = "MC Poser stylized surface";
  Object.assign(material, { defaultAttributeValues: {
    studioLocal: [0, 0, 0], studioHalf: [0, 0, 0],
  } });
  const capture = { value: false };
  material.userData.studioHighlightCapture = capture;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.studioHighlightCapture = capture;
    const varyings = `varying vec3 vStudioLocal, vStudioHalf;`;
    shader.vertexShader = `attribute vec3 studioLocal, studioHalf;\n${varyings}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vStudioLocal = studioLocal; vStudioHalf = studioHalf;`);
    shader.fragmentShader = `uniform mat3 normalMatrix; uniform bool studioHighlightCapture;\n${varyings}\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      // Skin texels and voxel colors arrive in display space in skinview3d.
      // Decode locally so lighting preserves saturated dark colors.
      diffuseColor.rgb = studioHighlightCapture ? vec3(1.0) : pow(max(diffuseColor.rgb, vec3(0.0)), vec3(2.2));`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      if (min(vStudioHalf.x, min(vStudioHalf.y, vStudioHalf.z)) > 0.0) {
        float bevel = min(0.06, min(vStudioHalf.x, min(vStudioHalf.y, vStudioHalf.z)) * 0.12);
        vec3 rounded = sign(vStudioLocal) * max(abs(vStudioLocal) - vStudioHalf + bevel, 0.0);
        if (length(rounded) > 0.0001) normal = normalize(normalMatrix * rounded) * faceDirection;
      }`);
    // Matte diffuse response, with all rim illumination supplied by scene lights.
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
      outgoingLight -= reflectedLight.directSpecular * 0.65;
      if (studioHighlightCapture) {
        float grazing = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
        outgoingLight = vec3(dot(reflectedLight.directDiffuse, vec3(0.333333)) * grazing);
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "mc-poser-studio-rear-edge-rim-v7";
  return material;
}

class StudioFinishPass extends ShaderPass {
  readonly highlight = new StudioHighlight();
  constructor(private viewer: SkinViewer, private rearLights: DirectionalLight[]) {
    super({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null as Texture | null },
        inverseProjection: { value: new Matrix4() },
        resolution: { value: new Vector2(1, 1) },
        brightness: { value: 1 }, glow: { value: 0.35 }, warmth: { value: 0.65 },
        tHighlight: { value: null },
        hasDepth: { value: false },
      },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse, tDepth, tHighlight;
        uniform mat4 inverseProjection;
        uniform vec2 resolution;
        uniform float brightness, glow, warmth;
        uniform bool hasDepth;
        varying vec2 vUv;
        vec3 viewPosition(vec2 uv) {
          float d = texture2D(tDepth, uv).x;
          vec4 p = inverseProjection * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          return p.xyz / p.w;
        }
        float rearEdgeReach() {
          // Measure reach from the avatar silhouette, not each voxel's edges.
          // Rear illumination and shadows still decide which edges catch light.
          float width = resolution.y * mix(0.002, 0.04, pow(glow, 1.8));
          float nearest = 1.0;
          for (int ray = 0; ray < 8; ray++) {
            float angle = float(ray) * 0.785398;
            vec2 direction = vec2(cos(angle), sin(angle)) * width / resolution;
            if (texture2D(tDiffuse, vUv + direction).a < 0.15) {
              float inner = 0.0, outer = 1.0;
              for (int stepIndex = 0; stepIndex < 5; stepIndex++) {
                float middle = (inner + outer) * 0.5;
                if (texture2D(tDiffuse, vUv + direction * middle).a < 0.15) outer = middle;
                else inner = middle;
              }
              nearest = min(nearest, outer);
            }
          }
          return 1.0 - smoothstep(0.05, 1.0, nearest);
        }
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 rgb = base.a > 0.0001 ? base.rgb / base.a : vec3(0.0);
          // Contact shading from the actual scene depth, so alpha-cut skin holes
          // are respected (unlike a scene-wide opaque normal override).
          if (hasDepth && base.a > 0.9) {
            vec3 p = viewPosition(vUv);
            vec3 n = normalize(cross(dFdx(p), dFdy(p)));
            if (n.z < 0.0) n = -n;
            float occlusion = 0.0;
            float radius = clamp(1.2 / max(-p.z, 1.0), 0.001, 0.05);
            for (int i = 0; i < 12; i++) {
              float angle = float(i) * 2.399963;
              float spread = 0.3 + 0.7 * float(i + 1) / 12.0;
              vec2 uv = vUv + vec2(cos(angle) * resolution.y / resolution.x, sin(angle)) * radius * spread;
              vec3 delta = viewPosition(uv) - p;
              float distanceToSample = length(delta);
              float contribution = max(dot(n, delta / max(distanceToSample, 0.001)) - 0.15, 0.0);
              occlusion += contribution * (1.0 - smoothstep(0.15, 2.0, distanceToSample))
                * step(0.9, texture2D(tDiffuse, uv).a);
            }
            rgb *= 1.0 - min(occlusion / 12.0 * 1.8, 0.3);
          }
          // Lift the legacy linear-looking skin pipeline into a softer studio
          // response locally, without changing Classic's global color handling.
          rgb = pow(max(rgb, vec3(0.0)), vec3(1.0 / 2.2)) * brightness;
          // A restrained highlight rolloff keeps pale skins from clipping white.
          rgb = rgb / (vec3(1.0) + max(rgb - 0.8, 0.0) * 0.3);
          rgb = pow(max(rgb, vec3(0.0)), vec3(1.12));
          float luminance = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
          rgb = max(mix(vec3(luminance), rgb, 1.23), vec3(0.0));
          rgb *= mix(vec3(0.94, 0.93, 1.08), vec3(1.0), smoothstep(0.2, 0.9, luminance));
          float highlight = texture2D(tHighlight, vUv).r * glow * 3.5;
          if (highlight > 0.0001 && base.a > 0.0) highlight *= rearEdgeReach();
          vec3 warmLight = mix(vec3(0.9, 0.93, 1.0), vec3(1.0, 0.52, 0.12), sqrt(warmth));
          rgb += warmLight * (1.0 - exp(-highlight)) * (1.0 - min(rgb, vec3(1.0)) * 0.65);
          // Rim light colors existing surfaces only. Never grow the silhouette
          // or introduce a background halo into a transparent export.
          vec3 premultiplied = rgb * base.a;
          // The canvas/composer uses premultiplied alpha. Returning straight
          // RGB here would create a clipped white fringe in transparent PNGs.
          gl_FragColor = vec4(premultiplied, base.a);
        }`,
    });
    this.material.extensions.derivatives = true;
    this.material.depthTest = false;
    this.material.depthWrite = false;
  }

  override setSize(width: number, height: number): void {
    this.uniforms.resolution!.value.set(width, height);
    this.highlight.setSize(width, height);
  }

  override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    this.highlight.render(this.viewer, this.rearLights, readBuffer.depthTexture);
    this.uniforms.tHighlight!.value = this.highlight.softened.texture;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }

  override dispose() { this.highlight.dispose(); super.dispose(); }
}

export function createStylizedRenderer(viewer: SkinViewer) {
  const rig = new Group();
  rig.name = "MC Poser studio lights";
  const key = new DirectionalLight(0xffe5ce, 0.55);
  key.position.set(-28, 24, 40);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 2.5;
  Object.assign(key.shadow.camera, { left: -36, right: 36, top: 40, bottom: -40, near: 1, far: 140 });
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.00008;
  // Several separated emitters approximate a broad studio softbox. Each casts
  // a small share of the shadow, avoiding one hard black silhouette.
  const softKeys = [[-12, 0], [12, 0], [0, -12], [0, 12]].map(([x, y]) => {
    const light = key.clone();
    light.position.x += x!; light.position.y += y!;
    return light;
  });
  const fill = new DirectionalLight(0xcbd1ff, 0.6);
  fill.position.set(-12, -5, 40);
  const rim = new DirectionalLight(0xffc477, 4.5);
  rim.position.set(40, 18, -10);
  const rimLeft = new DirectionalLight(0xffd28e, 3.5);
  rimLeft.position.set(-40, 24, -14);
  // Keep side illumination in the beauty render. Extracting the highlight must
  // not remove the diffuse fill and leave the avatar's sides underexposed.
  const sideFills = [rim, rimLeft].map((source, index) => {
    const light = new DirectionalLight(0xffe5cc, index === 0 ? 2.2 : 1.6);
    light.position.copy(source.position);
    light.castShadow = false;
    rig.add(light, light.target);
    return light;
  });
  // The rear source is captured separately, never baked into the base shading.
  for (const light of [rim, rimLeft]) {
    light.color.setRGB(1, 1, 1);
    light.intensity = light === rim ? 3.5 : 2.5;
    light.visible = false;
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -36, right: 36, top: 40, bottom: -40, near: 1, far: 140 });
    light.shadow.normalBias = 0.05;
    light.shadow.bias = -0.00015;
    light.shadow.radius = 2.5;
  }
  rig.add(key, key.target, fill, fill.target, rim, rim.target, rimLeft, rimLeft.target);
  softKeys.forEach(light => rig.add(light, light.target));
  viewer.scene.add(rig);
  const finish = new StudioFinishPass(viewer, [rim, rimLeft]);
  viewer.composer.insertPass(finish, 1);
  const supportsDepth = viewer.renderer.capabilities.isWebGL2 || viewer.renderer.extensions.has("WEBGL_depth_texture");
  for (const target of supportsDepth ? [viewer.composer.renderTarget1, viewer.composer.renderTarget2] : []) {
    // Texture.clone shares its Source, which can alias the GPU allocation.
    // A depth-sampling pass needs two genuinely independent allocations.
    target.dispose();
    target.depthTexture = new DepthTexture(target.width, target.height, target.depthTexture?.type);
  }
  const originalShadowEnabled = viewer.renderer.shadowMap.enabled;
  const originalShadowType = viewer.renderer.shadowMap.type;
  let active = false;
  let sceneCenter: Vector3 | null = null;

  return {
    // Simple poses retain their original studio. Multi-avatar scenes expand the
    // shadow cameras and light spacing together, keeping every avatar covered.
    setSceneBounds(bounds: Box3) {
      if (bounds.isEmpty()) return;
      sceneCenter = bounds.getCenter(new Vector3());
      const scale = Math.max(1, bounds.getSize(new Vector3()).length() / 56);
      rig.scale.setScalar(scale);
      for (const light of [key, ...softKeys, rim, rimLeft]) {
        Object.assign(light.shadow.camera, { left: -36 * scale, right: 36 * scale,
          top: 40 * scale, bottom: -40 * scale, near: scale, far: 140 * scale });
        light.shadow.camera.updateProjectionMatrix();
      }
    },
    setAppearance(appearance: RenderAppearance) {
      active = appearance.mode === "stylized";
      rig.visible = active;
      finish.enabled = active;
      viewer.renderer.shadowMap.enabled = active || originalShadowEnabled;
      viewer.renderer.shadowMap.type = active ? PCFShadowMap : originalShadowType;
      key.color.setRGB(1, 1 - appearance.warmth * 0.04, 1 - appearance.warmth * 0.08);
      softKeys.forEach(light => light.color.copy(key.color));
      // Neutral fill preserves brightness without washing whole sides in gold.
      sideFills.forEach(light => light.color.setRGB(1, 0.99, 0.98));
      finish.uniforms.brightness!.value = appearance.brightness;
      finish.uniforms.glow!.value = appearance.glow;
      finish.uniforms.warmth!.value = appearance.warmth;
    },
    beforeRender() {
      if (!active) return;
      rig.position.copy(sceneCenter ?? viewer.controls.target);
      rig.quaternion.copy(viewer.camera.quaternion);
      rig.updateMatrixWorld(true);
      finish.uniforms.inverseProjection!.value.copy(viewer.camera.projectionMatrixInverse);
      finish.uniforms.tDepth!.value = viewer.composer.readBuffer.depthTexture;
      finish.uniforms.hasDepth!.value = Boolean(viewer.composer.readBuffer.depthTexture);
    },
    dispose() {
      viewer.scene.remove(rig);
      viewer.composer.removePass(finish);
      finish.dispose();
      key.shadow.dispose();
      rim.shadow.dispose(); rimLeft.shadow.dispose();
      softKeys.forEach(light => light.shadow.dispose());
      viewer.renderer.shadowMap.enabled = originalShadowEnabled;
      viewer.renderer.shadowMap.type = originalShadowType;
    },
  };
}
