import {expect,type Locator,type Page} from '@playwright/test';
export async function selectGalleryItem(page:Page,kind:'car'|'track',target:Locator):Promise<void>{
 const count=await page.locator(kind==='car'?'.car-card':'.track-card').count();
 for(let i=0;i<count;i++){
  if(await target.isVisible()){await target.click();return;}
  await page.locator('#'+kind+'-next').click();
 }
 await expect(target).toBeVisible();
}
