import { test, expect } from '@playwright/test';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createOfflineModule } from '../../xhs-offline-skill/offline/index.mjs';
import { MockXhsAdapter } from '../../xhs-offline-skill/adapters/mockXhsAdapter.mjs';
let root, exported;
test.beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(),'xhs-browser-'));
  const module = createOfflineModule({ dataDir:path.join(root,'data'),adapter:new MockXhsAdapter({total:30}) });
  const pack = await module.prepare_offline({targetMinutes:240});
  exported = await module.export_offline({packId:pack.id,output:path.join(root,'export')});
  await module.clear_offline({all:true});
});
test.afterAll(async () => { if(root) await rm(root,{recursive:true,force:true}); });
test('fresh file opening while offline: all notes, all images, refresh, metadata and no remote requests', async ({ page, context }) => {
  const remote = [], errors = []; page.on('request',r => {if(/^https?:/.test(r.url())) remote.push(r.url());}); page.on('pageerror',e=>errors.push(e.message));
  await context.setOffline(true);
  await page.goto(pathToFileURL(exported.viewer).href);
  await expect(page.locator('#counter')).toHaveText('1 / 30');
  await page.locator('#info-toggle').click(); await expect(page.locator('#pack-summary')).toContainText('部分完成');
  await page.locator('#info-toggle').click();
  for(let i=0;i<30;i++) {
    await expect(page.locator('#counter')).toHaveText(`${i+1} / 30`);
    const item = await page.locator('#offline-data').evaluate((el,i)=>JSON.parse(el.textContent).feed[i],i);
    if(item.localImages.length) {
      for(let j=0;j<item.localImages.length;j++) {
        await expect(page.locator('#image')).toHaveJSProperty('complete',true);
        await expect(page.locator('#image')).not.toHaveJSProperty('naturalWidth',0);
        if(j+1<item.localImages.length) await page.locator('#image-next').click();
      }
    } else await expect(page.locator('#no-image')).toBeVisible();
    if(i===0) { await page.locator('#expand').click(); await expect(page.locator('#text')).toHaveClass('expanded'); }
    if(i<29) await page.keyboard.press('PageDown');
  }
  await expect(page.locator('#next')).toBeDisabled();
  await page.reload(); await expect(page.locator('#counter')).toHaveText('1 / 30');
  await expect(page.locator('#viewed')).toHaveText('已看过');
  await page.screenshot({path:'output/playwright/offline-desktop.png',fullPage:true});
  expect(remote).toEqual([]); expect(errors).toEqual([]);
});
test('wheel and horizontal keys work; long body scroll does not skip a note', async ({page,context}) => {
  await context.setOffline(true); await page.goto(pathToFileURL(exported.viewer).href);
  await page.locator('#photo').hover(); await page.mouse.wheel(0,300);
  await expect(page.locator('#counter')).toHaveText('2 / 30');
  await page.keyboard.press('ArrowRight'); await expect(page.locator('#image-counter')).toHaveText('2 / 2');
  await page.keyboard.press('ArrowLeft'); await expect(page.locator('#image-counter')).toHaveText('1 / 2');
  await page.locator('#expand').click(); await page.locator('#text').hover(); await page.mouse.wheel(0,100);
  await expect(page.locator('#counter')).toHaveText('2 / 30');
  await page.keyboard.press('ArrowUp'); await expect(page.locator('#counter')).toHaveText('1 / 30');
});
test('mobile viewport swipes between notes and images without horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:390,height:844},hasTouch:true,isMobile:true });
  const page = await context.newPage(); await context.setOffline(true); await page.goto(pathToFileURL(exported.viewer).href);
  const client = await context.newCDPSession(page);
  async function swipe(x,y,endX,endY) {
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:endX,y:endY}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await swipe(180,400,180,230); await expect(page.locator('#counter')).toHaveText('2 / 30');
  await swipe(290,280,100,280); await expect(page.locator('#image-counter')).toHaveText('2 / 2');
  await swipe(180,230,180,400); await expect(page.locator('#counter')).toHaveText('1 / 30');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'output/playwright/offline-mobile.png',fullPage:true}); await context.close();
});
