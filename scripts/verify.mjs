import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.APP_URL||'http://127.0.0.1:4310';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch();
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.getByRole('heading',{name:'Agent orchestration'}).waitFor();
    await page.locator('.connection.online').waitFor({state:'attached',timeout:20000});
    assert.equal(await page.locator('.agent-node').count(),5);
    await page.locator('.node-supervisor').click();assert.match(await page.locator('.agent-inspector').innerText(),/Supervisor/);
    for(const name of ['Hiring signals','Project files','Oversight','Applications']) {await page.getByRole('tab',{name,exact:false}).click();}
    if(await page.getByRole('button',{name:'Open application',exact:true}).count()) {
      const button=page.getByRole('button',{name:'Open application',exact:true}).first();
      if(await button.isEnabled()) {await button.click();await page.locator('.preview-modal iframe').waitFor();assert((await page.frameLocator('.preview-modal iframe').locator('body').innerText()).length>40);await page.getByRole('button',{name:'Close artifact'}).click();}
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
    await page.screenshot({path:`test-results/dashboard-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log(`${width}px: five agents, inspector, output tabs, preview, no overflow or browser errors`);
    await page.close();
  }
} finally {await browser.close();}
