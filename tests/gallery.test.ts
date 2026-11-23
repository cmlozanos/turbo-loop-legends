import {expect,it} from 'vitest';
import {galleryOffset} from '../src/game/gallery';
it('keeps selected centred and wraps the two neighbours for every option',()=>{
 for(const count of [6,8])for(let selected=0;selected<count;selected++){
  const offsets=Array.from({length:count},(_,i)=>galleryOffset(i,selected,count));
  expect(offsets[selected]).toBe(0);
  expect(offsets.filter(x=>Math.abs(x)<=1).sort()).toEqual([-1,0,1]);
  expect(galleryOffset((selected+1)%count,selected,count)).toBe(1);
 }
});
