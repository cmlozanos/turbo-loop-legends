import { readFile } from "node:fs/promises";

const index = await readFile("dist/index.html", "utf8");
const manifestPath = index.match(/href="\/turbo-loop-legends\/(manifest-[^"]+\.webmanifest)"/)?.[1];
if (!manifestPath) throw new Error("index.html no enlaza un manifiesto PWA versionado");

const manifest = JSON.parse(await readFile(`dist/${manifestPath}`, "utf8"));
if (manifest.id !== "/turbo-loop-legends/" || manifest.start_url !== "/turbo-loop-legends/") {
  throw new Error("El id o start_url de la PWA no coincide con GitHub Pages");
}
if (manifest.display !== "standalone" || manifest.orientation !== "landscape") {
  throw new Error("La PWA debe abrirse standalone y en horizontal");
}

const requiredIcons = new Map([["192x192", [192, 192]], ["512x512", [512, 512]]]);
for (const [size, dimensions] of requiredIcons) {
  const icon = manifest.icons.find((candidate) => candidate.sizes === size && candidate.type === "image/png");
  if (!icon) throw new Error(`Falta el icono PWA PNG ${size}`);
  const file = icon.src.split("?")[0];
  const png = await readFile(`dist/${file}`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== dimensions[0] || height !== dimensions[1]) throw new Error(`Dimensiones incorrectas en ${file}`);
}

if (!manifest.icons.some((icon) => icon.purpose === "maskable")) throw new Error("Falta el icono maskable");
if (!index.includes('rel="apple-touch-icon"')) throw new Error("Falta apple-touch-icon para iPad");
if (!index.includes('name="apple-mobile-web-app-capable" content="yes"')) throw new Error("Falta el modo web app de iPad");
if (!await readFile("dist/sw.js")) throw new Error("Falta el service worker");

console.log("PWA instalable verificada para Android e iPad");
