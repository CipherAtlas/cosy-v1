const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
// Start the QA engine and editor against temporary layouts/playable JSON before running.
const output = process.env.OUTPUT_DIR || '/tmp/cosy-bridge-world';
fs.mkdirSync(output, {recursive:true});
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 const checks = [], errors = [];
 const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); console.log(label); };
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:3117');
  const worldChecks = await page.evaluate(async () => {
   const T = await import('three');
   const {VillageEngine} = await import('/modules/features/village/VillageEngine.js');
   const {BRIDGE,bridgeHeight} = await import('/modules/features/village/environment.js');
   const checks=[], check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);}, noop=()=>{};
   document.body.innerHTML='<div class="village"><div id="scene" style="position:fixed;inset:0"></div></div>';
   const e=window.engine=new VillageEngine(document.querySelector('#scene'),{progress:noop,ready:noop,near:noop,interact:noop,movement:noop,contact:noop,stats:noop,environment:noop,error:m=>{throw Error(m)}});
   await e.load();e.setQuality('low');e.setWeather('golden');e.setBlocked(false);e.renderer.setAnimationLoop(null);
   const m=e.movement;
   for(const fps of [30,60,120])for(const end of [-1,1])for(const side of [-1,1]) {
    const x=BRIDGE.x+end*(BRIDGE.length/2-BRIDGE.approachOpening-.17),z=BRIDGE.z+side*(BRIDGE.width/2+.37);
    m.settle(x,z);m.position.y=bridgeHeight(x)+.94;m.update(1/fps,{x:0,z:0,run:false,sprint:false,blocked:false});
    check(m.clear(m.position.x,m.position.z,m.position.y),`Full world post correction ${fps}/${end}/${side}`);
    for(let i=0;i<fps*2;i++)m.update(1/fps,{x:end,z:0,run:false,sprint:false,blocked:false});
    check(end*(m.position.x-x)>1,`Full world escape ${fps}/${end}/${side}`);
   }
   for(const end of [-1,1])for(const side of [-1,1]) {
    const x=BRIDGE.x+end*(BRIDGE.length/2-.8);m.settle(x,BRIDGE.z+side*3);
    check(m.canWalkTo(x,BRIDGE.z+side*.5),`Full world clear approach ${end}/${side}`);
    for(let i=0;i<120;i++)m.update(1/60,{x:0,z:-side,run:false,sprint:false,blocked:false});
    check(side*(m.position.z-BRIDGE.z)<.5,`Full world approach traversal ${end}/${side}`);
   }
   const bridge=e.scene.getObjectByName('Stone arch bridge'),ray=new T.Raycaster();
   check(!!bridge,'The runtime contains the revised bridge');
   const waterfall=e.world.group.getObjectByName('Hill waterfall');
   check(!!waterfall?.getObjectByName('Waterfall spray'),'The placed waterfall includes animated spray');
   check(!!waterfall?.getObjectByName('Expanding waterfall foam'),'The placed waterfall includes animated basin foam');
   const { riverGeometry } = await import('/modules/features/village/riverGeometry.js');
   const { makeWater } = await import('/modules/features/village/water.js');
   const flowScene=new T.Scene(),flowClock={value:1};
   flowScene.add(new T.Mesh(riverGeometry([[0,0],[0,10]],2.6),makeWater(flowClock,{value:.25}).material),
     new T.HemisphereLight(0xffffff,0x456756,2));
   const flowCamera=new T.OrthographicCamera(-2,2,6,-6,.1,30);
   flowCamera.position.set(0,12,5);flowCamera.up.set(0,0,-1);flowCamera.lookAt(0,0,5);
   const flowTarget=new T.WebGLRenderTarget(128,384);
   const flowPixels=time=>{flowClock.value=time;e.renderer.setRenderTarget(flowTarget);e.renderer.render(flowScene,flowCamera);
     const data=new Uint8Array(128*384*4);e.renderer.readRenderTargetPixels(flowTarget,0,0,128,384,data);return data;};
   const flowFirst=flowPixels(1),flowNext=flowPixels(3.5),shift=72;
   const flowError=direction=>{let sum=0;for(let y=110;y<274;y++)for(let x=35;x<93;x++)for(let c=0;c<3;c++)
     sum+=Math.abs(flowFirst[(y*128+x)*4+c]-flowNext[((y+direction*shift)*128+x)*4+c]);return sum;};
   // readRenderTargetPixels starts at the bottom; increasing world Z moves toward smaller pixel Y.
   check(flowError(-1)<flowError(1)*.5,'Rendered river detail advects downstream rather than upstream');
   const flowStill=flowPixels(0),flowAgain=flowPixels(0);
   check(flowStill.every((v,i)=>v===flowAgain[i]),'Reduced-motion river field remains pixel-identical');
   flowTarget.dispose();flowScene.children[0].geometry.dispose();flowScene.children[0].material.dispose();
   const waterScene=new T.Scene();waterScene.background=new T.Color('#25413b');waterScene.add(waterfall.clone(true),new T.HemisphereLight(0xffffff,0x456756,2));
   const waterCamera=new T.PerspectiveCamera(45,1,.1,100);
   waterCamera.position.copy(waterfall.localToWorld(new T.Vector3(0,9,27)));
   waterCamera.lookAt(waterfall.localToWorld(new T.Vector3(0,9,0)));
   const target=new T.WebGLRenderTarget(256,256),clock=e.world.water.userData.time;
   const pixels=time=>{clock.value=time;e.renderer.setRenderTarget(target);e.renderer.render(waterScene,waterCamera);
     const data=new Uint8Array(256*256*4);e.renderer.readRenderTargetPixels(target,0,0,256,256,data);return data;};
   const first=pixels(1),second=pixels(1.8);
   check(first.filter((v,i)=>Math.abs(v-second[i])>8).length>1000,'Rendered waterfall changes visibly as the water clock advances');
   const still=pixels(0),again=pixels(0);
   check(still.every((v,i)=>v===again[i]),'Frozen water clock keeps curtain, foam and spray still');
   e.renderer.setRenderTarget(null);target.dispose();
   for(const offset of [0,4,4.7,5.5])for(const dz of [1.35,1.66,1.87,2.05]) {
    const heights=[];
    for(const end of[-1,1])for(const side of[-1,1]) {
     ray.set(new T.Vector3(BRIDGE.x+end*offset,4,BRIDGE.z+side*dz),new T.Vector3(0,-1,0));heights.push(ray.intersectObject(bridge,true)[0]?.point.y??-10);
    }
    check(Math.max(...heights)-Math.min(...heights)<.003,`Full world masonry symmetry ${offset}/${dz}`);
   }
   e.clearKeys();e.yaw=0;e.movement.settle(BRIDGE.x+5.2,BRIDGE.z+3);e.player.position.copy(e.movement.position);
   return checks;
  });
  checks.push(...worldChecks);
  if (process.env.WATER_WORLD_ONLY === '1') {
   check(errors.length === 0, 'World water and bridge checks have no page errors');
   fs.writeFileSync(path.join(output, 'world-only.json'), JSON.stringify({checks, errors}, null, 2));
   console.log(`${checks.length} world water/bridge checks passed.`); return;
  }
  await page.locator('#scene canvas').focus();await page.keyboard.down('w');
  const keyboard = await page.evaluate(() => {const e=window.engine;let now=performance.now();e.lastTime=now;for(let i=0;i<120;i++){now+=1000/60;e.frame(now);}return{position:e.movement.position,keys:[...e.keys]};});
  await page.keyboard.up('w');check(keyboard.keys.includes('w')&&keyboard.position.z<3.5,'Actual W key crosses the bridge bank opening in the rendered engine');
  await page.evaluate(async () => {const {BRIDGE}=await import('/modules/features/village/environment.js'),e=window.engine;e.clearKeys();e.setBlocked(true);e.frame(e.lastTime+16);e.movement.settle(BRIDGE.x+5.2,BRIDGE.z);e.player.position.copy(e.movement.position);e.camera.position.set(BRIDGE.x+1,12,BRIDGE.z+8);e.camera.lookAt(BRIDGE.x,0,BRIDGE.z);e.renderer.render(e.scene,e.camera);});
  await page.locator('#scene canvas').screenshot({path:path.join(output,'bridge-symmetric-local.png')});
  const editor = await browser.newPage({viewport:{width:1440,height:900}});editor.on('pageerror',e=>errors.push(String(e)));
  editor.setDefaultTimeout(30000);
  const editorUrl=process.env.EDITOR_URL || 'http://127.0.0.1:3118';
  await editor.goto(editorUrl);await editor.waitForFunction(()=>window.cosyStudio,null,{timeout:Number(process.env.STUDIO_READY_TIMEOUT || 60000)});
  const fixture=JSON.parse(fs.readFileSync('public/village/world-layout.json'));delete fixture.routes;
  fixture.objects=fixture.objects.filter(item=>['terrain','bridge'].includes(item.asset));
  await editor.locator('#import-file').setInputFiles({name:'bridges.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  check(await editor.evaluate(()=>cosyStudio.assets().some(a=>a.id==='bridge'&&a.name==='Stone arch bridge'&&a.category==='Bridges')),'Bridge retains its editor asset ID, name and category');
  await editor.getByRole('searchbox').fill('Stone arch bridge');
  await editor.waitForFunction(()=>document.querySelector('[data-asset="bridge"] img')?.src.startsWith('data:image'));
  check(true,'Revised bridge has a rendered editor library preview');
  const preview=await(await editor.waitForFunction(()=>{const src=document.querySelector('[data-asset="bridge"] img')?.src;return src?.startsWith('data:image')?src:false;})).jsonValue();
  fs.writeFileSync(path.join(output,'bridge-editor-preview-local.png'),Buffer.from(preview.split(',')[1],'base64'));
  await editor.locator('#scene-tab').click();
  await editor.locator('#scene-list .scene-select').filter({hasText:'Stone arch bridge'}).click();
  await editor.getByLabel('Avoid solid overlaps',{exact:true}).uncheck();
  for(const [field,value] of Object.entries({'position-0':'30','rotation-1':'35','scale-0':'1.1'})) {await editor.locator('#'+field).fill(value);await editor.locator('#'+field).press('Tab');}
  const item=await editor.evaluate(()=>cosyStudio.snapshot().layout.objects.find(o=>o.asset==='bridge'));
  check(item.position[0]===30&&item.rotation[1]===35&&item.scale.every(n=>Math.abs(n-1.1)<.001),'Bridge supports selection, placement, rotation and scaling');
  await editor.getByLabel('Layout name',{exact:true}).fill('Symmetric bridge QA');await editor.getByLabel('Layout name',{exact:true}).press('Tab');await editor.locator('#save').click();
  await editor.waitForFunction(()=>!!cosyStudio.snapshot().fileId);
  const id=await editor.evaluate(()=>cosyStudio.snapshot().fileId);
  const saved=await(await editor.request.get(`${editorUrl}/api/layouts/${id}`)).json();
  check(JSON.stringify(saved.layout.objects.find(o=>o.id===item.id))===JSON.stringify(item),'Bridge transforms persist in isolated saved JSON');
  await editor.reload();await editor.waitForFunction(()=>window.cosyStudio,null,{timeout:120000});
  check(JSON.stringify(await editor.evaluate(id=>cosyStudio.snapshot().layout.objects.find(o=>o.id===id),item.id))===JSON.stringify(item),'Bridge transforms survive editor reload');
  check(errors.length===0,'No captured runtime or editor page errors');
  fs.writeFileSync(path.join(output,'bridge-corners-local.json'),JSON.stringify({pass:true,scope:'Local Chrome production-module engine and isolated editor, not deployed',checks,keyboard,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,keyboard,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
