#!/usr/bin/env python3
"""Generates the car artwork of Turbo Loop Legends: body sprites and garage previews.

    python3 tools/build-car-art.py public/cars

writes <car>-body.svg and <car>-preview.svg. The game loads <car>-body.png: render each
body SVG at 640x300 with a transparent background (any SVG rasteriser with filter
support, e.g. a headless Chromium screenshot) after changing the artwork.

All lighting is baked into the sprites, so the look costs nothing at run time. The
canvas is 320x150 units; wheel centres sit at x=80/240, y=119, which at bodyScale 0.28
matches the physics wheel offsets (1 m, 0.55 m) at 45 px per metre.
"""
import math, sys, pathlib

W, H = 320, 150
WX = (80.0, 240.0)
WY = 119.0
UNIT_PX = 0.56  # screen px per art unit at bodyScale 0.28 on a 640 px sprite

def hexc(c): return "#%06x" % c
def mix(c, t, f):
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    tr, tg, tb = (t >> 16) & 255, (t >> 8) & 255, t & 255
    return "#%02x%02x%02x" % (round(r + (tr - r) * f), round(g + (tg - g) * f), round(b + (tb - b) * f))
def light(c, f): return mix(c, 0xffffff, f)
def dark(c, f): return mix(c, 0x05070c, f)

CARS = {
  "comet": dict(color=0xe5262b, accent=0xffd166, wheel=21, sill=126,
    top="L 9 106 Q 8 93 17 89 L 34 86 Q 62 80 88 62 Q 108 47 140 45 L 170 46 Q 196 49 224 73 Q 264 77 294 88 Q 309 93 311 106 L 309 120 Q 307 126 298 126",
    glass="M 96 64 Q 112 51 140 50 L 168 51 Q 190 54 212 73 Z", pillars=[(150, 51, 148, 72)],
    seam="M 152 74 L 150 118 M 100 74 Q 98 96 108 120 M 212 74 Q 216 96 206 120", handle=(160, 84),
    head="M 286 90 Q 302 93 307 103 L 290 100 Z", tail="M 10 96 L 22 93 L 24 103 L 10 106 Z",
    under='<path d="M 6 78 L 44 76 L 46 82 L 8 85 Z" fill="#11141b"/><path d="M 18 82 L 22 92 M 36 81 L 38 90" stroke="#11141b" stroke-width="4"/>',
    extras='<path d="M 232 82 L 262 85 L 258 91 L 230 88 Z" fill="#0b0e14" opacity=".8"/><path d="M 120 104 L 200 104" stroke="{accent}" stroke-width="3" opacity=".9"/><path d="M 60 104 L 112 104" stroke="{accent}" stroke-width="3" opacity=".9"/>'),
  "lynx": dict(color=0x1f8fe0, accent=0xa8ecff, wheel=24, sill=112,
    top="L 12 92 Q 11 78 22 76 L 96 74 L 104 50 Q 107 42 118 41 L 176 41 Q 188 42 196 52 L 214 73 Q 262 76 296 84 Q 308 88 309 98 L 308 108 Q 306 112 298 112",
    glass="M 112 70 L 118 49 L 174 49 Q 182 50 188 57 L 200 72 Z", pillars=[(150, 49, 150, 71)],
    seam="M 106 74 L 108 108 M 152 73 L 152 108 M 204 74 L 204 108", handle=(160, 82),
    head="M 288 84 Q 303 88 306 97 L 288 96 Z", tail="M 12 80 L 22 79 L 22 92 L 12 93 Z",
    under='<path d="M 104 40 L 190 40" stroke="#0e1118" stroke-width="5" stroke-linecap="round"/><rect x="126" y="31" width="44" height="9" rx="4" fill="#161a22"/><circle cx="134" cy="35.5" r="3.4" fill="#fff6c9"/><circle cx="148" cy="35.5" r="3.4" fill="#fff6c9"/><circle cx="162" cy="35.5" r="3.4" fill="#fff6c9"/><path d="M 30 76 L 44 50 L 92 50 L 100 76" stroke="#11141b" stroke-width="5.5" fill="none" stroke-linejoin="round"/><path d="M 62 50 L 62 76" stroke="#11141b" stroke-width="4"/><path d="M 31 75 L 45 51" stroke="#8fa0b3" stroke-width="1.2"/>',
    extras='<path d="M 26 96 L 96 92 L 150 98 L 300 96" stroke="{accent}" stroke-width="4" fill="none" opacity=".95"/><path d="M 26 102 L 96 98 L 150 104 L 300 102" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".7"/><path d="M 300 100 L 314 100 L 314 110 L 298 110 Z" fill="#12151c"/>'),
  "titan": dict(color=0x7447e6, accent=0xf3c4ff, wheel=21, sill=124,
    top="L 9 100 Q 8 78 20 74 L 74 70 Q 80 50 96 46 L 196 46 Q 208 47 216 58 L 228 74 Q 270 76 298 84 Q 311 88 312 100 L 311 118 Q 309 124 300 124",
    glass="M 86 70 Q 90 54 100 53 L 194 53 Q 202 54 208 62 L 216 73 Z", pillars=[(136, 53, 134, 71), (176, 53, 176, 72)],
    seam="M 82 74 L 84 118 M 136 73 L 136 118 M 180 73 L 180 118 M 222 75 L 222 118", handle=(144, 84),
    head="M 290 85 Q 306 89 309 99 L 290 98 Z", tail="M 9 80 L 20 78 L 20 98 L 9 100 Z",
    under='<path d="M 92 44 L 200 44" stroke="#0e1118" stroke-width="4" stroke-linecap="round"/><path d="M 104 44 L 104 38 L 188 38 L 188 44" stroke="#0e1118" stroke-width="3.5" fill="none"/>',
    extras='<path d="M 240 66 L 276 70 L 276 78 L 236 76 Z" fill="#0b0e14"/><path d="M 244 69 L 272 72" stroke="{accent}" stroke-width="2"/><path d="M 300 104 L 316 104 L 316 120 L 300 120 Z" fill="#161a22"/><path d="M 302 108 L 314 108 M 302 113 L 314 113" stroke="#3a4452" stroke-width="2"/><path d="M 14 108 L 300 108" stroke="#0b0e14" stroke-width="3" opacity=".55"/>'),
  "spark": dict(color=0xffc21a, accent=0x7af5ff, wheel=19, sill=126,
    top="L 34 110 Q 32 92 44 86 Q 60 60 92 52 L 168 50 Q 196 52 214 76 Q 252 80 276 90 Q 288 96 288 108 L 287 121 Q 285 126 278 126",
    glass="M 62 82 Q 74 60 96 58 L 166 56 Q 188 58 202 78 Z", pillars=[(128, 57, 126, 81)],
    seam="M 130 82 L 128 120 M 204 80 Q 210 100 200 121", handle=(140, 90),
    head="M 262 88 Q 280 93 285 104 L 266 102 Z", tail="M 34 94 L 44 90 L 46 104 L 34 108 Z",
    under='<path d="M 44 54 L 92 50 L 92 55 L 46 60 Z" fill="#11141b"/>',
    extras='<path d="M 48 106 L 130 104 L 170 110 L 284 110" stroke="#0b0e14" stroke-width="5" fill="none" opacity=".85"/><path d="M 48 106 L 130 104 L 170 110 L 284 110" stroke="{accent}" stroke-width="1.8" fill="none"/>'),
  "gecko": dict(color=0x25c26a, accent=0xc8ff6a, wheel=22, sill=127,
    top="L 8 108 Q 7 96 16 92 L 40 88 Q 78 80 112 60 Q 128 51 152 50 L 176 51 Q 204 56 232 78 Q 276 84 304 98 Q 313 103 313 112 L 311 122 Q 309 127 300 127",
    glass="M 112 68 Q 130 57 152 56 L 174 57 Q 196 61 218 78 Z", pillars=[(160, 56, 160, 77)],
    seam="M 164 79 L 160 120 M 112 78 Q 106 100 116 121", handle=(172, 90),
    head="M 280 90 Q 300 97 309 108 L 286 102 Z", tail="M 8 98 L 26 94 L 26 100 L 8 104 Z",
    under='<path d="M 2 66 L 46 64 L 48 72 L 4 75 Z" fill="#0d1016"/><path d="M 14 72 L 20 90 M 36 70 L 40 88" stroke="#0d1016" stroke-width="4.5"/>',
    extras='<path d="M 60 96 L 120 90 L 126 108 L 66 112 Z" fill="#06080c" opacity=".85"/><path d="M 68 98 L 118 94 M 69 103 L 120 99 M 70 108 L 122 104" stroke="{accent}" stroke-width="1.6" opacity=".9"/><path d="M 8 116 L 34 116 L 30 126 L 10 126 Z" fill="#0b0e14"/>'),
  "mammoth": dict(color=0xff6a1f, accent=0xffe26a, wheel=27, sill=102,
    top="L 12 80 Q 11 66 22 64 L 98 62 L 104 36 Q 106 28 116 27 L 184 27 Q 196 28 202 38 L 214 62 Q 262 64 294 70 Q 308 73 309 84 L 308 96 Q 306 102 298 102",
    glass="M 112 58 L 117 36 L 182 36 Q 190 37 194 44 L 202 59 Z", pillars=[(150, 36, 150, 58)],
    seam="M 106 62 L 108 98 M 152 60 L 152 98 M 208 63 L 208 98", handle=(160, 70),
    head="M 286 71 Q 303 74 306 83 L 286 82 Z", tail="M 12 68 L 22 67 L 22 80 L 12 81 Z",
    under='<rect x="84" y="14" width="9" height="52" rx="4" fill="#9aa5b1"/><rect x="84" y="14" width="3" height="52" fill="#e6edf4"/><rect x="82" y="10" width="13" height="8" rx="3" fill="#2a2f38"/><rect x="118" y="17" width="64" height="10" rx="5" fill="#161a22"/><circle cx="130" cy="22" r="3.6" fill="#fff6c9"/><circle cx="143" cy="22" r="3.6" fill="#fff6c9"/><circle cx="157" cy="22" r="3.6" fill="#fff6c9"/><circle cx="170" cy="22" r="3.6" fill="#fff6c9"/>',
    extras='<path d="M 300 76 L 316 74 L 318 104 L 300 104 Z" fill="#1a1e26"/><path d="M 303 80 L 315 79 M 303 87 L 316 87 M 303 94 L 316 95" stroke="#8d98a6" stroke-width="2.4"/><path d="M 24 84 L 98 82 L 150 88 L 298 86" stroke="{accent}" stroke-width="5" fill="none"/><path d="M 30 72 L 44 72 L 40 80 L 26 80 Z M 50 72 L 64 72 L 60 80 L 46 80 Z M 70 72 L 84 72 L 80 80 L 66 80 Z" fill="#0b0e14" opacity=".8"/>'),
}

def wheel_units(car): return car["wheel"] / UNIT_PX

def body_path(car):
    r = wheel_units(car); R = r + 5; sill = car["sill"]
    a = math.sqrt(max(1.0, R * R - (sill - WY) ** 2))
    start = car["top"].split()[1:3]
    rear_x = float(start[0]) + 2
    d = f"M {rear_x:.1f} {sill} {car['top']} "
    d += f"L {WX[1] + a:.1f} {sill} A {R:.1f} {R:.1f} 0 0 0 {WX[1] - a:.1f} {sill} "
    d += f"L {WX[0] + a:.1f} {sill} A {R:.1f} {R:.1f} 0 0 0 {WX[0] - a:.1f} {sill} Z"
    return d, R

def body_group(cid, car, uid):
    c = car["color"]; accent = hexc(car["accent"]); d, R = body_path(car); sill = car["sill"]
    top_y = min(float(v) for v in car["glass"].replace("M", " ").replace("L", " ").replace("Q", " ").replace("Z", " ").split()[1::2]) - 8
    shoulder = top_y + (sill - top_y) * 0.52
    defs = f'''
    <linearGradient id="{uid}paint" x1="0" y1="{top_y}" x2="0" y2="{sill}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{light(c, .55)}"/><stop offset=".22" stop-color="{light(c, .16)}"/><stop offset=".5" stop-color="{hexc(c)}"/><stop offset=".8" stop-color="{dark(c, .24)}"/><stop offset="1" stop-color="{dark(c, .5)}"/>
    </linearGradient>
    <linearGradient id="{uid}sky" x1="0" y1="{top_y}" x2="0" y2="{shoulder}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".7" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="{uid}floor" x1="0" y1="{shoulder + 6}" x2="0" y2="{sill}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#05070c" stop-opacity=".22"/><stop offset=".5" stop-color="#05070c" stop-opacity=".06"/><stop offset="1" stop-color="{light(c, .3)}" stop-opacity=".22"/>
    </linearGradient>
    <linearGradient id="{uid}glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9fd4f2"/><stop offset=".28" stop-color="#2c4d6b"/><stop offset=".62" stop-color="#0c1624"/><stop offset="1" stop-color="#1c3148"/>
    </linearGradient>
    <linearGradient id="{uid}rim" x1="0" y1="{top_y - 6}" x2="0" y2="{shoulder}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="{uid}ao"><stop offset=".62" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="{uid}glow"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#dff4ff" stop-opacity=".55"/><stop offset="1" stop-color="#bfe8ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="{uid}red"><stop offset="0" stop-color="#ff7a6a" stop-opacity=".9"/><stop offset="1" stop-color="#ff2a2a" stop-opacity="0"/></radialGradient>
    <filter id="{uid}soft" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="{uid}softer" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="4"/></filter>
    <clipPath id="{uid}body"><path d="{d}"/></clipPath>
    <clipPath id="{uid}win"><path d="{car['glass']}"/></clipPath>
    <clipPath id="{uid}well"><rect x="0" y="0" width="{W + 20}" height="{sill + 1}"/></clipPath>'''
    hx, hy = car["handle"]
    pillars = "".join(f'<path d="M {x1} {y1} L {x2} {y2}" stroke="#0a0d13" stroke-width="5"/>' for x1, y1, x2, y2 in car["pillars"])
    g = f'''
    <g clip-path="url(#{uid}well)"><circle cx="{WX[0]}" cy="{WY}" r="{R - 0.5:.1f}" fill="#07090d"/><circle cx="{WX[1]}" cy="{WY}" r="{R - 0.5:.1f}" fill="#07090d"/></g>
    {car["under"].format(accent=accent)}
    <path d="{d}" fill="url(#{uid}paint)"/>
    <g clip-path="url(#{uid}body)">
      <rect x="0" y="{top_y - 10}" width="{W + 20}" height="{shoulder - top_y + 10}" fill="url(#{uid}sky)"/>
      <path d="M -10 {shoulder + 7} Q {W / 2} {shoulder - 3} {W + 20} {shoulder + 9} L {W + 20} {sill + 4} L -10 {sill + 4} Z" fill="url(#{uid}floor)"/>
      <path d="M 20 {shoulder + 1.5} Q {W / 2} {shoulder - 7} {W - 16} {shoulder + 3}" stroke="#fff" stroke-width="5" fill="none" opacity=".75" filter="url(#{uid}soft)"/>
      <path d="M 40 {shoulder + 4.5} Q {W / 2} {shoulder - 3} {W - 40} {shoulder + 6}" stroke="#fff" stroke-width="1.3" fill="none" opacity=".85"/>
      <ellipse cx="{W * 0.72}" cy="{shoulder - 12}" rx="46" ry="5" fill="#fff" opacity=".4" filter="url(#{uid}softer)"/>
      <circle cx="{WX[0]}" cy="{WY}" r="{R + 15:.1f}" fill="url(#{uid}ao)"/><circle cx="{WX[1]}" cy="{WY}" r="{R + 15:.1f}" fill="url(#{uid}ao)"/>
      <rect x="0" y="{sill - 9}" width="{W + 20}" height="12" fill="#0d1016"/>
      <rect x="0" y="{sill - 9.6}" width="{W + 20}" height="1.4" fill="#fff" opacity=".28"/>
      {car["extras"].format(accent=accent)}
      <path d="{car['seam']}" stroke="#05070c" stroke-width="1.5" fill="none" opacity=".5"/>
      <path d="{car['seam']}" stroke="#fff" stroke-width=".7" fill="none" opacity=".22" transform="translate(1.2 0)"/>
      <rect x="{hx}" y="{hy}" width="13" height="3.6" rx="1.8" fill="#0a0d13" opacity=".8"/><rect x="{hx}" y="{hy}" width="13" height="1.2" rx=".6" fill="#fff" opacity=".5"/>
      <path d="{car['tail']}" fill="#ff3b30"/><path d="{car['tail']}" fill="#fff" opacity=".25" transform="translate(0 -1.5) scale(1 .96)"/>
      <path d="{car['head']}" fill="#f4fbff"/><path d="{car['head']}" fill="none" stroke="#7fd7ff" stroke-width="1.6"/>
    </g>
    <path d="{car['glass']}" fill="url(#{uid}glass)" stroke="#0a0d13" stroke-width="3.2" stroke-linejoin="round"/>
    <g clip-path="url(#{uid}win)">
      <path d="M 60 30 L 120 30 L 96 110 L 36 110 Z" fill="#fff" opacity=".2"/><path d="M 132 30 L 146 30 L 122 110 L 108 110 Z" fill="#fff" opacity=".16"/>
      <path d="M 0 {top_y + 9} L {W} {top_y + 9}" stroke="#fff" stroke-width="2" opacity=".28"/>
      {pillars}
    </g>
    <path d="{d}" fill="none" stroke="{dark(c, .72)}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="{d}" fill="none" stroke="url(#{uid}rim)" stroke-width="1.5" stroke-linejoin="round" transform="translate(0 1.6)" clip-path="url(#{uid}body)"/>
    <circle cx="{float(car['head'].split()[4]) + 2:.1f}" cy="{float(car['head'].split()[5]) + 2:.1f}" r="13" fill="url(#{uid}glow)"/>
    <circle cx="{float(car['tail'].split()[1]) + 2:.1f}" cy="{float(car['tail'].split()[2]) + 6:.1f}" r="11" fill="url(#{uid}red)"/>'''
    return defs, g

def wheel_svg(cx, cy, r, accent, uid):
    spokes = ""
    for i in range(5):
        a = -90 + i * 72
        spokes += f'<path d="M -{r * .10:.2f} -{r * .16:.2f} L -{r * .16:.2f} -{r * .60:.2f} L {r * .16:.2f} -{r * .60:.2f} L {r * .10:.2f} -{r * .16:.2f} Z" fill="url(#{uid}alloy)" stroke="#39424e" stroke-width=".6" transform="rotate({a + 90})"/>'
    tread = "".join(f'<rect x="-1.6" y="-{r:.2f}" width="3.2" height="{r * .12:.2f}" fill="#1c2129" transform="rotate({i * 15})"/>' for i in range(24))
    return f'''<g transform="translate({cx} {cy})">
      <circle r="{r:.2f}" fill="#090b0f"/>{tread}
      <circle r="{r * .88:.2f}" fill="url(#{uid}tire)"/>
      <circle r="{r * .66:.2f}" fill="#0d1014"/>
      <circle r="{r * .62:.2f}" fill="#3a424d"/><circle r="{r * .58:.2f}" fill="#20262e"/>
      <circle r="{r * .40:.2f}" fill="#8a949f"/><circle r="{r * .36:.2f}" fill="#5c6570"/>
      <path d="M {r * .18:.2f} -{r * .46:.2f} A {r * .5:.2f} {r * .5:.2f} 0 0 1 {r * .46:.2f} -{r * .18:.2f} L {r * .30:.2f} -{r * .10:.2f} A {r * .32:.2f} {r * .32:.2f} 0 0 0 {r * .10:.2f} -{r * .30:.2f} Z" fill="{accent}"/>
      {spokes}
      <circle r="{r * .62:.2f}" fill="none" stroke="url(#{uid}alloy)" stroke-width="{r * .07:.2f}"/>
      <circle r="{r * .17:.2f}" fill="url(#{uid}alloy)" stroke="#2a313a" stroke-width=".8"/><circle r="{r * .07:.2f}" fill="{accent}"/>
      <path d="M -{r * .80:.2f} -{r * .30:.2f} A {r * .86:.2f} {r * .86:.2f} 0 0 1 -{r * .20:.2f} -{r * .83:.2f}" stroke="#fff" stroke-width="1.6" fill="none" opacity=".35" stroke-linecap="round"/>
    </g>'''

WHEEL_DEFS = '''<radialGradient id="{uid}tire"><stop offset=".7" stop-color="#1b1f26"/><stop offset=".9" stop-color="#2d333c"/><stop offset="1" stop-color="#101318"/></radialGradient>
    <linearGradient id="{uid}alloy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#b9c3cd"/><stop offset="1" stop-color="#6c7682"/></linearGradient>'''

def body_svg(cid, car):
    defs, g = body_group(cid, car, "")
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">\n  <defs>{defs}\n  </defs>{g}\n</svg>\n'

def preview_svg(cid, car):
    uid = cid[:2]
    defs, g = body_group(cid, car, uid)
    r = wheel_units(car); ground = WY + r
    wheels = wheel_svg(WX[0], WY, r, hexc(car["accent"]), uid) + wheel_svg(WX[1], WY, r, hexc(car["accent"]), uid)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 0 {W + 12} {ground + 14:.0f}">
  <defs>{defs}
    {WHEEL_DEFS.format(uid=uid)}
    <radialGradient id="{uid}shadow"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="{W / 2}" cy="{ground + 2:.1f}" rx="{W * .47}" ry="9" fill="url(#{uid}shadow)"/>{g}
  {wheels}
</svg>
'''

if __name__ == "__main__":
    out = pathlib.Path(sys.argv[1])
    for cid, car in CARS.items():
        (out / f"{cid}-body.svg").write_text(body_svg(cid, car))
        (out / f"{cid}-preview.svg").write_text(preview_svg(cid, car))
    print("written", len(CARS) * 2)
