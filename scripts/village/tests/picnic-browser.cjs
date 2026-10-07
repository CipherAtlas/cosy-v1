// Exported app with independent browser clients, connected to the real test Worker.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = async function picnicBrowser({ workerUrl, control, tick }) {
 const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
 const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] });
 const checks = [], errors = [], contexts = [], clearance = [];
 const output = path.resolve(process.env.PICNIC_EVIDENCE_DIR || 'docs/village/evidence/picnic-20261007'); fs.mkdirSync(output,{recursive:true});
 const check = (ok, label) => { assert(ok, label); checks.push(label); console.log(label); };
 const mat = JSON.parse(fs.readFileSync('public/village/world-layout.json','utf8')).objects.find(item=>item.id==='picnic-hill-mat');
 const [matX, , matZ] = mat.position;
 const viewports = process.env.PICNIC_POINTER_ONLY === '1' ? [] : [[1366,768],[1024,640],[810,1080],[1080,810],[820,1180],[1180,820],[744,1133],[1133,744]];
 async function attach(page) {
  await page.waitForFunction(() => document.querySelector('.v-enter-button')?.disabled === false, null, { timeout: 120000 });
  await page.getByRole('button', { name: /Enter Hearthwillow/ }).click();
  await page.waitForFunction(() => {
   for (let el = document.querySelector('canvas'); el; el = el.parentElement) for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
    for (const branch of [fiber, fiber.alternate]) for (let hook = branch?.memoizedState; hook; hook = hook.next) if (hook.memoizedState?.current?.getSharedNow) window.e = hook.memoizedState.current;
   return window.e?.sharedConnected && window.e.sharedSelfId;
  });
 }
 async function join(touch = false) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-US', hasTouch: touch }); contexts.push(context);
  await context.addInitScript(url => {
   localStorage.setItem('cosy-village-preferences', JSON.stringify({ dontShowTutorial: true, language: 'en', weather: 'golden', weatherMode: 'manual', mix: { master: 0, music: 0, ambience: 0, effects: 0 } }));
   const Socket = window.WebSocket;
   window.WebSocket = class extends Socket { constructor(target, protocols) { super(target.includes(':2567') ? url : target, protocols); (window.villageSockets??=[]).push(this); } };
  }, workerUrl);
  const page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  await page.bringToFront(); await page.goto('http://127.0.0.1:3051/?sharedTrial=1'); await attach(page); return page;
 }
 async function move(page, x, z) { await page.bringToFront(); await page.evaluate(([x,z]) => { e.movement.settle(x,z); e.yaw=0; e.pitch=.4; e.distance=7; }, [x,z]); await page.waitForTimeout(300);await page.waitForFunction(()=>e.camera.position.distanceTo(e.view.goal)<.12&&e.currentLook.distanceTo(e.view.look)<.12); await page.locator('canvas').first().focus(); }
 const dialog = page => page.locator('.v-dialog[data-state="open"]');
 async function kitchen(page) { await move(page,113,-75); await page.keyboard.press('e'); await page.getByRole('heading',{name:'Cook',exact:true}).waitFor(); }
 async function basket(page) { await page.locator('canvas').first().focus(); await page.keyboard.press('f'); await page.getByRole('heading',{name:'Picnic basket',exact:true}).waitFor(); }
 async function geometry(page, label, selector='.v-dialog[data-state="open"]') {
  await page.waitForTimeout(150);
  const result = await page.locator(selector).evaluate(root => { const r=root.getBoundingClientRect(), menu=root.querySelector('.v-picnic-menu') ?? root; return {
   fits:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,
   scrolls:menu.scrollHeight>menu.clientHeight?getComputedStyle(menu).overflowY==='auto':true,
   buttons:[...menu.querySelectorAll('button')].every(button=>button.getBoundingClientRect().height>=44), horizontal:menu.scrollWidth<=menu.clientWidth+1,
   sceneSpace:r.width*r.height<innerWidth*innerHeight*.36 }; });
  const avatar=await page.evaluate(() => {
   e.character.updateWorldMatrix(true,true);const canvas=e.renderer.domElement.getBoundingClientRect(), point=e.temp.clone();let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,vertices=0;
   e.character.traverseVisible(mesh=>{const positions=mesh.geometry?.attributes.position;if(!positions)return;for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,point);point.applyMatrix4(mesh.matrixWorld).project(e.camera);const x=canvas.left+(point.x+1)*canvas.width/2,y=canvas.top+(1-point.y)*canvas.height/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);vertices++;}});return{left,right,top,bottom,vertices};
  });
  const panel=await page.locator(selector).boundingBox();const clear=avatar.vertices>0&&(panel.x>=avatar.right||panel.x+panel.width<=avatar.left||panel.y>=avatar.bottom||panel.y+panel.height<=avatar.top);
  clearance.push({label,viewport:page.viewportSize(),panel,avatar,clear});fs.writeFileSync(path.join(output,'ui-avatar-clearance.json'),JSON.stringify(clearance,null,2));
  if(!clear){console.log({label,panel,avatar});await page.screenshot({path:path.join(output,'avatar-overlap.png')});}
  check(clear,`${label}: controls clear the rendered avatar`);
  const valid = result.fits && result.scrolls && result.buttons && result.horizontal && result.sceneSpace;
  if (!valid) { console.log({label,result}); await page.screenshot({path:path.join(output,'ui-failure.png')}); }
  check(valid, label);
 }
 async function dishPoint(page) {
  await page.waitForTimeout(100);
  return page.evaluate(() => {
   const root=[...e.picnicScene.food.values()][0];
   const point=root.position.clone().add({x:0,y:.25,z:0}).project(e.camera), rect=e.renderer.domElement.getBoundingClientRect();
   const x=rect.x+(point.x+1)*rect.width/2,y=rect.y+(1-point.y)*rect.height/2;
   const hit=e.pickPicnicDish(x,y);
   if(x<0||y<0||x>innerWidth||y>innerHeight||hit?.id!==root.userData.dishId) throw Error('The rendered food has no usable click target');
   return {x,y};
  });
 }
 async function portions(pages, count) { for (const page of pages) await page.waitForFunction(count=>count===0?e.sharedActors.picnic.dishes.length===0:e.sharedActors.picnic.dishes[0]?.portions===count,count); }
 async function sit(page, selectedIndex, refused = false) {
  await page.bringToFront();
  const index=selectedIndex??await page.evaluate(()=>{const used=new Set([...e.remoteVisitors.values()].filter(remote=>remote.bench?.id==='picnic-hill-mat').map(remote=>remote.bench.index));return [0,1,2,3,4].find(index=>!used.has(index));});
  const target=await page.evaluate(index=>{const bench=e.world.benches.find(bench=>bench.id==='picnic-hill-mat'),point=e.seatPoint(bench,index);return{x:point.x,z:point.z,y:bench.seatHeight-.08};},index);
  await move(page,target.x-1.5,target.z);
  await page.evaluate(({x,z,y})=>{e.yaw=Math.atan2(e.player.position.x-x,e.player.position.z-z);e.pitch=Math.atan2(e.player.position.y+1.35-y,Math.hypot(e.player.position.x-x,e.player.position.z-z));e.scenePointer=null;},target);
  await page.waitForFunction(index=>e.picnicAim().seat?.index===index,index);
  await page.keyboard.press('e');
  if (refused) { await page.getByText('That seat is occupied. Try a free seat.',{exact:true}).waitFor();check(await page.evaluate(()=>!e.seatedBench),'E refuses the exact looked-at occupied cushion instead of taking another');return; }
  await page.waitForFunction(index=>e.seatedBench?.id==='picnic-hill-mat'&&e.seatedIndex===index,index);
  await page.waitForFunction(()=>{const view=e.camera.getWorldDirection(e.temp);return Math.sin(e.player.rotation.y)>.9&&Math.cos(e.player.rotation.y)>0&&view.x>.7&&view.z>0;});
 }

 async function enterFocus(page) { await page.locator('canvas').first().focus(); await page.keyboard.press('m'); await page.getByRole('button',{name:'Focus cottage',exact:true}).click(); await page.waitForFunction(()=>e.currentPlace==='focus'); }
 try {
  const a = await join(process.env.PICNIC_UI_ONLY === '1'); const aId = await a.evaluate(()=>e.sharedSelfId); await control('ingredients', { id:aId });
  await kitchen(a);
  check(await a.getByRole('button',{name:'Cook',exact:true}).count()===4,'Kitchen exposes four recipes from the accepted basket');
  for(const [width,height] of viewports) { await a.setViewportSize({width,height}); await geometry(a,`Recipe selection leaves world space at ${width}×${height}`); }
  await a.setViewportSize({width:1366,height:768}); await a.screenshot({path:path.join(output,'kitchen-recipes.png')});
  await a.getByRole('button',{name:'Cook',exact:true}).first().click(); await a.locator('.v-cooking-hud').waitFor();
  check(await dialog(a).count()===0,'Accepted cooking closes the recipe dialog and leaves the scene playable');
  check(await a.locator('.v-cooking-hud progress').count()===1,'Cooking progress is in a compact contextual HUD');
  const knife=await a.evaluate(()=>e.picnicScene.kitchens.get('farm-kitchen').knife.position.toArray());
  await a.waitForTimeout(280);
  check(await a.evaluate(before=>{const visual=e.picnicScene.kitchens.get('farm-kitchen');return visual.root.visible&&visual.knife.visible&&visual.knife.position.toArray().some((n,i)=>Math.abs(n-before[i])>.0001);},knife),'Accepted cooking visibly animates preparation at the actual shared kitchen');
  await a.waitForFunction(()=>e.picnicScene.kitchens.get('farm-kitchen').spoon.visible);const spoon=await a.evaluate(()=>e.picnicScene.kitchens.get('farm-kitchen').spoon.position.toArray());await a.waitForTimeout(220);
  check(await a.evaluate(before=>{const visual=e.picnicScene.kitchens.get('farm-kitchen');return visual.spoon.visible&&visual.spoon.position.toArray().some((n,i)=>Math.abs(n-before[i])>.0001);},spoon),'The actual kitchen progresses to an animated stirring stage');
  await a.screenshot({path:path.join(output,'cooking-world.png')});
  if(process.env.PICNIC_UI_ONLY==='1'){
   await a.emulateMedia({reducedMotion:'reduce'});await a.waitForFunction(()=>e.reducedMotion);await a.waitForTimeout(80);
   const still=await a.evaluate(()=>{const visual=e.picnicScene.kitchens.get('farm-kitchen');return{phase:visual.root.userData.phase,ingredients:visual.ingredients.children.map(food=>food.position.toArray()),spoon:visual.spoon.position.toArray()};});
   await a.waitForTimeout(180);check(await a.evaluate(before=>{const visual=e.picnicScene.kitchens.get('farm-kitchen');return visual.root.userData.phase===before.phase&&JSON.stringify(visual.ingredients.children.map(food=>food.position.toArray()))===JSON.stringify(before.ingredients)&&JSON.stringify(visual.spoon.position.toArray())===JSON.stringify(before.spoon)&&getComputedStyle(document.querySelector('.v-cooking-pot b')).animationName==='none';},still),'Reduced motion holds actual ingredients and spoon still within the cooking stage');
   await a.emulateMedia({reducedMotion:'no-preference'});
  }
  await tick(4600); await a.locator('.v-cooking-hud button').waitFor();
  check(await a.locator('.v-cooking-hud button').getAttribute('aria-keyshortcuts')==='E'&&await a.locator('.v-cooking-hud kbd').textContent()==='E','Ready food exposes the real E pack shortcut');
  for(const [width,height] of viewports) { await a.setViewportSize({width,height}); await geometry(a,`Ready cooking HUD fits at ${width}×${height}`,'.v-cooking-hud'); }
  await a.setViewportSize({width:1366,height:768}); await a.locator('canvas').first().focus(); await a.keyboard.press('e');
  await a.waitForFunction(()=>e.forageInventory.gardenSoup===1); await a.locator('.v-cooking-hud').waitFor({state:'detached'});
  check(true,'E packs one persisted dish and dismisses the cooking HUD without reopening a menu');
  await move(a,matX,matZ); await basket(a);
  await a.getByRole('button',{name:'Place on mat',exact:true}).first().click(); await a.waitForFunction(()=>e.sharedActors.picnic.dishes.length===1&&e.forageInventory.gardenSoup===0);
  check(await a.evaluate(()=>e.picnicScene.food.size===1),'Sharing renders a real dish and spends one saved dish');
  if(await dialog(a).count()) await a.keyboard.press('Escape');
  if (process.env.PICNIC_POINTER_ONLY === '1') {
   const observer = await join(); await observer.waitForFunction(()=>e.sharedActors.picnic.dishes[0]?.portions===3);
   await a.bringToFront(); await move(a,matX,matZ);
   const capture = await a.evaluate(()=>{const rect=e.renderer.domElement.getBoundingClientRect();return {x:rect.left+rect.width*.8,y:rect.top+rect.height*.4};});
   check(await a.evaluate(({x,y})=>!e.pickPicnicDish(x,y),capture),'Pointer capture begins on empty scene space without consuming food');
   await a.mouse.click(capture.x,capture.y);
   await a.waitForFunction(()=>document.pointerLockElement===e.renderer.domElement&&e.mouseLook==='locked');
   check(await a.locator('.v-picnic-reticle').isVisible(),'Actual pointer capture displays the picnic aiming reticle');
   await a.evaluate(()=>{
    const food=[...e.picnicScene.food.values()][0].position.clone().add({x:0,y:.25,z:0});
    const dx=e.player.position.x-food.x,dz=e.player.position.z-food.z;
    e.yaw=Math.atan2(dx,dz);e.pitch=Math.atan2(e.player.position.y+1.35-food.y,Math.hypot(dx,dz));
   });
   await a.waitForFunction(()=>{const rect=e.renderer.domElement.getBoundingClientRect();return e.pickPicnicDish(rect.left+rect.width/2,rect.top+rect.height/2)?.id===e.sharedActors.picnic.dishes[0]?.id;});
   check(await a.evaluate(()=>document.pointerLockElement===e.renderer.domElement)&&await dialog(a).count()===0,'The captured-pointer center ray targets real food with the menu closed');
   await a.screenshot({path:path.join(output,'pointer-locked-food.png')});
   await a.mouse.down(); await a.mouse.up(); await portions([a,observer],2);
   check(await a.evaluate(()=>document.pointerLockElement===e.renderer.domElement)&&await dialog(a).count()===0,'A captured-pointer click eats a shared portion without opening a menu or releasing capture');
   check(await observer.evaluate(()=>e.sharedActors.picnic.dishes[0]?.portions===2),'The accepted captured-pointer bite broadcasts to a second real browser');
   const eaterId=await a.evaluate(()=>e.sharedSelfId), observerId=await observer.evaluate(()=>e.sharedSelfId), acceptedAt=await a.evaluate(()=>e.sharedActors.picnic.bites.find(bite=>bite.visitor===e.sharedSelfId).at);
   await a.evaluate(()=>villageSockets.at(-1).close());await observer.evaluate(()=>villageSockets.at(-1).close());
   await a.waitForFunction(id=>e.sharedConnected&&e.sharedSelfId!==id,eaterId);await observer.waitForFunction(id=>e.sharedConnected&&e.sharedSelfId!==id,observerId);
   const resumedId=await a.evaluate(()=>e.sharedSelfId);
   await a.waitForFunction(({id,at})=>e.sharedActors.picnic.bites.some(bite=>bite.visitor===id&&bite.at===at),{id:resumedId,at:acceptedAt});
   await observer.waitForFunction(({id,at})=>e.sharedActors.picnic.bites.some(bite=>bite.visitor===id&&bite.at===at),{id:resumedId,at:acceptedAt});
   check(true,'Real reconnect and a late WebSocket join retain the same accepted meal clock instead of restarting it');
   const untilHeart=await a.evaluate(at=>Math.max(0,at+1800-e.getSharedNow()),acceptedAt);if(untilHeart)await tick(untilHeart);
   await a.bringToFront();await a.waitForFunction(id=>e.mealFeedback.hearts.get(id)?.visible,resumedId);
   check(true,'The reconnected eater shows its own heart after the shared eating phase');
   await observer.bringToFront();await observer.waitForFunction(id=>e.mealFeedback.hearts.get(id)?.visible,resumedId);
   check(true,'Another reconnected client shows the same post-meal heart');
   await observer.emulateMedia({reducedMotion:'reduce'});await observer.waitForFunction(id=>e.reducedMotion&&e.mealFeedback.hearts.get(id)?.visible&&Math.abs(e.mealFeedback.hearts.get(id).scale.x-.55)<.001&&e.mealFeedback.hearts.get(id).material.opacity===1,resumedId);
   await observer.waitForTimeout(100);
   check(await observer.evaluate(id=>{const heart=e.mealFeedback.hearts.get(id),actor=e.remoteVisitors.get(id);return heart.visible&&Math.abs(heart.position.y-actor.group.position.y-2.1)<.001&&Math.abs(heart.scale.x-.55)<.001&&heart.material.opacity===1;},resumedId),'Reduced motion presents a still visible heart without bobbing or scaling');
   check(errors.length===0,'No page errors in the focused captured-pointer food interaction');
   fs.writeFileSync(path.join(output,'pointer-lock.json'),JSON.stringify({checks,errors,limits:'Local Chrome captured-pointer input against the static export and a real SQLite Worker; deterministic starting position and camera aim, injected ingredients and clock. This is not a native Firefox or iPad check.'},null,2));return;
  }
  if (process.env.PICNIC_UI_ONLY === '1') {
   await basket(a);
   for(const [width,height] of viewports) { await a.setViewportSize({width,height}); await geometry(a,`Picnic basket at ${width}×${height}`); }
   await a.screenshot({path:path.join(output,'picnic-ipad.png')}); await a.keyboard.press('Escape'); await a.setViewportSize({width:1366,height:768});
   await a.locator('canvas').first().focus();await a.keyboard.press('m');await a.locator('[data-map-destination="kitchen:farm-kitchen"]').waitFor();
   check(await a.locator('[data-map-destination="mood"]').count()===0&&await a.getByRole('button',{name:'Tea garden',exact:true}).count()===0&&await a.locator('[data-map-destination="garden"]').count()===1,'The English atlas excludes Tea garden while retaining Kitchen garden and the cooking kitchen');
   check(await a.evaluate(()=>!e.world.mapScenery.benches.some(bench=>bench.id==='object-1a58c8e9-1dbb-49df-9fbc-44af753f543b')&&!e.world.mapScenery.layout.paths.some(path=>path.id==='town-owl-loop')&&e.world.mapScenery.layout.rivers.some(river=>river.id==='hill-waterfall-stream')),'Actual atlas scenery omits the removed north bench and loop and includes the waterfall stream');
   await a.keyboard.press('Escape');
   for(const id of ['kitchen:farm-kitchen','picnic:picnic-hill-mat']) {
    await a.locator('canvas').first().focus(); await a.keyboard.press('m'); const marker=a.locator(`[data-map-destination="${id}"]`);await marker.waitFor();
    const box=await marker.boundingBox();check(box.x>=0&&box.y>=0&&box.x+box.width<=1366&&box.y+box.height<=768,`${id} remains visible on the atlas`);
    await marker.click();await a.waitForFunction(id=>e.picnicContext?.id===id.split(':')[1],id);check(true,`Atlas travel reaches the Worker-approved ${id} arrival`);
   }
   await a.keyboard.press(',');await a.getByLabel('Language',{exact:true}).selectOption('ja');await a.keyboard.press('Escape');
   await move(a,113,-75);await a.keyboard.press('e');await a.getByRole('heading',{name:'料理を作る',exact:true}).waitFor();
   for(const [width,height] of viewports.slice(2)){await a.setViewportSize({width,height});await geometry(a,`Japanese kitchen at ${width}×${height}`);if(width<height)await a.screenshot({path:path.join(output,`kitchen-japanese-${width}x${height}.png`)});}
   check(await a.getByText('料理を選んでください。各料理は3人分です。',{exact:true}).isVisible(),'Japanese kitchen copy states the recipe action and serving count');
   await a.setViewportSize({width:810,height:1080});await a.waitForTimeout(200);await a.screenshot({path:path.join(output,'kitchen-japanese.png')});
   await a.keyboard.press('Escape');await a.locator('canvas').first().focus();await a.keyboard.press('m');await a.locator('[data-map-destination="kitchen:farm-kitchen"]').waitFor();
   check(await a.locator('[data-map-destination="mood"]').count()===0&&await a.getByRole('button',{name:'お茶の庭',exact:true}).count()===0&&await a.locator('[data-map-destination="garden"]').count()===1,'The Japanese atlas excludes Tea garden and retains Kitchen garden and the cooking kitchen');await a.keyboard.press('Escape');
   check(errors.length===0,'Final menus and accepted map travel produce no page errors');
   fs.writeFileSync(path.join(output,'ui-final.json'),JSON.stringify({checks,errors,limits:'Final static export, real Worker, injected ingredients/clock/initial positions. iPad CSS viewports, not native or physical devices.'},null,2));return;
  }
  await sit(a);check(true,'First browser takes a real shared picnic cushion'); const pages=[a];
  for(let i=0;i<4;i++) { const page=await join(i===1); pages.push(page); await move(page,matX,matZ); await page.waitForFunction(()=>e.sharedActors.picnic.dishes.length===1); if(i===0) await sit(page,0,true);await sit(page);check(true,`Browser ${i+2} takes another accepted picnic cushion`); }
  const seats=await Promise.all(pages.map(page=>page.evaluate(()=>({index:e.seatedIndex,pose:e.player.position.toArray(),yaw:e.yaw,facing:e.seatedBench.facing,heading:e.player.rotation.y,view:e.camera.getWorldDirection(e.temp).toArray()}))));
  fs.writeFileSync(path.join(output,'seated-poses.json'),JSON.stringify(seats,null,2));
  check(new Set(seats.map(seat=>seat.index)).size===5&&seats.every(seat=>Math.abs(seat.yaw-seat.facing)<.001),'Five real browsers reserve five distinct cushions facing the village');
  check(seats.every(seat=>Math.sin(seat.heading)>.9&&Math.cos(seat.heading)>0&&seat.view[0]>.7&&seat.view[2]>0),'Both the seated characters and the ordinary camera face the village below');
  check(seats.every((seat,i)=>seats.every((other,j)=>i===j||Math.hypot(seat.pose[0]-other.pose[0],seat.pose[2]-other.pose[2])>.85)),'The five seated visitors occupy separate cushion positions');
  const [,b,c,d,fifth]=pages;
  const share=a.locator('button[aria-keyshortcuts="F"]').filter({hasText:'Share & eat'});
  check(await share.isVisible()&&await share.locator('kbd').textContent()==='F','The seated Share & eat control includes a visible implemented F keycap');
  await a.locator('canvas').first().focus();await a.keyboard.press('f');await a.getByRole('heading',{name:'Picnic basket',exact:true}).waitFor();
  check(true,'F opens the picnic basket while seated');await a.keyboard.press('Escape');await a.waitForFunction(()=>!e.blocked);
  check(await a.evaluate(()=>e.seatedBench?.id==='picnic-hill-mat'),'Escape closes the basket while preserving its accepted cushion');
  await a.waitForTimeout(300);await a.locator('canvas').first().focus();await a.keyboard.press('Escape');await a.waitForFunction(()=>!e.seatedBench);check(true,'The next world Escape stands up after the basket has closed');await sit(a);
  await a.screenshot({path:path.join(output,'five-cushions.png')});
  await basket(c);for(const [width,height] of viewports.slice(2)){await c.setViewportSize({width,height});await geometry(c,`Touch picnic basket at ${width}×${height}`);}await c.screenshot({path:path.join(output,'picnic-ipad.png')});await c.keyboard.press('Escape');await c.waitForFunction(()=>!e.blocked);check(await c.evaluate(()=>e.seatedBench?.id==='picnic-hill-mat'),'Closing the touch basket keeps the same accepted picnic seat');await c.setViewportSize({width:1366,height:768});
  const point=await dishPoint(b); await b.mouse.move(point.x,point.y);await b.mouse.down();await b.mouse.move(point.x+30,point.y+20,{steps:4});await b.mouse.up();await b.waitForTimeout(220);
  check(await b.evaluate(()=>e.sharedActors.picnic.dishes[0]?.portions===3),'Dragging to look from food does not consume a portion');
  // Re-align the ordinary seated camera after the drag before aiming at the dish again.
  await b.evaluate(()=>{e.yaw=e.seatedBench.facing;e.pitch=.4;});await b.waitForTimeout(220);
  const click=await dishPoint(b);await b.mouse.click(click.x,click.y);await portions(pages,2);
  check(await dialog(b).count()===0,'Clicking actual food eats a portion without opening a menu; all clients see two portions');
  const eaterId=await b.evaluate(()=>e.sharedSelfId), acceptedAt=await b.evaluate(()=>e.sharedActors.picnic.bites.find(bite=>bite.visitor===e.sharedSelfId).at);
  await a.bringToFront();
  await a.waitForFunction(id=>{const bite=e.sharedActors.picnic.bites.find(bite=>bite.visitor===id),remote=e.remoteVisitors.get(id);return bite&&remote&&e.getSharedNow()-bite.at<1600&&remote.spirit.rotation.x<-.09;},eaterId);
  check(await a.evaluate(({id,at})=>e.sharedActors.picnic.bites.find(bite=>bite.visitor===id)?.at===at,{id:eaterId,at:acceptedAt}),'Another real client renders the accepted eater pose using the same shared bite clock');
  await a.waitForFunction(id=>e.mealFeedback.hearts.get(id)?.visible,eaterId);
  check(await a.evaluate(id=>e.getSharedNow()-e.sharedActors.picnic.bites.find(bite=>bite.visitor===id).at>=1600,eaterId),'A heart appears over the eater after the shared eating animation');
  await a.screenshot({path:path.join(output,'shared-meal-heart.png')});
  const tap=await dishPoint(c);await c.touchscreen.tap(tap.x,tap.y);await portions(pages,1);
  check(await dialog(c).count()===0,'A direct touch tap on actual mat food eats the next shared portion without a menu');
  await d.locator('canvas').first().focus();await d.keyboard.press('e');await portions(pages,0);
  check(await dialog(d).count()===0&&await a.evaluate(()=>e.picnicScene.food.size===0),'E eats while seated and the final dish disappears in all five browsers');
  const fifthId=await fifth.evaluate(()=>e.sharedSelfId);await fifth.context().close(); await a.waitForFunction(id=>!e.remoteVisitors.has(id),fifthId);check(true,'Closing a real browser releases its shared picnic presence');
  await a.getByRole('button',{name:'Stand up',exact:true}).click();await a.waitForFunction(()=>!e.seatedBench);check(true,'Standing releases the local accepted cushion');
  await a.reload();await attach(a);
  check(JSON.parse(await a.evaluate(()=>localStorage.getItem('cosy.village.inventory.v1'))).inventory.carrots===9,'Reload retains the accepted ingredient spend and empty packed-food basket');
  await move(a,matX,matZ);await sit(a);check(true,'A reconnected browser can reclaim a released picnic cushion');
  await b.getByRole('button',{name:'Stand up',exact:true}).click();await b.waitForFunction(()=>!e.seatedBench);await b.locator('canvas').first().focus();await b.keyboard.press('Escape');
  await enterFocus(b);await c.getByRole('button',{name:'Stand up',exact:true}).click();await c.waitForFunction(()=>!e.seatedBench);await enterFocus(c);
  check(await b.evaluate(()=>e.currentPlace==='focus'&&[...e.remoteVisitors.values()].every(visitor=>!visitor.group.visible))&&await c.evaluate(()=>e.currentPlace==='focus'&&[...e.remoteVisitors.values()].every(visitor=>!visitor.group.visible)),'Two simultaneous private focus interiors hide other visitors independently');
  await b.getByRole('button',{name:'Begin',exact:true}).click();await c.getByRole('button',{name:'Begin',exact:true}).click();await b.getByRole('button',{name:'Pause',exact:true}).click();
  check(await b.getByRole('button',{name:/Begin|Resume/,exact:true}).isVisible()&&await c.getByRole('button',{name:'Pause',exact:true}).isVisible(),'Pausing one private focus session leaves the other running');
  check(await b.locator('.v-picnic-near,.v-cooking-hud').count()===0&&await c.locator('.v-picnic-near,.v-cooking-hud').count()===0,'Private focus does not expose outdoor picnic actions');
  check(errors.length===0,'No page errors in the five-client cooking, picnic, reload and private-focus flow');
  fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify({checks,errors,limits:'Local static export and real SQLite Worker with test-only ingredient grants, accelerated clocks and initial positioning. Real mesh pointer/touch input and five browser clients. CSS/touch-capability viewports, not physical iPad acceptance.'},null,2));
 } catch(error) {
  for(let i=0;i<contexts.length;i++) for(const page of contexts[i].pages()) {
   const state=await page.evaluate(()=>({self:window.e?.sharedSelfId,connected:window.e?.sharedConnected,blocked:window.e?.blocked,context:window.e?.picnicContext,bench:window.e?.seatedBench?.id,seat:window.e?.seatedIndex,pose:window.e?.player?.position.toArray(),text:document.body.innerText})).catch(()=>null);
   fs.writeFileSync(path.join(output,`browser-failure-${i}.json`),JSON.stringify(state,null,2));
   await page.screenshot({path:path.join(output,`browser-failure-${i}.png`),timeout:5000}).catch(()=>{});
  }
  throw error;
 } finally { await browser.close(); }
};
