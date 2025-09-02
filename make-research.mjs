// make-research.mjs
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const exts = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"];
const args = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = s.match(/^--([^=]+)=?(.*)$/); return [m[1], m[2] || true];
}));

// ---- CLI ----
const SRC   = args.src || "";                    // carpeta con materiales
const SLUG  = (args.slug || "").toLowerCase();   // slug destino
const TITLE = args.title || "";                  // título (si no hay title.txt)
const YEAR  = args.year  || "";                  // opcional
const OUTJ  = args.outjson  || "./content/research";
const OUTM  = args.outmedia || "./media/research";
const MAXW  = parseInt(args.maxw || "1600", 10); // máx ancho para webp
const Q     = parseInt(args.quality || "82", 10);
if (!SRC || !SLUG) {
  console.error("Uso: node make-research.mjs --src=./_incoming/animag --slug=animag [--title=\"AniMAG\"] [--year=2023]");
  process.exit(1);
}

// ---- utils ----
const exists = async p => !!(await fs.stat(p).catch(()=>null));
const readIf = async p => (await exists(p)) ? String(await fs.readFile(p)) : "";
const listFiles = async (dir) => (await fs.readdir(dir, { withFileTypes:true }))
  .filter(d=>d.isFile() && exts.includes(path.extname(d.name).toLowerCase()))
  .map(d=>path.join(dir, d.name))
  .sort((a,b)=> a.localeCompare(b, undefined, { numeric:true, sensitivity:"base" }));

function mdToHtml(md){
  if (!md) return "";
  let html = String(md).trim();
  html = html.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // enlaces: [texto](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  // negrita/itálica simples
  html = html.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>");
  // párrafos
  html = "<p>" + html.replace(/\r\n/g,"\n").split(/\n{2,}/).map(p=>p.replace(/\n/g,"<br>")).join("</p><p>") + "</p>";
  return html;
}

async function ensureDir(p){ await fs.mkdir(p, { recursive:true }); }

// ---- 1) Lee metadatos de la carpeta ----
const titleTxt = (await readIf(path.join(SRC, "title.txt"))).trim();
const summaryMd = (await readIf(path.join(SRC, "summary.md"))).trim()
               || (await readIf(path.join(SRC, "summary.txt"))).trim();
const descMd    = (await readIf(path.join(SRC, "description.md"))).trim()
               || (await readIf(path.join(SRC, "description.txt"))).trim();

let papers = [];
const papersJson = path.join(SRC, "papers.json");
if (await exists(papersJson)) {
  try { papers = JSON.parse(await fs.readFile(papersJson, "utf-8")); } catch {}
} else {
  const papersTxt = (await readIf(path.join(SRC, "papers.txt"))).trim();
  if (papersTxt){
    // formato: Label | URL (una por línea)
    papers = papersTxt.split(/\r?\n/).map(line=>{
      const m = line.split("|");
      if (m.length>=2) return { label: m[0].trim(), url: m[1].trim() };
      const url = line.trim(); if (url.startsWith("http")) return { label:"Open", url };
      return null;
    }).filter(Boolean);
  }
}

// --- reemplaza el bloque de generación de imágenes por este ---
const SIZES = [640, 960, 1280, 1600];   // ← ajusta aquí tus anchos
const outImages = [];
let i = 1;

for (const f of files){
  const baseOut = path.join(outMediaDir, `${i}.webp`);
  const img = sharp(f);
  const meta = await img.metadata().catch(()=> ({}));
  const w = meta.width || MAXW;

  // 1) Base (i.webp)
  await img.resize({ width: Math.min(MAXW, w), withoutEnlargement:true })
          .toFormat("webp", { quality: Q, effort: 4 })
          .toFile(baseOut);

  // 2) Variantes responsive (i-640.webp, i-960.webp, ...)
  await Promise.all(
    SIZES.map(sz =>
      sharp(f).resize({ width: Math.min(sz, w), withoutEnlargement:true })
              .toFormat("webp", { quality: Q, effort: 4 })
              .toFile(path.join(outMediaDir, `${i}-${sz}.webp`))
    )
  );

  outImages.push(path.join("./media/research", SLUG, `${i}.webp`).replace(/\\/g,"/"));
  i++;
}

let j = 1;

for (const f of files){
  const out = path.join(outMediaDir, `${j}.webp`);
  const img = sharp(f);
  const meta = await img.metadata().catch(()=> ({}));
  const w = meta.width || MAXW;
  const pipeline = img.resize({ width: Math.min(MAXW, w), withoutEnlargement:true })
                     .toFormat("webp", { quality: Q, effort: 4 });
  await pipeline.toFile(out);
  outImages.push(path.join("./media/research", SLUG, `${j}.webp`).replace(/\\/g,"/"));
  j++;
}

// ---- 3) Arma el JSON ----
const data = {
  slug: SLUG,
  title: TITLE || titleTxt || SLUG,
  year: YEAR,
  summary: summaryMd || "",
  descriptionHtml: mdToHtml(descMd || ""),
  images: outImages,
  papers: Array.isArray(papers) ? papers.filter(p=>p && p.url) : []
};

await ensureDir(OUTJ);
const outJson = path.join(OUTJ, `${SLUG}.json`);
await fs.writeFile(outJson, JSON.stringify(data, null, 2), "utf-8");

console.log("✔ JSON:", outJson);
console.log("✔ Imágenes:", outMediaDir);
console.log(`   (${outImages.length} imagen/es)`);
