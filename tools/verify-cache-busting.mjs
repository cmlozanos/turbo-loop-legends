import { readFile } from "node:fs/promises";

const version = (process.env.VITE_BUILD_VERSION ?? process.env.GITHUB_SHA ?? "local")
  .replace(/[^a-zA-Z0-9_-]/g, "-")
  .slice(0, 12);
const index = await readFile("dist/index.html", "utf8");
const references = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const versionedReferences = references.filter((reference) => /\.(?:js|css|webmanifest)$/.test(reference));

if (versionedReferences.length < 3 || versionedReferences.some((reference) => !reference.includes(version))) {
  throw new Error(`index.html no versiona todos sus estáticos con ${version}`);
}

const entryReference = versionedReferences.find((reference) => reference.endsWith(".js"));
if (!entryReference) throw new Error("No se encontró el JavaScript principal");
const entry = await readFile(`dist/${entryReference.split("/").slice(2).join("/")}`, "utf8");
if (!entry.includes(`?v=${version}`)) throw new Error("Los assets públicos no incluyen la versión del build");

const manifestReference = versionedReferences.find((reference) => reference.endsWith(".webmanifest"));
if (!manifestReference) throw new Error("No se encontró el manifiesto versionado");
const manifest = await readFile(`dist/${manifestReference.split("/").slice(2).join("/")}`, "utf8");
if (!manifest.includes(`?v=${version}`)) throw new Error("El icono de la PWA no incluye la versión del build");

console.log(`Cache busting verificado para ${version}`);
