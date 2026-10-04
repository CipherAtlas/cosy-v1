// Run against a newly compiled isolated editor; does not edit or apply a layout.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:3049';
const evidence = process.env.HORIZON_EVIDENCE || '/tmp/cosy-horizon-evidence';
fs.mkdirSync(evidence,{recursive:true});
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}}), errors=[];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.cosyStudio,null,{timeout:90000});
  const original = await page.evaluate(() => window.cosyStudio.snapshot());
  const proof = await page.evaluate(async () => {
   const T = await import('/three/build/three.module.js');
   const {createAtmosphere} = await import('/modules/features/village/atmosphere.js');
   const atmosphere=createAtmosphere(),scene=new T.Scene();scene.add(atmosphere.sky);
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,720);renderer.setPixelRatio(1);
   renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
   const diagnostics=[];renderer.debug.onShaderError=(gl,program,vertex,fragment)=>diagnostics.push([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)]);
   const camera=new T.PerspectiveCamera(55,1280/720,.1,1100), images={};
   const pixels=()=>{const p=new Uint8Array(1280*720*4);renderer.getContext().readPixels(0,0,1280,720,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,p);return p;};
   const draw=(yaw,weather,position=new T.Vector3())=>{ camera.position.copy(position);camera.lookAt(position.clone().add(new T.Vector3(Math.sin(yaw),.12,Math.cos(yaw))));atmosphere.setWeather(...weather);atmosphere.update(0,camera.position);renderer.render(scene,camera);return pixels(); };
   const north=draw(0,[0,0,0]);images.day=renderer.domElement.toDataURL();
   const translated=draw(0,[0,0,0],new T.Vector3(250,30,-240));
   let shiftError=0;for(let i=0;i<north.length;i+=4) shiftError+=Math.abs(north[i]-translated[i])+Math.abs(north[i+1]-translated[i+1])+Math.abs(north[i+2]-translated[i+2]);
   shiftError/=1280*720*3;
   const seamA=draw(Math.PI-.000001,[0,0,0]),seamB=draw(-Math.PI+.000001,[0,0,0]);
   let seamError=0;for(let i=0;i<seamA.length;i+=4) seamError+=Math.abs(seamA[i]-seamB[i])+Math.abs(seamA[i+1]-seamB[i+1])+Math.abs(seamA[i+2]-seamB[i+2]);seamError/=1280*720*3;
   for(const [name,weather,yaw] of [['east',[0,0,0],Math.PI/2],['south',[0,0,0],Math.PI],['west',[0,0,0],-Math.PI/2],['dusk',[0,.85,0],0],['rain',[1,0,0],0],['night',[0,0,1],0]]) {draw(yaw,weather);images[name]=renderer.domElement.toDataURL();}
   const draws=renderer.info.render.calls, meshes=scene.children.length;
   camera.position.set(0,0,0);camera.lookAt(0,-1,0);atmosphere.update(0,camera.position);atmosphere.setWeather(0,0,0);renderer.render(scene,camera);const below=pixels();
   const nadir=below[(360*1280+640)*4]+below[(360*1280+640)*4+1]+below[(360*1280+640)*4+2];
   renderer.dispose();renderer.forceContextLoss();return {images,diagnostics,shiftError,seamError,draws,meshes,nadir};
  });
  assert.deepEqual(proof.diagnostics,[]);assert(proof.shiftError<.1);assert(proof.seamError<.1);assert.equal(proof.draws,1);assert.equal(proof.meshes,1);assert(proof.nadir>100);
  for(const [name,data] of Object.entries(proof.images)) fs.writeFileSync(path.join(evidence,`mountains-${name}.png`),Buffer.from(data.split(',')[1],'base64'));
  assert.notEqual(proof.images.day,proof.images.night);assert.notEqual(proof.images.day,proof.images.rain);
  await page.locator('#preview').click();await page.waitForTimeout(500);await page.screenshot({path:path.join(evidence,'blob-horizon-1280.png')});
  const canvas=await page.locator('#viewport > canvas').boundingBox();await page.mouse.move(canvas.width*.55,canvas.height*.5);await page.mouse.down();await page.mouse.move(canvas.width*.55,canvas.height*.5-35,{steps:12});await page.mouse.up();await page.waitForTimeout(300);
  await page.screenshot({path:path.join(evidence,'blob-looking-across.png')});await page.keyboard.press('Escape');
  await page.setViewportSize({width:1024,height:700});await page.locator('#lighting').selectOption('night');await page.locator('#preview').click();await page.waitForTimeout(400);await page.screenshot({path:path.join(evidence,'blob-horizon-night-1024.png')});await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(() => window.cosyStudio.snapshot()),original);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(evidence,'checks.json'),JSON.stringify({shaderErrors:proof.diagnostics,translationPixelError:proof.shiftError,seamPixelError:proof.seamError,skyDraws:proof.draws,skyMeshes:proof.meshes,viewports:[[1280,800],[1024,700]],unchangedLayout:true,pageErrors:errors},null,2)+'\n');
  console.log('PASS all-direction mountain rendering, rain/dusk/night, clean shader compile, seamless azimuth, no translation parallax, one existing sky draw, unchanged layout and laptop blob previews');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
