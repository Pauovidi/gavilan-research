// make-logo-variants.mjs
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = new Map(process.argv.slice(2).map(a=>{
  const [k,v] = a.split("=");
  return [k.replace(/^--/,''), v ?? true];
}));

const SRC = args.get("src") || "./media/home/QUIMICAS_COLOR_SOLO_BLANCO.webp";
const MANIFEST_PATH = args.get("manifest") || "./content/images-manifest.json";
const SIZES = (args.get("sizes") || "640,800,1200").split(",").map(n=>parseInt(n,10));

function keyFor(p){
  // ./media/home/QUIMICAS_COLOR_SOLO_BLANCO.webp → "home/QUIMICAS_COLOR_SOLO_BLANCO"
  const rel = p.replace(/^[.][/\\]*/, "").split("/");
  const dir = rel[1];
  const base = rel.at(-1).replace(/\.[^.]+$/,"");
  return `${dir}/${base}`;
}
function outPath(src, w, ext){
  const base = src.replace(/\.[^.]+$/,"");
  return `${base}-${w}.${ext}`;
}

async function ensureManifest(pathname){
  try{
    const txt = await fs.readFile(pathname, "utf-8");
    return JSON.parse(txt);
  }catch{
    return {};
  }
}

(async () => {
  // 1) Generar variantes
  const srcBuf = await fs.readFile(SRC);
  const tasks = [];

  for (const w of SIZES){
    // webp para todos los tamaños
    tasks.push(
      sharp(srcBuf).resize({ width: w, withoutEnlargement: true })
        .toFormat("webp", { quality: 88, effort: 4 })
        .toFile(outPath(SRC, w, "webp"))
    );
  }
  // avif en anchos “grandes” (800 y 1200 por defecto)
  for (const w of SIZES.filter(n => n >= 800)){
    tasks.push(
      sharp(srcBuf).resize({ width: w, withoutEnlargement: true })
        .toFormat("avif", { quality: 60, effort: 4 })
        .toFile(outPath(SRC, w, "avif"))
    );
  }
  await Promise.all(tasks);

  // 2) Actualizar manifest
  const manifest = await ensureManifest(MANIFEST_PATH);
  const key = keyFor(SRC);
  const variants = [];

  for (const w of SIZES){
    variants.push({ path: outPath(SRC, w, "webp"), w });
  }
  for (const w of SIZES.filter(n => n >= 800)){
    variants.push({ path: outPath(SRC, w, "avif"), w });
  }
  // Ordena por ancho ascendente
  variants.sort((a,b)=>a.w-b.w);

  manifest[key] = {
    original: SRC,
    variants
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`✔ Variantes generadas y manifest actualizado para ${key}`);
})();
