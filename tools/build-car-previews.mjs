import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cars = [
  { id: "comet", wheels: [[92, 132], [272, 132]], radius: 31, accent: "#ffcb52", rim: "#e8f4ff" },
  { id: "lynx", wheels: [[91, 130], [275, 130]], radius: 43, accent: "#ffcf58", rim: "#becbe0" },
  { id: "titan", wheels: [[96, 132], [270, 132]], radius: 32, accent: "#53dfff", rim: "#d9f8ff" },
];

for (const car of cars) {
  const source = await readFile(resolve(root, `public/cars/${car.id}-body-v2.svg`), "utf8");
  const content = source.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const wheels = car.wheels.map(([x, y]) => `
    <g transform="translate(${x} ${y})">
      <circle r="${car.radius}" fill="#060912" stroke="#02040a" stroke-width="7"/>
      <circle r="${car.radius - 6}" fill="none" stroke="#30394a" stroke-width="4" stroke-dasharray="7 5"/>
      <circle r="${Math.round(car.radius * .56)}" fill="#172033" stroke="${car.rim}" stroke-width="3"/>
      <g stroke="${car.accent}" stroke-width="4" stroke-linecap="round"><path d="M0-${Math.round(car.radius * .42)}V${Math.round(car.radius * .42)}M-${Math.round(car.radius * .42)} 0H${Math.round(car.radius * .42)}M-${Math.round(car.radius * .3)}-${Math.round(car.radius * .3)} ${Math.round(car.radius * .3)} ${Math.round(car.radius * .3)}M${Math.round(car.radius * .3)}-${Math.round(car.radius * .3)} -${Math.round(car.radius * .3)} ${Math.round(car.radius * .3)}"/></g>
      <circle r="6" fill="#f5fbff" stroke="#0b1220" stroke-width="3"/>
    </g>`).join("");
  const preview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180">
  <defs><filter id="preview-shadow" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="6"/></filter></defs>
  <ellipse cx="182" cy="160" rx="145" ry="10" fill="#020711" opacity=".48" filter="url(#preview-shadow)"/>
  ${content}
  ${wheels}
</svg>\n`;
  await writeFile(resolve(root, `public/cars/${car.id}-preview-v2.svg`), preview);
}
