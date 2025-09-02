// optimize-images.mjs
// Genera variantes responsive en TODAS las carpetas bajo ./media/
// Uso: node optimize-images.mjs

import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { existsSync } from "node:fs";

const ROOT = "./media";
const SIZES = [320, 480, 640, 800];
const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function processDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await processDir(full);
    } else {
      const ext = extname(e.name).toLowerCase();
      if (!EXTS.has(ext)) continue;
      const name = basename(e.name, ext);
      for (const w of SIZES) {
        const outFile = join(dir, `${name}-${w}.webp`);
        if (!existsSync(outFile)) {
          await sharp(full)
            .resize({ width: w })
            .toFormat("webp", { quality: 80 })
            .toFile(outFile);
          console.log("✅", outFile);
        }
      }
    }
  }
}

await processDir(ROOT);
console.log("🎉 Variantes generadas en todas las secciones.");
