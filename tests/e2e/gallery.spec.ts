import {test,expect} from '@playwright/test';
import {openGame,solveGate} from './learning-gate';
test('horizontal galleries wrap through every unlocked choice and fit each orientation',async({page},info)=>{
 await openGame(page,'?test=1');
 for(const size of [{width:320,height:640},{width:750,height:342},{width:1024,height:768},{width:800,height:1280}]){
  await page.setViewportSize(size);await page.evaluate(()=>window.FamilyV2!.fontReady);
  for(const [kind,card,count] of [['car','.car-card',6],['track','.track-card',8]] as const){
   const seen=new Set<string>();
   for(let i=0;i<count;i++){
    const selected=page.locator(card+'[aria-pressed=true]');await expect(selected).toBeVisible();
    seen.add((await selected.getAttribute('aria-label'))!);
    await page.locator('#'+kind+'-next').click();
   }
   expect(seen.size).toBe(count);
   const next=page.locator('#'+kind+'-next');const box=(await next.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
   await page.locator('#'+kind+'-gallery').focus();await page.keyboard.press('ArrowLeft');
  }
  const overflow=await page.evaluate(()=>[document.documentElement,document.body,document.querySelector('.garage')!,...document.querySelectorAll('.selection-gallery')].filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>({name:e.className,w:[e.scrollWidth,e.clientWidth],h:[e.scrollHeight,e.clientHeight]})));
  expect(overflow).toEqual([]);
  await page.screenshot({path:info.outputPath('gallery-'+size.width+'.png')});
 }
 const selectedBefore=await page.locator('.car-card[aria-pressed=true]').getAttribute('aria-label');
 const strip=page.locator('#car-gallery');const rect=(await strip.boundingBox())!;
 await strip.dispatchEvent('pointerdown',{pointerId:77,isPrimary:true,clientX:rect.x+rect.width*.8,clientY:rect.y+20});
 await strip.dispatchEvent('pointerup',{pointerId:77,isPrimary:true,clientX:rect.x+rect.width*.2,clientY:rect.y+20});
 expect(await page.locator('.car-card[aria-pressed=true]').getAttribute('aria-label')).not.toBe(selectedBefore);
 const selectedAfter=await page.locator('.car-card[aria-pressed=true]').getAttribute('aria-label');
 await page.reload();await solveGate(page);
 expect(await page.locator('.car-card[aria-pressed=true]').getAttribute('aria-label')).toBe(selectedAfter);
 await page.locator('#play-button').click();await expect(page.locator('#hud')).toBeVisible();
});
