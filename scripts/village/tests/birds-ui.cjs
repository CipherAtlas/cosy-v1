const { chromium, firefox } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
  const kind=process.argv[2]||'chrome',output=process.env.OUTPUT_DIR||'/tmp/cosy-birds';fs.mkdirSync(output,{recursive:true});
  const browser=await(kind==='firefox'?firefox:chromium).launch({headless:true,...(kind==='chrome'?{channel:'chrome'}:{}),...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:kind==='firefox'?null:{width:1280,height:800}});
  const checks=[],errors=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};page.on('pageerror',e=>errors.push(String(e)));
  try{
    const visit=async()=>{await page.getByRole('button',{name:'Places',exact:true}).click();await page.getByRole('button',{name:/Bird clearing A little/}).click();};
    await page.goto(process.env.APP_URL||'http://127.0.0.1:3046/');
    await page.getByRole('button',{name:'Enter the village',exact:true}).click({timeout:60000});
    await visit();
    check(await page.getByRole('heading',{name:'A picnic for little wings.'}).isVisible(),'Clearing is directly reachable from Places');
    await page.getByRole('button',{name:'Chat with Wren · Ask for crumbs',exact:true}).click();
    check(await page.getByText('Wren: Here, some sourdough crumbs.',{exact:false}).isVisible(),'Talking to Wren gives sourdough crumbs with her dialogue');
    const scatter=page.getByRole('button',{name:'Scatter sourdough crumbs',exact:true});
    const begun=Date.now();await scatter.click();
    check(await scatter.isDisabled(),'Repeated feeding is disabled while crumbs are queued or being eaten');
    await page.getByRole('status').filter({hasText:'Coo coo~ (Thank you~)'}).first().waitFor({timeout:65000});
    const waited=(Date.now()-begun)/1000;
    check(await page.locator('.v-bird-bubble').isVisible(),'World speech appears after the real flight and feeding cycle');
    check(await page.getByRole('button',{name:'Back to village',exact:true}).isVisible(),'Clearing has a directly clickable exit');
    await page.screenshot({path:path.join(output,`app-${kind}.png`)});
    if(kind==='chrome'){
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(350);
      await page.screenshot({path:path.join(output,'app-phone.png')});
      const bubble=await page.locator('.v-bird-bubble').boundingBox(),exit=await page.locator('.v-leave').boundingBox();
      check(!bubble || bubble.y >= exit.y + exit.height + 8, 'Phone bird speech stays below the exit control');
      for(const locator of [scatter,page.getByRole('button',{name:'Back to village',exact:true})]){
        const b=await locator.boundingBox();check(b&&b.x>=0&&b.y>=0&&b.x+b.width<=391&&b.y+b.height<=845,'Phone feeding and exit controls fit the viewport');
      }
      await page.setViewportSize({width:1280,height:800});
    }
    await page.getByRole('button',{name:'Back to village',exact:true}).click();
    check(await page.locator('.village').getAttribute('data-activity')==='explore','Leaving returns to exploration');
    await page.keyboard.press('e');
    check(await page.locator('.village').getAttribute('data-activity')==='birds','E enters the clearing from its arrival point');
    await page.keyboard.press('Escape');
    check(await page.locator('.village').getAttribute('data-activity')==='explore','Escape leaves the clearing');
    await page.reload();await page.getByRole('button',{name:'Enter the village',exact:true}).click({timeout:60000});await visit();
    check(await scatter.isVisible(),'Wren’s crumb pouch survives reload');
    await page.getByRole('button',{name:'Friends',exact:true}).click();
    await page.getByRole('button',{name:'Invite Wren',exact:true}).click();
    check(await page.getByRole('button',{name:'Let Wren wander',exact:true}).getAttribute('aria-pressed')==='true','Wren can join as a companion');
    await page.getByRole('button',{name:'Let Wren wander',exact:true}).click();
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await scatter.click();
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByLabel(/Language/).selectOption('ja');
    await page.getByLabel('シンプル表示',{exact:true}).click();
    await page.getByRole('button',{name:'場所',exact:true}).click();await page.getByRole('button',{name:/小鳥の広場/}).click();
    await page.getByRole('status').filter({hasText:'クークー〜（ありがとう〜）'}).waitFor({timeout:15000});
    check(true,'Switching to Japanese simple view completes queued feeding and translates the thanks');
    check(await page.locator('.v-leave').isVisible(),'Japanese simple view keeps the exit visible');
    await page.screenshot({path:path.join(output,`simple-ja-${kind}.png`)});
    check(!errors.length,'No application errors');
    fs.writeFileSync(path.join(output,`ui-${kind}.json`),JSON.stringify({checks,realWaitSeconds:waited,errors},null,2));
    console.log(`${checks.length} exported-app bird checks passed in ${kind}; real cycle wait ${waited}s`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
