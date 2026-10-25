import { useEffect, useRef, useState } from "react";
import { javaTexturePaths, normalizeJavaItemAsset, parseJavaItemModel, type JavaItemModel } from "../../lib/javaItemModel";
import { createDefaultHeldItemAdjustments } from "../../utils/heldItems";
import type { HeldItem } from "../../types/editor";
import "./JavaItemImport.css";

export function JavaItemImport({ onImport, sceneModel = false }: { onImport: (item: HeldItem) => void; sceneModel?: boolean }) {
  const [model, setModel] = useState<JavaItemModel | null>(null);
  const [label, setLabel] = useState("");
  const [textures, setTextures] = useState<Record<string,string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function loadModel(file?: File) {
    if (!file) return;
    const request = ++generation.current;
    setBusy(true); setError(""); setModel(null); setTextures({});
    try {
      if (file.size > 4*1024*1024) throw new Error("Model JSON must be smaller than 4 MB.");
      const next = parseJavaItemModel(JSON.parse(await file.text()));
      if (request !== generation.current) return;
      setModel(next); setLabel(file.name.replace(/\.json$/i,""));
    } catch(e) { if (request === generation.current) setError(e instanceof Error ? e.message : "Unable to read model."); }
    finally { if (request === generation.current) setBusy(false); }
  }
  async function loadTexture(path: string, file?: File) {
    if (!file) return;
    const request = generation.current;
    setBusy(true); setError("");
    try {
      if (!file.name.toLowerCase().endsWith(".png") || file.size > 8*1024*1024) throw new Error("Choose a PNG texture smaller than 8 MB.");
      const bitmap = await createImageBitmap(file);
      const oversized = bitmap.width > 2048 || bitmap.height > 2048;
      bitmap.close();
      if (oversized) throw new Error("Textures must be at most 2048 × 2048 pixels.");
      const source = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error("Unable to read texture."));
        reader.readAsDataURL(new Blob([file], { type: "image/png" }));
      });
      if (request === generation.current) setTextures(current=>({...current,[path]:source}));
    } catch(e) { if(request === generation.current) setError(e instanceof Error ? e.message : "Unable to read texture."); }
    finally { if(request === generation.current) setBusy(false); }
  }
  function confirm() {
    try {
      const javaModel = normalizeJavaItemAsset({model,textures});
      onImport({ sourceKind:"java", javaModel, source:Object.values(javaModel.textures)[0]!, label,
        detail:`${javaModel.model.elements.length} model elements`, presetId:null, adjustments:createDefaultHeldItemAdjustments() });
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to import model."); }
  }
  const paths = model ? javaTexturePaths(model) : [];
  return <div className="java-item-import">
    <p>Import a self-contained Java block/item model exported from Blockbench, then choose its PNG textures. {sceneModel ? "The model keeps its authored shape and size. Hand display settings are not applied to scene objects." : "Third-person hand settings are applied automatically."}</p>
    <label className="file-field">Java model JSON<input type="file" accept=".json,application/json" disabled={busy}
      onChange={event=>{void loadModel(event.target.files?.[0]); event.target.value="";}} /></label>
    {model ? <><strong>{label}</strong><span>{model.elements.length} elements · {paths.length} textures</span>
      {paths.map(path=><label className="file-field" key={path}>
        <span>Texture: {path}</span><input type="file" accept=".png,image/png" disabled={busy}
          onChange={event=>{void loadTexture(path,event.target.files?.[0]); event.target.value="";}} />
        {textures[path] ? <img src={textures[path]} alt={`${path} texture preview`} /> : <span>PNG required</span>}
      </label>)}
      {!sceneModel && !model.display.thirdperson_righthand && !model.display.thirdperson_lefthand ? <p>No third-person display settings were found. The default hand transform will be used; you can adjust it afterward.</p> : null}
    </> : null}
    {error ? <p role="alert" className="error">{error}</p> : null}
    <button type="button" className="toolbar-button toolbar-button--accent" disabled={busy || !model || paths.some(path=>!textures[path])} onClick={confirm}>
      {busy ? "Reading files..." : "Use 3D model"}
    </button>
    <p className="note">Supports cuboids, face UVs, element rotations, and multiple textures. Parent-dependent models, .bbmodel projects, and resource-pack item-definition files must be exported as a self-contained Java model first. Files stay in your browser until you save or share a pose.</p>
  </div>;
}
