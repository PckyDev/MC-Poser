import { Color, Vector2, WebGLRenderTarget, type Light, type Material, type Mesh, type Object3D, type Texture } from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { SkinViewer } from "skinview3d";

/** Render rear illumination separately, then soften only that contribution. */
export class StudioHighlight {
  readonly source = new WebGLRenderTarget(1, 1);
  readonly horizontal = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  readonly softened = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  readonly blur = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: null },
      direction: { value: new Vector2() }, hasDepth: { value: false } },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse,tDepth; uniform vec2 direction;
      uniform bool hasDepth; varying vec2 vUv;
      void main(){
        float centerDepth=texture2D(tDepth,vUv).r;
        float sum=0.0, weight=0.0;
        for(int i=-6;i<=6;i++){
          float x=float(i);
          vec2 uv=vUv+direction*x;
          vec4 sampleLight=texture2D(tDiffuse,uv);
          float w=exp(-x*x/8.0);
          // Do not spread highlights between a foreground hand and the torso.
          if(hasDepth) w*=exp(-abs(texture2D(tDepth,uv).r-centerDepth)*1800.0);
          sum+=sampleLight.r*w;
          weight+=w;
        }
        gl_FragColor=vec4(vec3(sum/max(weight,0.0001)),1.0);
      }`,
  });
  private width = 1;
  private height = 1;

  setSize(width: number, height: number) {
    this.width = width; this.height = height;
    for (const target of [this.source, this.horizontal, this.softened]) target.setSize(width, height);
  }

  render(viewer: SkinViewer, rearLights: Light[], depth: Texture | null) {
    const renderer = viewer.renderer;
    const previousTarget = renderer.getRenderTarget();
    const background = viewer.scene.background;
    const clearColor = renderer.getClearColor(new Color());
    const clearAlpha = renderer.getClearAlpha();
    const visibility = new Map<Object3D, boolean>();
    const uniforms = new Set<{ value: boolean }>();
    viewer.scene.traverse(object => {
      if ((object as Light).isLight) {
        visibility.set(object, object.visible);
        object.visible = rearLights.includes(object as Light);
      }
      if ((object as Mesh).isMesh) {
        const mesh = object as Mesh;
        const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const masks = materials.map(material => material.userData.studioHighlightCapture);
        if (masks.every(Boolean)) masks.forEach(uniform => uniforms.add(uniform));
        else { visibility.set(object, object.visible); object.visible = false; }
      }
    });
    try {
      uniforms.forEach(uniform => { uniform.value = true; });
      viewer.scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(this.source);
      renderer.clear();
      renderer.render(viewer.scene, viewer.camera);
      this.blur.uniforms.tDepth!.value = depth;
      this.blur.uniforms.hasDepth!.value = Boolean(depth);
      // Scale the soft transition with output size, not a fixed pixel outline.
      const spread = this.height * 0.0025;
      this.blur.uniforms.direction!.value.set(spread / this.width, 0);
      this.blur.render(renderer, this.horizontal, this.source, 0, false);
      this.blur.uniforms.direction!.value.set(0, spread / this.height);
      this.blur.render(renderer, this.softened, this.horizontal, 0, false);
    } finally {
      uniforms.forEach(uniform => { uniform.value = false; });
      visibility.forEach((visible, object) => { object.visible = visible; });
      viewer.scene.background = background;
      renderer.setClearColor(clearColor, clearAlpha);
      renderer.setRenderTarget(previousTarget);
    }
  }

  dispose() {
    this.source.dispose(); this.horizontal.dispose(); this.softened.dispose(); this.blur.dispose();
  }
}
