import {test,expect} from '@playwright/test';
import {openGame} from './learning-gate';
import {openAdultSettings,closeAdultSettings} from './family-v2';

test('bounded sand and exhaust follow car contact and stop with reduced motion',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await openGame(page,'?test=1');await page.locator('#play-button').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__turboRead().scene?.steps??0)).toBeGreaterThan(5);
 await page.keyboard.down('ArrowRight');await page.keyboard.down('ShiftLeft');
 await expect.poll(()=>page.evaluate(()=>(window as any).__turboRead().scene.exhaustAlive)).toBeGreaterThan(0);
 const counts=await page.evaluate(()=>(window as any).__turboRead().scene);
 expect(counts.dustAlive).toBeLessThanOrEqual(7);expect(counts.exhaustAlive).toBeLessThanOrEqual(3);expect(counts.brakeSmokeAlive).toBeLessThanOrEqual(2);
 await page.screenshot({path:info.outputPath('sand-driving.png')});
 await page.keyboard.up('ShiftLeft');await page.keyboard.up('ArrowRight');
 await openAdultSettings(page);await page.locator('family-v2-shell #motion').click();await closeAdultSettings(page);
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__turboRead().scene;return s.dustAlive+s.exhaustAlive+s.brakeSmokeAlive;})).toBe(0);
 expect(errors).toEqual([]);
});
