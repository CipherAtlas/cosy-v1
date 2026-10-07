// Uses an isolated editor; never applies into the repository's playable layout.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
 const url = process.env.EDITOR_URL;
 assert(url, 'Set EDITOR_URL to an isolated editor with temporary layouts/playable paths');
 const waterfallOnly = process.env.PICNIC_WATERFALL_ONLY === '1';
 const output = process.env.OUTPUT_DIR || 'docs/village/evidence/picnic-20261007';
 fs.mkdirSync(output,{recursive:true});
 const protectedFiles = ['public/village/world-layout.json', ...['presets','layouts'].flatMap(dir => fs.readdirSync(`tools/village-editor/${dir}`).filter(name => name.endsWith('.json')).map(name => `tools/village-editor/${dir}/${name}`))];
 const hashes = () => Object.fromEntries(protectedFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
 const before = hashes(), checks = [], errors = [];
 const check = (condition, label) => { assert(condition,label); checks.push(label); console.log(label); };
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}}); page.on('pageerror', error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('dialog',dialog=>dialog.accept());
  console.log("Loading isolated editor");await page.goto(url); await page.waitForFunction(()=>window.cosyStudio,null,{timeout:Number(process.env.STUDIO_READY_TIMEOUT || 120000)});
  console.log("Editor ready");const fixture = JSON.parse(fs.readFileSync('public/village/world-layout.json'));
  delete fixture.routes;
  fixture.objects = fixture.objects.filter(item => (waterfallOnly ? ['terrain'] : ['terrain','garden-kitchen','picnic-mat','picnic-basket','hill-waterfall']).includes(item.asset));
  await page.locator('#import-file').setInputFiles({name:'picnic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await page.waitForFunction(name=>cosyStudio.snapshot().layout.name.startsWith(name),fixture.name);
  await page.locator('#categories button').filter({hasText:/^All$/}).click(); await page.locator('#assets-tab').click(); await page.locator('#avoid-overlaps').uncheck();
  await page.getByRole('button',{name:'Top down',exact:true}).click();
  const wanted=waterfallOnly ? ['hill-waterfall','hill-rock-outcrop'] : ['garden-kitchen','picnic-mat','picnic-basket','picnic-food-gardenSoup','picnic-food-crispSalad','picnic-food-bakedApples','picnic-food-roastRoots','hill-waterfall'];
  const catalog=await page.evaluate(()=>cosyStudio.assets()), placed={};
  for (const [index,id] of wanted.entries()) {
   const category=id.startsWith('hill-')?'Landscape':'Furnishings';
   const info=catalog.find(asset=>asset.id===id);check(info?.category===category&&info.name.trim().length>0,`${id} has a named ${category} registration`);
   await page.locator('#search').fill(info.name);const card=page.locator(`[data-asset="${id}"]`);
   await page.waitForFunction(id=>document.querySelector(`[data-asset="${id}"] img`)?.src?.startsWith('data:image'),id,{timeout:Number(process.env.STUDIO_READY_TIMEOUT || 120000)});
   const pixels=await card.locator('img').evaluate(image=>{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data].filter((v,i)=>i%4===3&&v>30).length;});
   check(pixels>100,`${id} shows a rendered geometry preview`);
   if(id==='hill-waterfall') {
    const waterPixels=await card.locator('img').evaluate(image=>{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>100&&data[i+1]>data[i]+10&&data[i+2]>data[i]+8)count++;return count;});
    check(waterPixels>20,'Waterfall shelf preview renders colored water as well as rocks');
    await page.screenshot({path:path.join(output,'waterfall-catalog.png')});
   }
   await card.click();const point=await page.evaluate(()=>cosyStudio.screenPoint('terrain',[24,0,23]));await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
   await page.waitForFunction(id=>cosyStudio.selection().some(selected=>cosyStudio.snapshot().layout.objects.some(item=>item.id===selected&&item.asset===id)),id);
   await page.keyboard.press('Escape');
   for(const[field,value]of Object.entries({'position-0':String(150+index*6),'position-1':'5','position-2':'120','rotation-1':'35','scale-0':'1.2','object-name':`Picnic QA ${id}`})){await page.locator(`#${field}`).fill(value);await page.locator(`#${field}`).press('Tab');}
   const item=await page.evaluate(()=>cosyStudio.snapshot().layout.objects.find(item=>item.id===cosyStudio.selection()[0]));placed[id]=item.id;
   check(item.position[0]===150+index*6&&item.position[1]===5&&item.rotation[1]===35&&item.scale.every(v=>Math.abs(v-1.2)<1e-6),`${id} accepts placement, yaw and scale controls`);
   await page.locator('#scene-tab').click();await page.locator('#search').fill(`Picnic QA ${id}`);await page.locator('#scene-list .scene-select').filter({hasText:`Picnic QA ${id}`}).click();
   check((await page.evaluate(()=>cosyStudio.selection()))[0]===item.id,`${id} can be selected from the Scene list`);
   await page.locator('#home-view').click();await page.getByRole('button',{name:'Top down',exact:true}).click();await page.locator('#assets-tab').click();
  }
  await page.locator('#layout-name').fill('Picnic isolated editor QA');await page.locator('#layout-name').press('Tab');await page.locator('#save').click();await page.waitForFunction(()=>cosyStudio.snapshot().fileId);
  const file=await page.evaluate(()=>cosyStudio.snapshot().fileId);const saved=(await(await page.request.get(`${url}/api/layouts/${file}`)).json()).layout;
  for(const id of wanted) {
   const item=saved.objects.find(item=>item.id===placed[id]);
   check(item.rotation[1]===35&&item.position[1]===5&&item.scale.every(v=>Math.abs(v-1.2)<1e-6),`${id} placement, yaw and scale survive file save`);
  }
  await page.reload();await page.waitForFunction(()=>window.cosyStudio,null,{timeout:Number(process.env.STUDIO_READY_TIMEOUT || 120000)});assert.deepEqual(await page.evaluate(()=>cosyStudio.snapshot().layout),saved);check(true,'Complete layout and terrain survive browser reload');
  await page.locator('#layouts').click();await page.locator('#apply-game').click();await page.waitForFunction(()=>!document.querySelector('#layout-dialog').open);
  assert.deepEqual((await(await page.request.get(`${url}/api/playable`)).json()).layout,saved);check(true,'Apply saves all new props and terrain into the isolated playable file');
  assert.deepEqual(hashes(),before);check(errors.length===0,'Protected layouts remain byte-identical with no page errors');
  await page.locator('#scene-tab').click();await page.locator('#search').fill(`Picnic QA ${wanted.at(-1)}`);await page.locator('#scene-list .scene-select').filter({hasText:`Picnic QA ${wanted.at(-1)}`}).click();await page.keyboard.press('f');
  await page.screenshot({path:path.join(output,'waterfall-placed.png')});
  await page.locator('#assets-tab').click();await page.locator('#search').fill(waterfallOnly?'Hill waterfall':'picnic');await page.screenshot({path:path.join(output,'editor.png')});
  fs.writeFileSync(path.join(output,'editor.json'),JSON.stringify({checks,errors,limits:'Local Chrome editor, pointer/control placement and temporary save/Apply. Asset-control fixture contains terrain and tested props; omits unrelated town objects and routes. Source layout and presets unchanged.'},null,2));console.log(`${checks.length} editor checks passed.`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
