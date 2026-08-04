import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const assetsDirectory = new URL("../dist/assets/", import.meta.url);
const runtimeFiles = readdirSync(assetsDirectory)
  .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
  .map((name) => ({ name, content: readFileSync(join(assetsDirectory.pathname, name), "utf8") }));

const unsupportedRuntimePatterns = [
  ["structuredClone", /\bstructuredClone\s*\(/],
  ["Array.prototype.at", /\.at\s*\(/],
  ["color-mix()", /color-mix\s*\(/],
];

const failures = runtimeFiles.flatMap(({ name, content }) => unsupportedRuntimePatterns
  .filter(([, pattern]) => pattern.test(content))
  .map(([feature]) => `${name}: ${feature}`));

if (failures.length > 0) {
  console.error(`Chrome 95 incompatible runtime features:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Chrome 95 compatibility verified in ${runtimeFiles.length} runtime assets`);
