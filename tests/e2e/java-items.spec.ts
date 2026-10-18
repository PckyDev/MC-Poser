import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

const model = {
  textures: { "0": "test/wood", alias: "#0", "1": "test/metal" },
  elements: [
    { from:[6,0,6], to:[10,16,10], faces: Object.fromEntries(["east","west","up","down","south","north"].map(face=>[face,{texture:"#alias",uv:[0,0,16,16]}])) },
    { from:[2,16,5], to:[14,22,11], rotation:{axis:"z",angle:22.5,origin:[8,16,8],rescale:true}, faces:{north:{texture:"#1",uv:[0,0,8,8],rotation:90},south:{texture:"#1",uv:[8,8,0,0]}} },
  ],
  display: { thirdperson_righthand:{rotation:[15,80,3],translation:[1,-.25,1.75],scale:[.65,.7,.6]},
    thirdperson_lefthand:{rotation:[20,70,5],translation:[2,1,2],scale:[.5,.6,.7]} },
};
async function setup(page:Page) {
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,"showSaveFilePicker",{value:undefined}));
  await page.route("**/src/App.tsx*",async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace("viewerRef.current = viewer;","viewerRef.current = viewer; window.__javaViewer = viewer;")});
  });
  await page.goto("/");
  const png=await page.evaluate(()=>{
    const c=document.createElement("canvas");c.width=c.height=64;
    const ctx=c.getContext("2d")!;ctx.fillStyle="#ba8b55";ctx.fillRect(0,0,64,64);
    ctx.fillStyle="#377dce";ctx.fillRect(0,0,32,32);return c.toDataURL();
  });
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({name:"test.mcpose",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({version:2, skin:{origin:"upload",source:png,label:"Test",modelPreference:"default"}}))});
  await expect.poll(()=>page.evaluate(()=>(window as any).__javaViewer?.playerObject.skin.visible)).toBe(true);
  return {png,errors};
}
async function openImport(page:Page,arm="Right Arm") {
  await page.getByRole("button",{name:arm,exact:true}).click();
  await page.getByRole("button",{name:/^(Add|Change) Item$/}).click();
  await page.getByRole("tab",{name:"Java 3D Model"}).click();
}
async function importModel(page:Page,png:string,arm="Right Arm") {
  await openImport(page,arm);
  await page.getByLabel("Java model JSON").setInputFiles({name:"test-model.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(model))});
  for(const path of ["test/wood","test/metal"]) await page.getByLabel(`Texture: ${path}`).setInputFiles({name:"test.png",mimeType:"image/png",buffer:Buffer.from(png.split(",")[1]!,"base64")});
  await page.getByRole("button",{name:"Use 3D model",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Choose a held item"})).not.toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    let count=0;(window as any).__javaViewer.playerObject.traverse((o:any)=>{if(o.userData.javaItem) count++;});return count;
  })).toBeGreaterThan(0);
}

test("Java model parser validates input, face mapping and independent hand transforms",async({page})=>{
  const {png}=await setup(page);
  const result=await page.evaluate(async({model,png})=>{
    // @ts-expect-error Browser loads the source module through Vite.
    const lib=await import("/src/lib/javaItemModel.ts");
    const parsed=lib.parseJavaItemModel(model);
    const right=lib.javaDisplayGroup(parsed,false),left=lib.javaDisplayGroup(parsed,true);
    const group=await lib.createJavaItemGroup({model:parsed,textures:{"test/wood":png,"test/metal":png}},false);
    const mesh=group.children[0].children[0];
    const failures=[];
    for(const input of [{}, {...model,parent:"custom:missing"}, {...model,textures:{"0":"#alias",alias:"#0","1":"test/metal"}}, {...model,elements:[{from:[NaN,0,0],to:[1,1,1],faces:{}}]}]) {
      try {lib.parseJavaItemModel(input);failures.push(false);}catch{failures.push(true);}
    }
    const data={r:right.position.toArray(),l:left.position.toArray(),lr:left.rotation.toArray().slice(0,3),scale:left.scale.toArray(),indices:mesh.geometry.index.count,
      uv:Array.from(mesh.geometry.attributes.uv.array).slice(0,8),
      rotatedUv:Array.from(group.children[0].children[1].geometry.attributes.uv.array).slice(40,48),
      failures,groups:group.children[0].children.length};
    group.userData.disposeTextures();group.traverse((o:any)=>{if(o.isMesh){o.geometry.dispose();o.material.forEach((m:any)=>m.dispose());}});
    return data;
  },{model,png});
  expect(result.r).toEqual([1,-.25,1.75]);expect(result.l).toEqual([-2,1,2]);
  expect(result.lr[1]).toBeCloseTo(-70*Math.PI/180);expect(result.lr[2]).toBeCloseTo(-5*Math.PI/180);
  expect(result.scale).toEqual([.5,.6,.7]);expect(result.indices).toBe(36);
  expect(result.uv).toEqual([0,1,1,1,0,0,1,0]);expect(result.failures).toEqual([true,true,true,true]);expect(result.groups).toBe(2);
  expect(result.rotatedUv).toEqual([0,.5,0,1,.5,.5,.5,1]);
});

test("Java importer requires textures and rejects unsupported model files without replacing the item",async({page})=>{
  const {png}=await setup(page);await openImport(page);
  await page.getByLabel("Java model JSON").setInputFiles({name:"bad.json",mimeType:"application/json",buffer:Buffer.from('{"parent":"missing"}')});
  await expect(page.getByRole("alert")).toContainText("cuboid elements");
  await expect(page.getByRole("button",{name:"Use 3D model"})).toBeDisabled();
  await page.getByLabel("Java model JSON").setInputFiles({name:"good.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(model))});
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Texture: test/wood").setInputFiles({name:"one.png",mimeType:"image/png",buffer:Buffer.from(png.split(",")[1]!,"base64")});
  await expect(page.getByRole("button",{name:"Use 3D model"})).toBeDisabled();
});

for (const avatar of ["Default","Bobblehead","Advanced","Stylized"]) test(`Java items follow ${avatar}, both arm widths, layers and render styles`,async({page})=>{
  test.setTimeout(180000);
  const {png,errors}=await setup(page);await importModel(page,png);await importModel(page,png,"Left Arm");
    await page.getByRole("button",{name:"Document",exact:true}).click();
    await page.getByRole("button",{name:"Avatar Type",exact:true}).click();
    await page.getByRole("button",{name:new RegExp(`^${avatar} `)}).click();
    await page.getByRole("button",{name:"Close document modal"}).click();
    for(const arm of ["default","slim"]) {
      await page.getByRole("button",{name:"Document",exact:true}).click();
      await page.getByRole("button",{name:"Skin Source",exact:true}).click();
      await page.getByLabel("Uploaded arm model").selectOption(arm);
      await page.getByRole("button",{name:"Close document modal"}).click();
      await expect(page.getByRole("button",{name:"Export",exact:true})).toBeEnabled();
      for(const style of ["classic","stylized"]) {
        await page.getByRole("combobox",{name:"Render style"}).selectOption(style);
        for(const layer of ["hidden","flat","voxel"]) {
          await page.getByLabel("Show outer layer",{exact:true}).setChecked(layer!=="hidden");
          await page.getByLabel("3D outer layer",{exact:true}).setChecked(layer==="voxel");
          await expect.poll(()=>page.evaluate(()=>{
            const groups:any[]=[];(window as any).__javaViewer.playerObject.traverse((o:any)=>{if(o.userData.javaItem)groups.push(o);});
            return groups.map(g=>({count:g.children[0].children.length,y:g.position.y,x:g.position.x, parent:g.parent.name}));
          })).toEqual([
            expect.objectContaining({count:2,y:["Advanced","Stylized"].includes(avatar)?-4:-8}),
            expect.objectContaining({count:2,y:["Advanced","Stylized"].includes(avatar)?-4:-8}),
          ]);
        }
      }
    }
  if (["Advanced","Stylized"].includes(avatar)) {
    const itemMatrix=()=>page.evaluate(()=>{
      const v=(window as any).__javaViewer;v.playerObject.updateMatrixWorld(true);
      return v.playerObject.getObjectByName("leftArm-held-item-group").matrixWorld.elements;
    });
    const before=await itemMatrix();
    await page.getByRole("button",{name:"Left elbow bend",exact:true}).click();
    await page.locator('.editor-sidebar--right input[type="range"]').first().fill("60");
    await expect.poll(itemMatrix).not.toEqual(before);
  }
  await page.getByLabel("Show held items",{exact:true}).uncheck();
  expect(await page.evaluate(()=>{let visible=0;(window as any).__javaViewer.playerObject.traverseVisible((o:any)=>{if(o.userData.javaItem)visible++;});return visible;})).toBe(0);
  expect(errors).toEqual([]);
});

test("Java items survive saving, importing, sharing and undo",async({page})=>{
  test.setTimeout(120000);
  const {png,errors}=await setup(page);await importModel(page,png);
  await page.getByRole("button",{name:"File",exact:true}).click();
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Save",exact:true}).click();
  const saved=JSON.parse(await readFile((await (await download).path())!,"utf8"));
  expect(saved.heldItems.rightArm.javaModel.model.elements).toHaveLength(2);
  expect(Object.keys(saved.heldItems.rightArm.javaModel.textures)).toHaveLength(2);
  await page.getByRole("button",{name:"Remove Item",exact:true}).click();
  await page.getByRole("button",{name:"Edit",exact:true}).click();await page.getByRole("button",{name:/^Undo/}).click();
  await expect(page.getByRole("button",{name:"Remove Item",exact:true})).toBeVisible();
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({name:"saved.mcpose",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(saved))});
  await page.getByRole("button",{name:"Share",exact:true}).click();
  await page.getByRole("button",{name:"Generate Link",exact:true}).first().click();
  const field=page.locator("textarea.share-link-field").first();await expect(field).toBeVisible();
  const url=new URL(await field.inputValue());await page.goto("about:blank");await page.goto(`/${url.search}${url.hash}`);
  await expect.poll(()=>page.evaluate(()=>{let n=0;(window as any).__javaViewer?.playerObject.traverse((o:any)=>{if(o.userData.javaItem)n++;});return n;})).toBe(1);
  expect(errors).toEqual([]);
});

test("private supplied Java model imports and exports without bundling its artwork",async({page},testInfo)=>{
  test.skip(!process.env.MC_POSER_ITEM_MODEL || !process.env.MC_POSER_ITEM_TEXTURE,"Opt-in private fixture paths");
  test.setTimeout(120000);
  const {errors}=await setup(page);
  if (process.env.MC_POSER_ITEM_POSE) {
    const pose=JSON.parse(await readFile(process.env.MC_POSER_ITEM_POSE,"utf8"));
    pose.poseFileName="private-model-review.mcpose";
    pose.avatarType="advanced";pose.heldItems={};pose.showOuterLayerIn3d=true;
    pose.appearance={mode:"stylized",brightness:1,warmth:.65,glow:.35};
    pose.pose=Object.fromEntries(Object.keys(pose.pose).map(key=>[key,0]));
    Object.assign(pose.pose,{headPitch:-10,bodyYaw:10,rightArmPitch:-65,rightElbowPitch:20,rightArmRoll:-10});
    await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({name:"private-model-review.mcpose",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(pose))});
    // Private poses can reference a remotely hosted Minecraft skin.
    await expect(page.getByRole("button",{name:"Export",exact:true})).toBeEnabled({timeout:30000});
  }
  await openImport(page);
  await page.getByLabel("Java model JSON").setInputFiles(process.env.MC_POSER_ITEM_MODEL!);
  await page.locator('.java-item-import input[accept=".png,image/png"]').setInputFiles(process.env.MC_POSER_ITEM_TEXTURE!);
  await page.getByRole("button",{name:"Use 3D model",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>{let n=0;(window as any).__javaViewer.playerObject.traverse((o:any)=>{if(o.name==="java-item-element")n++;});return n;})).toBeGreaterThan(0);
  const visiblePixels=await page.evaluate(()=>{
    const v=(window as any).__javaViewer;
    v.scene.traverse((o:any)=>{if(o.type==="LineSegments" || o.type==="TransformControls")o.visible=false;});
    const c=document.createElement("canvas");c.width=v.canvas.width;c.height=v.canvas.height;const ctx=c.getContext("2d")!;
    const sample=()=>{v.render();ctx.drawImage(v.canvas,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
    const withItem=sample();
    v.playerObject.traverse((o:any)=>{if(o.userData.javaItem)o.visible=false;});const without=sample();
    v.playerObject.traverse((o:any)=>{if(o.userData.javaItem)o.visible=true;});v.render();
    let changed=0;for(let i=0;i<withItem.length;i+=4)if(Math.abs(withItem[i]!-without[i]!)+Math.abs(withItem[i+1]!-without[i+1]!)+Math.abs(withItem[i+2]!-without[i+2]!)>15)changed++;
    return changed;
  });
  expect(visiblePixels).toBeGreaterThan(500);
  await mkdir(".debug/java-items",{recursive:true});
  await page.getByRole("button",{name:"File",exact:true}).click();
  const saved=page.waitForEvent("download");await page.getByRole("button",{name:"Save",exact:true}).click();
  await (await saved).saveAs(".debug/java-items/private-model-review.mcpose");
  await page.getByRole("button",{name:"Render options",exact:true}).click();
  await page.screenshot({path:testInfo.outputPath("private-item.png")});
  await mkdir(".debug/java-items",{recursive:true});
  await page.screenshot({path:".debug/java-items/private-item.png"});
  await page.getByRole("button",{name:"Export",exact:true}).click();
  const modal=page.getByRole("dialog",{name:"Export",exact:true});
  await modal.getByLabel("Width",{exact:true}).fill("800");
  await modal.getByLabel("Height",{exact:true}).fill("1000");
  await expect(modal.getByAltText("Export preview")).toBeVisible();
  const download=page.waitForEvent("download");
  await modal.getByRole("button",{name:"Export Image",exact:true}).click();
  await (await download).saveAs(".debug/java-items/private-export.png");
  expect(errors).toEqual([]);
});
