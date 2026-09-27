// Uses the local-only preview_qa.py harness and an existing Playwright installation.
const { chromium, firefox } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const kind = process.argv[2] || 'chrome', output = process.env.OUTPUT_DIR || '/tmp/cosy-birds';
  fs.mkdirSync(output, { recursive: true });
  const browser = await (kind === 'firefox' ? firefox : chromium).launch({ headless: true, ...(kind === 'chrome' ? { channel: 'chrome' } : {}), ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE}:{}) });
  const page = await browser.newPage({ viewport: kind === 'firefox' ? null : { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3045/');
    const result = await page.evaluate(async () => {
      const T = await import('three'), { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      const { freshGarden, gardenAction, readGarden } = await import('/modules/features/village/garden.js');
      const { PLACES } = await import('/modules/features/village/places.js');
      const { BIRD_CLEARING, pondDistance } = await import('/modules/features/village/environment.js');
      document.body.innerHTML = '<div class="village"><div id="scene" style="position:fixed;inset:0"></div></div>';
      const noop=()=>{}, statuses=[], feeds=[];
      const e = window.engine = new VillageEngine(document.querySelector('#scene'), {
        progress:noop,ready:noop,near:noop,interact:noop,movement:noop,contact:noop,environment:noop,error:m=>{throw Error(m)},stats:noop,
        birds:s=>statuses.push(s),gardenSound:(s,p)=>feeds.push([s,p]),crumbs:id=>{e.setGarden(gardenAction(e.gardenState,{kind:id==='wren'?'birdCrumbs':'crumbs'}));},
      });
      await e.load(); e.setQuality('low'); e.setBlocked(false); e.renderer.setAnimationLoop(null);
      const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
      const flock=e.birds,life=e.life,cam=e.camera,far=new T.Vector3(0,0,30),near=new T.Vector3(-37,0,6);
      const tick=(seconds,caretaker=false,player=far,reduced=false)=>{for(let i=0;i<Math.round(seconds*60);i++)flock.update(1/60,i/60,reduced,cam,player,caretaker,true);};
      check(flock.birds.length===12 && flock.parts.length===4,'Twelve Blender doves use four instanced mesh draws');
      check(life.residents.length===5 && life.residents[4].root.name==='Wren','Wren joins the four existing residents');
      check(life.caretakerPresent,'Wren starts at her clearing');
      check(e.movement.clear(-33.5,4),'Clearing arrival and exit are collision-free');
      const approach = new T.CatmullRomCurve3([[-18.4,-5.5],[-16.55,-5.5],[-16.55,-8.7],[-17.15,-13],[-17.8,-20],[-19,-26],[-21.2,-29]].map(([x,z])=>new T.Vector3(x,0,z)));
      for(let i=0;i<=200;i++) {
        const p=approach.getPoint(i/200);
        const tangent=approach.getTangent(i/200);
        for(const side of [-.25,0,.25]) check(e.movement.clear(p.x+tangent.z*side,p.z-tangent.x*side),'Northern rest-area approach clear '+i+' offset '+side);
      }
      check(flock.birds.every(b=>pondDistance(b.landing.x,b.landing.z)>1 && e.movement.clear(b.landing.x,b.landing.z)),'All landing spots are on clear dry ground');
      check(!e.gardenAction({kind:'feedBirds'}),'Cannot feed without a crumb pouch');
      const before=freshGarden();before.carrots=7;before.mintTea=2;
      const saved=readGarden(JSON.stringify(gardenAction(before,{kind:'birdCrumbs'})));
      check(saved.crumbPouch&&saved.carrots===7&&saved.mintTea===2&&saved.beds.length===before.beds.length,'Wren uses the existing saved pouch without changing harvests');
      e.setPlace(null);e.movement.settle(-36.5,1);e.player.position.set(-36.5,0,1);
      cam.position.set(-34,3,6);cam.lookAt(-38,1,1.5);cam.updateMatrixWorld();
      e.dialogue.update(.1,cam,e.player.position,'golden');
      e.renderer.domElement.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));
      check(e.gardenState.crumbPouch,'F conversation with nearby Wren hands over crumbs');
      e.setGarden(saved);
      check(e.gardenAction({kind:'feedBirds'})&&flock.status==='crumbs','Player can leave crumbs during flight');
      check(!e.gardenAction({kind:'feedBirds'}),'Repeated input cannot restart a queued meal');
      tick(29);check(flock.phase==='flight'&&flock.birds[0].root.position.y>.13,'Birds fly the circuit before landing');
      tick(2);check(flock.phase==='ground'&&flock.status==='eating','Queued crumbs are eaten after the 30-second flight');
      check(!e.gardenAction({kind:'feedBirds'}),'Repeated input cannot restart eating');
      tick(4,false,near);check(flock.status==='happy'&&flock.hearts.visible,'Fed birds celebrate with hearts');
      e.travel('birds');e.frame(performance.now());
      flock.update(0,5,false,cam,near,false,true);e.renderer.render(e.scene,cam);
      check(flock.bubble.textContent==='Coo coo~ (Thank you~)'&&!flock.bubble.hidden,'Exact thank-you speech appears over the flock');
      window.captureBirds=()=>{flock.update(0,5,false,cam,near,false,true);e.renderer.render(e.scene,cam);};
      tick(6);check(flock.phase==='flight'&&!flock.hearts.visible,'Birds take off again after their celebration');
      tick(33,true);check(flock.status==='eating','Wren feeds returning birds autonomously when the player is away');
      tick(10);tick(30,false,near);check(flock.status==='waiting','With Wren away the flock waits for a visitor');
      tick(3,false,near);check(flock.status==='waiting','Birds are not fed by an absent caretaker');
      e.gardenAction({kind:'feedBirds'});tick(4.1,false,near,true);
      check(flock.hearts.visible&&flock.birds.every(b=>b.head.rotation.x===0&&b.root.rotation.z===0),'Reduced motion keeps still hearts and suppresses pecking and wobble');
      e.setLanguage('ja');flock.update(0,5,true,cam,near,false,true);
      check(flock.bubble.textContent==='クークー〜（ありがとう〜）','Bird thanks are translated');e.setLanguage('en');
      life.setCompanions(['wren']);check(!life.caretakerPresent,'Inviting Wren pauses her feeding job');
      for(const p of PLACES){life.setActivity(p.id);life.update(.016,40,near,false,false,cam.quaternion);check(life.residents.every(r=>Number.isFinite(r.root.position.x)),'Five-resident staging is valid at '+p.id);}
      life.setCompanions([]);life.setActivity(null);const wren=life.residents[4];wren.returning=false;wren.movement.settle(-38,1.5);wren.root.position.set(-38,.1,1.5);
      e.travel('birds');e.frame(performance.now());flock.update(0,5,false,cam,near,false,true);e.renderer.render(e.scene,cam);
      return { checks, statuses, fedEvents:feeds.length, parts:flock.parts.map(p=>p.mesh.name), errors:[] };
    });
    await page.screenshot({ path:path.join(output,`clearing-${kind}.png`) });
    await page.evaluate(()=>{const e=engine;e.camera.position.set(-34.5,1.5,6.2);e.camera.lookAt(-37,.55,4);e.camera.updateMatrixWorld();captureBirds();});
    await page.screenshot({path:path.join(output,`doves-${kind}.png`)});
    result.errors=errors;fs.writeFileSync(path.join(output,`checks-${kind}.json`),JSON.stringify(result,null,2));
    if(errors.length)throw Error(errors.join('\n'));
    console.log(`${result.checks.length} bird checks passed in ${kind}`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
