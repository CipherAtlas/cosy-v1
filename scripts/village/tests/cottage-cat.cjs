// Cat routine, private activity lifecycle and the actual engine's E boundary.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'warning' && /GL_INVALID|shader|sampler/i.test(m.text())) warnings.push(m.text()); });
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-cottage-cat'; fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:3083');
    const results = await page.evaluate(async cueOnly => {
      const T = await import('three');
      const { VillageEngine } = await import('/modules/features/village/VillageEngine.js');
      document.body.innerHTML = '<div id="host" style="position:fixed;inset:0"></div>';
      const states = [], checks = [], check = (valid, label) => { if (!valid) throw Error(label); checks.push(label); };
      const e = new VillageEngine(document.querySelector('#host'), { progress() {}, ready() {}, near() {}, interact() {},
        error: console.error, stats() {}, movement() {}, contact() {}, environment() {}, cottageCat: s => states.push(s) });
      window.cottageTestEngine = e;
      await e.load(); e.setQuality('high'); e.setPlace('focus');
      await new Promise(r => setTimeout(r, 1200)); e.renderer.setAnimationLoop(null);
      const cat = e.cottageCat;
      if (cueOnly) {
        e.setBlocked(false); cat.root.position.copy(cat.desk); cat.begin('ask', 30); cat.update(0, 0, false);
        const visible = () => cat.dialogueCues.filter(cue => cue.visible);
        const anchored = model => {
          const target = model.head.getWorldPosition(new T.Vector3()); target.y += .18;
          return model.dialogueCues.filter(cue => cue.visible).every(cue => cue.position.distanceTo(target) < 1e-8);
        };
        check(visible().length === 1 && visible()[0].text.en === 'Mrrp~ (A little company~)' && visible()[0].text.ja.length > 0, 'Private cat invitation has one bilingual dialogue cue');
        check(anchored(cat), 'Native cat cue anchors to the actual animated head plus18cm');
        cat.update(2.99, 2.99, false); check(visible().length === 1, 'Invitation cue lasts through the first2.99seconds');
        cat.update(.02, 3.01, false); check(visible().length === 0, 'Invitation cue hides after3seconds without ending its pet invitation');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
        check(cat.state === 'pet' && visible().length === 1 && visible()[0].text.en === 'Purr purr~ (That feels lovely~)', 'Real private E action shows the purr dialogue cue');
        cat.update(3.19, 6.2, false); check(visible().length === 1 && anchored(cat), 'Pet dialogue follows the animated head through3.19seconds');
        cat.update(.02, 6.22, false); check(cat.state === 'ask' && !cat.dialogueCues[0].visible, 'Purr cue ends with the existing3.2second pet state');
        e.setPlace(null); const age = cat.age; cat.update(10, 16.22, false);
        check(cat.dialogueCues.every(cue => !cue.visible) && cat.age === age && !e.petCottageCat(), 'Leaving the private room hides both cues and preserves the outdoor pet boundary');
        e.setPlace('focus'); cat.begin('rest', 1); cat.update(.1, 16.32, true);
        check(cat.state === 'ask' && visible().length === 1 && anchored(cat), 'Reduced motion refreshes the still invitation cue and head anchor');
        check(e.petCottageCat(), 'Reduced private pet uses the same click action');
        cat.update(.1, 16.42, true);
        check(cat.dialogueCues[0].visible && anchored(cat), 'Reduced private pet keeps its purr cue at the still head');
        const { CottageCat } = await import('/modules/features/village/cottageCat.js');
        const legacyModel = new T.Group(), parent = new T.Group(); parent.position.set(5, 2, -3); parent.rotation.y = .4; parent.scale.setScalar(1.3); parent.add(legacyModel);
        for (const name of ['CatBody', 'CatHead', 'CatTail', 'CatFrontLeft', 'CatFrontRight', 'CatBackLeft', 'CatBackRight', 'CatEyeLeft', 'CatEyeRight']) {
          const part = new T.Group(); part.name = name; if (name === 'CatHead') part.position.set(0, .6, .25); legacyModel.add(part);
        }
        const legacy = new CottageCat(legacyModel, () => {}); legacy.enter(true); legacy.begin('ask', 30); legacy.update(.1, .1, false);
        check(legacy.dialogueCues[1].visible && anchored(legacy), 'Legacy cat cue uses the actual head through parent rotation and scale');
        legacy.dispose(); check(legacy.dialogueCues.every(cue => !cue.visible), 'Cat disposal hides retained dialogue cues');
        cat.root.updateMatrixWorld(true); e.renderer.render(e.scene, e.camera);
        return { checks, transformSamples: 0, states: ['ask', 'pet'], visits: cat.visits, naps: cat.naps };
      }
      check(cat.state === 'nap', 'Cat starts with a nap on the cushion');
      check(e.indoor.children.filter(o => o.isMesh && o.geometry.attributes.position.count > 100).length > 10, 'Static room batches survive mixed rounded/indexed geometry');
      const box = new T.Box3().setFromObject(cat.root), corners = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new T.Vector3(x,y,z).project(e.camera));
      check(corners.every(p => Math.abs(p.x) < .95 && Math.abs(p.y) < .94 && p.z < 1), 'Whole sleeping cat fits the default laptop camera');
      const napAge = cat.age; e.setPlace(null); cat.update(30, 30, false);
      check(cat.age === napAge, 'Routine pauses outside the private cottage');
      check(!e.petCottageCat(), 'Outdoor E cannot pet the cottage cat'); e.setPlace('focus');
      const seen = new Set([cat.state]); let seed = 831, time = 0, minY = 10, maxY = 0, onDesk = false;
      cat.random = () => ((seed = Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296;
      for (let i = 0; i < 6000; i++) {
        time += .1; cat.update(.1, time, false); seen.add(cat.state);
        minY = Math.min(minY, cat.root.position.y); maxY = Math.max(maxY, cat.root.position.y);
        check(Number.isFinite(cat.root.position.lengthSq()), 'Finite cat transform');
        if (!onDesk && cat.state === 'ask') {
          onDesk = true;
          check(cat.root.position.distanceTo(cat.desk) < .001, 'Invitation occurs on the desk');
          const input = document.createElement('input'); document.body.append(input); input.focus();
          input.dispatchEvent(new KeyboardEvent('keydown', { key:'e', bubbles:true }));
          check(cat.state === 'ask', 'Typing E in a field leaves the cat waiting'); input.remove();
          window.dispatchEvent(new KeyboardEvent('keydown', { key:'e', ctrlKey:true }));
          window.dispatchEvent(new KeyboardEvent('keydown', { key:'e', repeat:true }));
          check(cat.state === 'ask', 'Modifiers and held E do not trigger petting');
          e.setBlocked(true); window.dispatchEvent(new KeyboardEvent('keydown', { key:'e' }));
          check(cat.state === 'ask', 'Menus block cat petting'); e.setBlocked(false);
          window.dispatchEvent(new KeyboardEvent('keydown', { key:'e' }));
          check(cat.state === 'pet' && states.at(-1) === 'petting', 'Real engine E starts the pet animation');
          check(!e.petCottageCat(), 'Repeated pets are refused while petting');
        }
      }
      for (const state of ['nap','rest','walk','stretch','up','ask','pet','down']) check(seen.has(state), `Routine reaches ${state}`);
      check(minY >= 0 && maxY > 1.08 && maxY < 1.6, 'Jumps clear the tabletop without falling below the floor');
      check(cat.naps > 1 && cat.visits > 1, 'Cat returns to naps and desk visits');
      cat.begin('rest', 1); cat.update(.1,time,true);
      check(cat.state === 'ask' && cat.root.position.distanceTo(cat.desk) < .001, 'Reduced motion offers a still desk invitation');
      check(e.petCottageCat(), 'Click method starts the same pet action');
      cat.update(4,time,true); check(cat.state === 'ask', 'Reduced pet action returns to its invitation');
      cat.update(31,time,true); check(cat.state === 'nap', 'Reduced motion retains still naps');
      const position = cat.root.position.clone(), rotation = cat.root.quaternion.clone(); cat.update(1,time+1,true);
      check(position.equals(cat.root.position) && rotation.equals(cat.root.quaternion), 'Reduced nap does not move the cat');
      cat.root.updateMatrixWorld(true); e.renderer.render(e.scene,e.camera);
      return { checks: checks.filter(label => label !== 'Finite cat transform'), transformSamples: 6000, states:[...seen], visits:cat.visits, naps:cat.naps, minY,maxY };
    }, process.env.CAT_CUES_ONLY === '1');
    await page.screenshot({ path:path.join(output,'cottage-nap.png') });
    if (errors.length || warnings.length) throw Error(JSON.stringify({errors,warnings:warnings.slice(0,2)}));
    fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({...results,errors,warnings},null,2));
    console.log(`${results.checks.length} cottage checks and ${results.transformSamples} transform samples passed`);
    await page.evaluate(() => cottageTestEngine.dispose());
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
