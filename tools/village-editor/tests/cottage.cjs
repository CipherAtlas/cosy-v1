// Run on a separate studio port with --layouts-dir pointing at a temporary directory.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

(async () => {
  const browser = await chromium.launch({ headless:true, channel:'chrome' });
  const url = process.env.EDITOR_URL || 'http://127.0.0.1:3084';
  const ids = ['cottage-cat','cottage-couch','cottage-reading-lamp','cottage-fern','cottage-botanical-print','cottage-cat-cushion','village-window-vista','cottage-writing-chair','cottage-books','cottage-pottery','cottage-book-shelf','cottage-pottery-shelf'];
  const output = process.env.OUTPUT_DIR || '/tmp/cosy-cottage-editor'; fs.mkdirSync(output,{recursive:true});
  const protectedFiles = ['public/village/world-layout.json','tools/village-editor/presets/current-village.json','tools/village-editor/presets/original-village.json'];
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../..',file))).digest('hex');
  const before = protectedFiles.map(hash), errors = [], checks = [];
  const check = (valid,label) => { if (!valid) throw Error(label); checks.push(label); };
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}}); page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url); await page.waitForFunction(()=>window.cosyStudio,{timeout:60000});
    await page.locator('#avoid-overlaps').uncheck();
    for (const [index,id] of ids.entries()) {
      await page.locator('#assets-tab').click(); await page.locator('#search').fill('');
      const card = page.locator(`[data-asset="${id}"]`); await card.waitFor();
      await page.waitForFunction(id=>document.querySelector(`[data-asset="${id}"] img`)?.src.startsWith('data:image'),id,{timeout:60000});
      check(true,`${id} has a rendered shelf preview`); await card.click();
      const target = await page.evaluate(()=>cosyStudio.screenPoint('puppy-mochi'));
      await page.mouse.click(target.x,target.y); await page.keyboard.press('Escape');
      const item = await page.evaluate(id=>cosyStudio.snapshot().layout.objects.filter(o=>o.asset===id).at(-1),id);
      check(!!item,`${id} can be placed`);
      await page.locator('#scene-tab').click(); await page.locator('#search').fill(item.name);
      await page.locator('#scene-list .scene-select').filter({hasText:item.name}).last().click();
      for (const [selector,value] of [['#position-0',String(30+index*3)],['#rotation-1','35'],['#scale-0','1.15']]) {
        await page.locator(selector).fill(value); await page.locator(selector).press('Tab');
      }
      const edited = await page.evaluate(id=>cosyStudio.snapshot().layout.objects.find(o=>o.id===id),item.id);
      check(edited.position[0]===30+index*3 && edited.rotation[1]===35 && edited.scale[0]===1.15,`${id} supports position, facing and scale`);
    }
    await page.getByLabel('Layout name',{exact:true}).fill('Cottage asset verification');
    await page.getByLabel('Layout name',{exact:true}).press('Tab'); await page.locator('#save').click();
    await page.waitForFunction(()=>cosyStudio.snapshot().fileId);
    const fileId = await page.evaluate(()=>cosyStudio.snapshot().fileId);
    const saved = (await (await page.request.get(`${url}/api/layouts/${fileId}`)).json()).layout;
    check(ids.every((id,i)=>saved.objects.some(o=>o.asset===id && o.position[0]===30+i*3 && o.rotation[1]===35 && o.scale[0]===1.15)), 'All cottage asset transforms survive a named file save');
    await page.reload(); await page.waitForFunction(()=>window.cosyStudio,{timeout:60000});
    check(await page.evaluate(ids=>ids.every((id,i)=>cosyStudio.snapshot().layout.objects.some(o=>o.asset===id&&o.position[0]===30+i*3&&o.rotation[1]===35&&o.scale[0]===1.15)),ids),'All cottage saved transforms survive reload');
    check(protectedFiles.every((file,i)=>hash(file)===before[i]),'Playable layout and both protected presets are byte-identical');
    check(errors.length===0,'Editor has no page errors');
    await page.screenshot({path:path.join(output,'cottage-assets.png')});
    fs.writeFileSync(path.join(output,'editor-checks.json'),JSON.stringify({checks,fileId,errors},null,2));
    console.log(`${checks.length} cottage editor checks passed`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
