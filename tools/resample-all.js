// Requiere: npm i -D sharp glob
import sharp from "sharp";
import { glob } from "glob";
import { mkdir, stat } from "node:fs/promises";
import { join, normalize } from "node:path";

sharp.concurrency(0); // auto (usa todos los hilos disponibles)

// Config
const INPUT_GLOB = "media/research/*/orig/**/*.{png,jpg,jpeg,gif,tif,tiff,bmp,webp}";
const SIZES = [640, 960, 1280, 1600];
const QUALITY_MAIN = 90; // 1.webp
const QUALITY_VAR  = 85; // 1-640.webp, etc.

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getSlugFromInputPath(p) {
  // .../media/research/<slug>/orig/....
  const parts = normalize(p).split(/[/\\]+/);
  const i = parts.findIndex(x => x === "research");
  return i >= 0 ? parts[i + 1] : null;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function processFolder(filesInFolder, slug) {
  const outDir = `media/research/${slug}`;
  await ensureDir(outDir);

  // Orden estable
  filesInFolder.sort(naturalSort);

  let idx = 1;
  for (const src of filesInFolder) {
    try {
      // Carga
      const img = sharp(src, { failOnError: false }).rotate(); // respeta orientación EXIF
      const meta = await img.metadata();
      if (!meta.width || !meta.height) {
        console.warn("⚠️  Saltada (sin dimensiones):", src);
        continue;
      }

      // 1) Versión base (sin ampliar)
      await img.webp({ quality: QUALITY_MAIN }).toFile(join(outDir, `${idx}.webp`));

      // 2) Variantes responsivas
      for (const w of SIZES) {
        await sharp(src, { failOnError: false })
          .rotate()
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: QUALITY_VAR })
          .toFile(join(outDir, `${idx}-${w}.webp`));
      }

      console.log(`✓ ${slug}/${idx}.webp (+${SIZES.length} variantes)`);
      idx++;
    } catch (err) {
      console.error("❌ Error con:", src, "\n", err?.message || err);
    }
  }
}

(async function main() {
  // 1) Encontrar todos los ficheros dentro de cualquier /orig
  const all = (await glob(INPUT_GLOB, { nocase: true, windowsPathsNoEscape: true }))
    .map(p => normalize(p));

  if (all.length === 0) {
    console.log("No se han encontrado imágenes en media/research/*/orig/. ¿Ruta correcta?");
    process.exit(0);
  }

  // 2) Agrupar por slug
  const bySlug = new Map();
  for (const p of all) {
    const slug = getSlugFromInputPath(p);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(p);
  }

  // 3) Procesar cada carpeta/slug
  for (const [slug, files] of bySlug) {
    console.log(`\n➡️  Procesando ${slug} (${files.length} ficheros en /orig)`);
    await processFolder(files, slug);
  }

  console.log("\n🎉 Hecho. Comprueba media/research/<slug>/");
})();
