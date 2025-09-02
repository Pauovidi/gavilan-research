import sharp from "sharp";
import { glob } from "glob";
import { mkdirSync } from "fs";
import { join } from "path";

const SIZES = [640, 960, 1280, 1600];
const IN_DIR  = process.env.IN_DIR  || "media/research/shape-tuning/orig";
const OUT_DIR = process.env.OUT_DIR || "media/research/shape-tuning";

const files = (await glob(`${IN_DIR}/**/*.{png,jpg,jpeg,gif,tif,tiff,bmp,webp}`, { nocase:true }))
  .sort((a,b)=> a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));

mkdirSync(OUT_DIR, { recursive:true });

let idx = 1;
for (const src of files){
  const base = String(idx);
  await sharp(src).webp({ quality: 90 }).toFile(join(OUT_DIR, `${base}.webp`));
  for (const w of SIZES){
    await sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: 85 }).toFile(join(OUT_DIR, `${base}-${w}.webp`));
  }
  console.log(`✓ ${base}.webp`);
  idx++;
}
console.log("Done.");
