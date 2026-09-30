const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
// Start the QA engine and editor against temporary layouts/playable JSON before running.
const output = process.env.OUTPUT_DIR || '/tmp/cosy-bridge-world';
fs.mkdirSync(output, {recursive:true});
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 const checks = [], errors = [];
 const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
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
  await page.locator('#scene canvas').focus();await page.keyboard.down('w');
  const keyboard = await page.evaluate(() => {const e=window.engine;let now=performance.now();e.lastTime=now;for(let i=0;i<120;i++){now+=1000/60;e.frame(now);}return{position:e.movement.position,keys:[...e.keys]};});
  await page.keyboard.up('w');check(keyboard.keys.includes('w')&&keyboard.position.z<3.5,'Actual W key crosses the bridge bank opening in the rendered engine');
  await page.evaluate(async () => {const {BRIDGE}=await import('/modules/features/village/environment.js'),e=window.engine;e.clearKeys();e.setBlocked(true);e.frame(e.lastTime+16);e.movement.settle(BRIDGE.x+5.2,BRIDGE.z);e.player.position.copy(e.movement.position);e.camera.position.set(BRIDGE.x+1,12,BRIDGE.z+8);e.camera.lookAt(BRIDGE.x,0,BRIDGE.z);e.renderer.render(e.scene,e.camera);});
  await page.locator('#scene canvas').screenshot({path:path.join(output,'bridge-symmetric-local.png')});
  const editor = await browser.newPage({viewport:{width:1440,height:900}});editor.on('pageerror',e=>errors.push(String(e)));
  const editorUrl=process.env.EDITOR_URL || 'http://127.0.0.1:3118';
  await editor.goto(editorUrl);await editor.waitForFunction(()=>window.cosyStudio,null,{timeout:60000});
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
  await editor.reload();await editor.waitForFunction(()=>window.cosyStudio);
  check(JSON.stringify(await editor.evaluate(id=>cosyStudio.snapshot().layout.objects.find(o=>o.id===id),item.id))===JSON.stringify(item),'Bridge transforms survive editor reload');
  check(errors.length===0,'No captured runtime or editor page errors');
  fs.writeFileSync(path.join(output,'bridge-corners-local.json'),JSON.stringify({pass:true,scope:'Local Chrome production-module engine and isolated editor, not deployed',checks,keyboard,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,keyboard,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
