// optimize-one.mjs
// Procesa SOLO 1 imagen (o varias si pasas varias --in) sin tocar el resto.
// Uso básico:
//   node optimize-one.mjs --in "media/raw/team/foto.jpg" --out "media/team"
//
// Flags opcionales:
//   --sizes 320,480,640,800    (por defecto)
//   --format webp              (webp|avif|jpg|png)
//   --quality 80
//   --style single             (single => nombre-W.webp, double => nombre_W-H.webp)
//   --overwrite                (reemplaza si ya existe)
//   --dry-run

import fs from "fs/promises";
import fss from "fs";
import path from "path";
import sharp from "sharp";

const args = process.argv.slice(2);
const getArg = (k, def=null) => {
  const i = args.indexOf(k);
  return i !== -1 ? args[i+1] : def;
};
const has = (k) => args.includes(k);

const inputs = [];
for (let i=0;i<args.length;i++){
  if (args[i] === "--in" && args[i+1]) inputs.push(args[i+1]);
}
if (inputs.length === 0) {
  console.error("Uso: node optimize-one.mjs --in <ruta/imagen> [--in <otra>] [--out <dir>]");
  process.exit(1);
}

const outDir   = getArg("--out", null);
const sizesStr = getArg("--sizes", "320,480,640,800");
const sizes    = sizesStr.split(",").map(s => parseInt(s,10)).filter(Boolean);
const format   = (getArg("--format","webp")||"webp").toLowerCase();
const quality  = parseInt(getArg("--quality","80"),10);
const style    = (getArg("--style","single")||"single").toLowerCase(); // single | double
const overwrite= has("--overwrite");
const dryRun   = has("--dry-run");

const validExt = new Set([".jpg",".jpeg",".png",".webp",".avif"]);
const encoderOpts = (f,q)=>(
  f==="avif" ? { quality:q } :
  f==="jpg" || f==="jpeg" ? { quality:q, mozjpeg:true } :
  f==="png" ? {} :
  { quality:q } // webp default
);

async function ensureDir(dir){ await fs.mkdir(dir, { recursive:true }); }

async function processOne(inputPath){
  const absIn = path.resolve(inputPath);
  if (!fss.existsSync(absIn)) {
    console.warn("[SKIP] No existe:", inputPath); return;
  }
  const ext = path.extname(absIn).toLowerCase();
  if (!validExt.has(ext)) {
    console.warn("[SKIP] Extensión no soportada:", inputPath); return;
  }

  // out por defecto = misma carpeta que la imagen
  const outBaseDir = path.resolve(outDir || path.dirname(absIn));
  await ensureDir(outBaseDir);

  const base = path.basename(absIn, ext);

  // metadatos para calcular alto en modo "double"
  const meta = await sharp(absIn).metadata();
  const w0 = meta.width || 0;
  const h0 = meta.height || 0;

  for (const w of sizes){
    // calcula alto estimado manteniendo aspecto (solo para nombre "double")
    const h = (w0 && h0) ? Math.round(h0 * (w / w0)) : null;

    const outName = style === "double" && h
      ? `${base}_${w}-${h}.${format}`
      : `${base}-${w}.${format}`;

    const outPath = path.join(outBaseDir, outName);

    if (!overwrite && fss.existsSync(outPath)) {
      console.log("[EXISTE] →", outPath);
      continue;
    }

    console.log(dryRun ? "[DRY]" : "[GEN]", outPath);
    if (dryRun) continue;

    let pipeline = sharp(absIn).resize({ width:w });
    const opts = encoderOpts(format, quality);
    if (format === "avif") pipeline = pipeline.avif(opts);
    else if (format === "jpg" || format === "jpeg") pipeline = pipeline.jpeg(opts);
    else if (format === "png") pipeline = pipeline.png(opts);
    else pipeline = pipeline.webp(opts); // webp

    await pipeline.toFile(outPath);
  }
}

const main = async ()=>{
  console.log("[optimize-one] inputs:", inputs);
  if (dryRun) console.log("[DRY-RUN] Simulación, no se escribirán archivos.");
  for (const p of inputs) await processOne(p);
  console.log("✓ Hecho.");
};

main().catch(e=>{ console.error(e); process.exit(1); });
