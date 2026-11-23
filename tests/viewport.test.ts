import {afterEach,it,expect,vi} from 'vitest';
import {visibleViewport} from '../src/game/viewport';
afterEach(()=>vi.unstubAllGlobals());
it('uses visual CSS dimensions and retains fallback without VisualViewport',()=>{
 vi.stubGlobal('window',{innerWidth:750,innerHeight:740,visualViewport:{width:750,height:300,scale:1}});
 expect(visibleViewport()).toEqual({width:750,height:300});
 vi.stubGlobal('window',{innerWidth:750,innerHeight:342});
 expect(visibleViewport()).toEqual({width:750,height:342});
});
it('never expands beyond the layout viewport or treats pinch zoom as a device rotation',()=>{
 vi.stubGlobal('window',{innerWidth:750,innerHeight:342,visualViewport:{width:900,height:500,scale:1}});
 expect(visibleViewport()).toEqual({width:750,height:342});
 vi.stubGlobal('window',{innerWidth:750,innerHeight:342,visualViewport:{width:375,height:171,scale:2}});
 expect(visibleViewport()).toEqual({width:750,height:342});
});
