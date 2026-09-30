// Actual React controls on an isolated static export; engine access remains test-only.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const output=process.env.OUTPUT_DIR||'/tmp/cosy-cottage-ui';fs.mkdirSync(output,{recursive:true});
  const errors=[],warnings=[],checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&/GL_INVALID|shader|sampler/i.test(m.text()))warnings.push(m.text())});
    await page.addInitScript(()=>localStorage.setItem('cosy-village-preferences',JSON.stringify({quality:'high',weather:'golden',weatherMode:'manual',language:'en'})));
    await page.goto(process.env.VILLAGE_URL||'http://127.0.0.1:3085');
    await page.getByRole('button',{name:'Enter Hearthwillow',exact:true}).click();
    await page.waitForFunction(()=>{
      for(let el=document.querySelector('canvas');el;el=el.parentElement)for(let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const e=h.memoizedState?.current;if(e?.petCottageCat&&e.world){window.cottageUIEngine=e;return true}}
      return false;
    },{timeout:90000});
    await page.getByRole('button',{name:'Places',exact:true}).click();
    await page.getByRole('button',{name:/Focus cottage/}).click();
    await page.locator('.v-focus').waitFor();await page.waitForTimeout(300);
    for(const [width,height] of [[1280,720],[1366,768],[1024,640]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(250);
      const result=await page.evaluate(()=>{
        const e=cottageUIEngine,cat=e.cottageCat;cat.begin('nap',1000);cat.root.position.copy(cat.bed);cat.root.rotation.y=-.85;
        const p=cat.root.getWorldPosition(e.temp).add({x:0,y:.35,z:0}).project(e.camera);
        const rect=document.querySelector('.v-focus').getBoundingClientRect();
        return {rect:{x:rect.x,y:rect.y,w:rect.width,h:rect.height},point:{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2},background:getComputedStyle(document.querySelector('.v-focus')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      const r=result.rect,p=result.point;
      check(r.w<=320.5&&r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height,`${width} × ${height}: compact timer fits`);
      check(p.x>25&&p.x<r.x-35&&p.y>120&&p.y<height-60,`${width} × ${height}: napping cat stays clear of the timer and screen edges`);
      check(result.background.includes('0.78')&&!result.overflow,`${width} × ${height}: timer is translucent without overflow`);
    }
    await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(300);
    await page.screenshot({path:path.join(output,'cottage-ui-nap.png')});
    await page.evaluate(()=>{const c=cottageUIEngine.cottageCat;c.root.position.copy(c.desk);c.root.rotation.y=-.7;c.begin('ask',1000)});
    const pet=page.getByRole('button',{name:'Pet the cat',exact:true});await pet.waitFor();
    const bounds=await pet.boundingBox();check(bounds.height>=44&&await pet.locator('kbd').isVisible(),'Pet button has a square E keycap and 44 px target');
    await pet.click();check(await page.evaluate(()=>cottageUIEngine.cottageCat.petting&&document.activeElement===cottageUIEngine.renderer.domElement),'Click starts petting and returns canvas focus');
    check(await page.getByRole('button',{name:'Petting…',exact:true}).isDisabled(),'Active pet button is disabled');
    await page.waitForTimeout(3300);
    await page.keyboard.down('e');
    check(await page.evaluate(()=>cottageUIEngine.cottageCat.petting),'Actual E starts the same pet action');
    check(await page.locator('.v-cottage-cat button').evaluate(b=>b.getAnimations().length>0),'E produces immediate button press feedback');await page.keyboard.up('e');
    await page.screenshot({path:path.join(output,'cottage-ui-pet.png')});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(3500);
    await page.evaluate(()=>{const c=cottageUIEngine.cottageCat;c.begin('nap',1000);c.root.position.copy(c.bed);c.root.rotation.y=-.85});
    const before=await page.evaluate(()=>cottageUIEngine.cottageCat.root.position.toArray());await page.waitForTimeout(400);
    check(JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>cottageUIEngine.cottageCat.root.position.toArray())),'Reduced nap stays still');
    await page.getByRole('button',{name:'Back to village',exact:true}).click();
    check(await page.locator('.v-cottage-cat').count()===0&&await page.evaluate(()=>!cottageUIEngine.cottageCat.active),'Exit removes the pet control and pauses the cat');
    check(errors.length===0&&warnings.length===0,'No page errors or WebGL shader/sampler warnings');
    fs.writeFileSync(path.join(output,'ui-checks.json'),JSON.stringify({checks,errors,warnings},null,2));console.log(`${checks.length} cottage UI checks passed`);
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
