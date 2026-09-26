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
 const errors=[];page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404 (File not found)'))errors.push(m.text())});
 if(process.env.STOCK_SHADOW)await page.route('**/modules/features/village/shadows.js',route=>route.fulfill({contentType:'text/javascript',body:'export function softenShadowEdges(){}'}));
 await page.goto(process.env.URL||'http://127.0.0.1:3011/');
 await page.evaluate(async()=>{
  const {VillageEngine}=await import('/modules/features/village/VillageEngine.js');
  document.body.innerHTML='<div id="scene" style="width:100vw;height:100vh"></div>';
  const noop=()=>{}; window.engine=new VillageEngine(document.querySelector('#scene'),{progress:noop,ready:noop,near:noop,interact:noop,error:console.error,stats:noop,movement:noop,contact:noop,environment:noop});
  await engine.load();engine.setBlocked(true);engine.setQuality('high');
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
 if(process.env.CHECKS){const checks=await page.evaluate(async()=>{engine.renderer.setAnimationLoop(null);try{return (await import('/graphics-tests.js')).checkGraphics(engine)}finally{engine.renderer.setAnimationLoop(t=>engine.frame(t))}});console.log(JSON.stringify({checks}));}
 const env=await page.evaluate(()=>{const gl=engine.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {ua:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),antialias:gl.getContextAttributes().antialias,timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2')}});
 const results=[];
 const cases=process.env.CASES?process.env.CASES.split(','):['high','low'];
 for(const variant of cases){
  await page.evaluate(v=>{engine.setQuality(v==='high'?'high':v==='auto'?'auto':'low');engine.atmosphere.sky.visible=v!=='low-no-sky';if(v==='low-no-shadows')engine.renderer.shadowMap.enabled=false;},variant);
  await page.waitForTimeout(2000);
  const sample=await page.evaluate(async()=>{
   const deltas=[],draws=[],tris=[];cpu.length=0;gpu.length=0;let prev;
   await new Promise(resolve=>{const start=performance.now();function tick(t){if(prev!==undefined){deltas.push(t-prev);draws.push(engine.renderer.info.render.calls);tris.push(engine.renderer.info.render.triangles)}prev=t;if(t-start<6000)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});
   const summary=a=>{a.sort((x,y)=>x-y);return {mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a[Math.floor(a.length*.95)],min:a[0],max:a.at(-1)}};
   return {frame:summary(deltas),cpu:summary(cpu),gpu:gpu.length?summary(gpu):null,draws:summary(draws),triangles:summary(tris),buffer:[engine.renderer.domElement.width,engine.renderer.domElement.height],quality:engine.quality,shadows:engine.renderer.shadowMap.enabled};
  });results.push({variant,...sample});console.log(JSON.stringify({browser:kind,variant,...sample}));
 }
 const meshes=await page.evaluate(()=>{const list=[];engine.scene.traverse(o=>{if(o.isMesh&&o.visible){const n=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;list.push({name:o.name,type:o.type,triangles:n*(o.isInstancedMesh?o.count:1),instances:o.count,cast:o.castShadow,receive:o.receiveShadow})}});return list.sort((a,b)=>b.triangles-a.triangles).slice(0,20)});
 const output={browser:kind,version:browser.version(),env,results,meshes,errors};fs.writeFileSync(process.env.OUTPUT || require('path').join(require('os').tmpdir(), `cosy-${kind}-profile.json`),JSON.stringify(output,null,2));console.log(JSON.stringify({env,errors}));if(errors.length || (process.env.MIN_FPS && results.some(r=>1000/r.frame.mean<Number(process.env.MIN_FPS))))process.exitCode=1;if(process.env.SCREENSHOT)await page.screenshot({path:process.env.SCREENSHOT});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
