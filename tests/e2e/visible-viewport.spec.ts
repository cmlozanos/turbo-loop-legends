import {test,expect} from '@playwright/test';
import {openGame} from './learning-gate';

test('URL bars resize garage and canvas without a layout-window resize',async({page})=>{
 await page.setViewportSize({width:750,height:740});
 await page.addInitScript(()=>{
  let height=342;
  Object.defineProperty(window.visualViewport!,'height',{configurable:true,get:()=>height});
  (window as any).setVisibleHeight=(next:number)=>{height=next;visualViewport!.dispatchEvent(new Event('resize'));};
 });
 await openGame(page,'?test=1');
 const fits=async(height:number)=>{
  const shell=await page.locator('.app-shell').boundingBox();expect(shell!.height).toBe(height);
  for(const selector of ['#play-button','#car-prev','#car-next','#track-prev','#track-next']){
   const box=await page.locator(selector).boundingBox();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(740);
 };
 await fits(342);
 await page.evaluate(()=>(window as any).setVisibleHeight(300));await fits(300);
 await page.evaluate(()=>(window as any).setVisibleHeight(400));await fits(400);
 await page.locator('#play-button').click();
 for(const height of [300,400,342]){
  await page.evaluate(height=>(window as any).setVisibleHeight(height),height);
  await expect.poll(async()=>Math.round((await page.locator('canvas').first().boundingBox())!.height)).toBe(height);
  for(const button of await page.locator('#hud button').all()){
   const box=await button.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);
  }
 }
});
