// Run against scripts/village/preview_qa.py; use an existing Playwright install via PLAYWRIGHT_PATH.
const { chromium, firefox, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
(async () => {
 const kind=process.argv[2]||'chrome';
 const opts={headless:process.env.HEADED!=='1'};
 if(kind==='chrome')opts.channel='chrome';
 if(kind==='edge')opts.channel='msedge';
 if(process.env.BROWSER_EXECUTABLE)opts.executablePath=process.env.BROWSER_EXECUTABLE;

 if(process.env.SOFTWARE)opts.args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
 const browser=await (kind==='firefox'?firefox:kind==='webkit'?webkit:chromium).launch(opts);
 try {
 const page=await browser.newPage({viewport:{width:Number(process.env.WIDTH||1920),height:Number(process.env.HEIGHT||1080)},deviceScaleFactor:1});
 if(process.env.NO_MULTI_DRAW)await page.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.getExtension;WebGL2RenderingContext.prototype.getExtension=function(name){return name==='WEBGL_multi_draw'?null:original.call(this,name)}});
 const errors=[];page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404 (File not found)'))errors.push(m.text())});
 if(process.env.STOCK_SHADOW)await page.route('**/modules/features/village/shadows.js',route=>route.fulfill({contentType:'text/javascript',body:'export function softenShadowEdges(){}'}));
 await page.goto(process.env.URL||'http://127.0.0.1:3011/');
 await page.evaluate(async()=>{
  const {VillageEngine}=await import('/modules/features/village/VillageEngine.js');
  document.body.innerHTML='<div id="scene" style="width:100vw;height:100vh"></div>';
  const noop=()=>{}; window.engine=new VillageEngine(document.querySelector('#scene'),{progress:noop,ready:noop,near:noop,interact:noop,error:console.error,stats:noop,movement:noop,contact:noop,environment:noop});
  const loadStart=performance.now();await engine.load();window.loadMs=performance.now()-loadStart;engine.setBlocked(true);engine.setQuality('high');
  window.gpu=[];const gl=engine.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(ext){const render=engine.renderer.render.bind(engine.renderer),pending=[];
   engine.renderer.render=(...args)=>{
    while(pending.length && gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
     const query=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);
    }
    if(pending.length>8)return render(...args);
    const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);render(...args);gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(query);
   };
  }
  const original=engine.frame.bind(engine);window.cpu=[];engine.frame=t=>{const start=performance.now();original(t);cpu.push(performance.now()-start)};
 });
 if(process.env.FARM_STATE){const state=JSON.parse(fs.readFileSync(process.env.FARM_STATE,'utf8'));await page.evaluate(state=>{
  engine.townScene.applyShared({beds:state.beds,owlFeedAt:null,owlOwner:null,owlUntil:0,harvest:{carrot:0,radish:0,mint:0},hayFeeds:[],race:null,rival:null,animals:[]},state.now);
 },state);}
 let checks;
 if(process.env.CHECKS){checks=await page.evaluate(async()=>{engine.renderer.setAnimationLoop(null);engine.setBlocked(false);try{
  const tests=await import('/graphics-tests.js');
  const graphics=tests.checkGraphics(engine),movingShadows=tests.checkMovingShadows(engine);
  const {loadTownAssetKit,townAssets,TOWN_ASSET_IDS}=await import('/modules/features/village/townAssets.js');
  const assets=townAssets(await loadTownAssetKit());
  const catalog=TOWN_ASSET_IDS.map(id=>{if(!assets.has(id))throw Error(`Town/editor asset missing: ${id}`);return id});
  return {graphics,movingShadows,catalog};
 }finally{engine.setBlocked(true);engine.renderer.setAnimationLoop(t=>engine.frame(t))}});console.log(JSON.stringify({checks}));}
 const env=await page.evaluate(()=>{const gl=engine.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {ua:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),antialias:gl.getContextAttributes().antialias,timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),multiDraw:!!gl.getExtension('WEBGL_multi_draw')}});
 const results=[];
 const cases=process.env.CASES?process.env.CASES.split(','):['high','low'];
 for(const view of (process.env.VIEWS||'entry').split(',')) for(const variant of cases){
  await page.evaluate(view=>{
   const views={entry:[.3,20,0,.25],pond:[-22,-3,.4,.28],pasture:[-47,-50,0,.25],stable:[25,-66,0,.25],orchard:[14,-26,0,.25],overhead:[.3,20,0,1.1],picnic:[-96,-20,-Math.PI/2,.15]};
   if(!views[view])throw Error(`Unknown profile view: ${view}`);
   engine.movement.settle(...views[view].slice(0,2));engine.yaw=views[view][2];engine.pitch=views[view][3];
  },view);
  await page.evaluate(v=>{engine.setQuality(v==='high'?'high':v==='auto'?'auto':'low');engine.qualityChangedAt=performance.now()+60000;engine.atmosphere.sky.visible=v!=='low-no-sky';if(v==='low-no-shadows')engine.renderer.shadowMap.enabled=false;},variant);
  await page.waitForTimeout(2000);
  const sample=await page.evaluate(async()=>{
   const deltas=[],draws=[],tris=[];cpu.length=0;gpu.length=0;let prev;
   await new Promise(resolve=>{const start=performance.now();function tick(t){if(prev!==undefined){deltas.push(t-prev);draws.push(engine.renderer.info.render.calls);tris.push(engine.renderer.info.render.triangles)}prev=t;if(t-start<6000)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});
   const summary=a=>{a.sort((x,y)=>x-y);return {mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a[Math.floor(a.length*.95)],min:a[0],max:a.at(-1)}};
   return {frame:summary(deltas),cpu:summary(cpu),gpu:gpu.length?summary(gpu):null,draws:summary(draws),triangles:summary(tris),buffer:[engine.renderer.domElement.width,engine.renderer.domElement.height],quality:engine.quality,shadows:engine.renderer.shadowMap.enabled};
  });
  const submissions=await page.evaluate(()=>{
   const renderer=engine.renderer,direct=renderer.renderBufferDirect,draws=[];
   renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){
    const before=renderer.info.render.triangles;direct.call(this,camera,scene,geometry,material,object,group);
    const triangles=renderer.info.render.triangles-before;
    if(triangles){const path=[];for(let parent=object;parent;parent=parent.parent)if(parent.name)path.unshift(parent.name);
     draws.push({name:path.join('/')||object.type,material:material.name||material.type,pass:scene===null?'shadow':'color',triangles,instances:object.isInstancedMesh?object.count:1});}
   };
   try{renderer.shadowMap.needsUpdate=true;renderer.render(engine.scene,engine.camera)}finally{renderer.renderBufferDirect=direct}
   const groups={};for(const draw of draws){const key=draw.name.split('/')[0];groups[key]??={draws:0,triangles:0};groups[key].draws++;groups[key].triangles+=draw.triangles;}
   return {color:draws.filter(d=>d.pass==='color').reduce((n,d)=>n+d.triangles,0),shadow:draws.filter(d=>d.pass==='shadow').reduce((n,d)=>n+d.triangles,0),groups,largest:draws.sort((a,b)=>b.triangles-a.triangles).slice(0,30)};
  });
  results.push({view,variant,...sample,submissions});console.log(JSON.stringify({browser:kind,view,variant,...sample,color:submissions.color,shadow:submissions.shadow}));
  if(process.env.CAPTURE_DIR){fs.mkdirSync(process.env.CAPTURE_DIR,{recursive:true});await page.screenshot({path:`${process.env.CAPTURE_DIR}/${view}-${variant}.png`});}
 }
 const meshes=await page.evaluate(()=>{const list=[];engine.scene.traverse(o=>{if(o.isMesh&&o.visible){const n=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;list.push({name:o.name,type:o.type,triangles:n*(o.isInstancedMesh?o.count:1),instances:o.count,cast:o.castShadow,receive:o.receiveShadow})}});return list.sort((a,b)=>b.triangles-a.triangles).slice(0,20)});
 const loading=await page.evaluate(()=>({engineMs:loadMs,resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('/village/')).map(r=>({url:new URL(r.name).pathname,bytes:r.encodedBodySize,ms:r.duration}))}));
 const output={browser:kind,version:browser.version(),env,loading,checks,results,meshes,errors};fs.writeFileSync(process.env.OUTPUT || require('path').join(require('os').tmpdir(), `cosy-${kind}-profile.json`),JSON.stringify(output,null,2));console.log(JSON.stringify({env,errors}));if(errors.length || (process.env.MIN_FPS && results.some(r=>1000/r.frame.mean<Number(process.env.MIN_FPS))))process.exitCode=1;if(process.env.SCREENSHOT)await page.screenshot({path:process.env.SCREENSHOT});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
