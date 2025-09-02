// generate-images-manifest.mjs (versión robusta, sin parseVariant)
import { promises as fs } from 'fs';
import path from 'path';

const MEDIA_DIR = path.resolve('./media');
const OUT_FILE  = path.resolve('./content/images-manifest.json');

const EXT_SCORE = { webp: 1, avif: 2, jpg: 3, jpeg: 3, png: 4 };
const IMG_EXTS = new Set(Object.keys(EXT_SCORE));

// --- helpers ---
const relPosix = (abs) => {
  let rel = path.relative(process.cwd(), abs).replace(/\\/g,'/');
  if (!rel.startsWith('./') && !rel.startsWith('../')) rel = './' + rel;
  return rel;
};

// quita sufijos “responsive” del nombre base
function stripResponsiveTail(base) {
  if (/(?:[._-])\d{2,4}x\d{2,4}$/i.test(base)) return base.replace(/(?:[._-])\d{2,4}x\d{2,4}$/i,'');
  if (/(?:@|[._-])\d{1,2}x$/i.test(base))       return base.replace(/(?:@|[._-])\d{1,2}x$/i,'');
  if (/(?:[._-])\d{2,4}(?:w|px)$/i.test(base))  return base.replace(/(?:[._-])\d{2,4}(?:w|px)$/i,'');
  if (/(?:[._-])\d{2,4}$/i.test(base))          return base.replace(/(?:[._-])\d{2,4}$/i,'');
  return base;
}

// ancho estimado desde el nombre (si no está claro, devolvemos null y no pasa nada)
function widthFromName(base) {
  let m = base.match(/(?:[._-])(\d{2,4})(?:w|px)?$/i);
  if (m) return parseInt(m[1],10);
  m = base.match(/(?:[._-])(\d{2,4})x\d{2,4}$/i);
  if (m) return parseInt(m[1],10);
  return null; // @2x y similares no aportan ancho absoluto
}

async function walk(dir, out=[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(abs, out);
    } else {
      const ext = path.extname(e.name).slice(1).toLowerCase();
      if (IMG_EXTS.has(ext)) out.push(abs);
    }
  }
  return out;
}

function groupByKey(files) {
  const groups = new Map();
  for (const abs of files) {
    const ext  = path.extname(abs).slice(1).toLowerCase();
    const dir1 = path.basename(path.dirname(abs)); // carpeta inmediata dentro de /media
    const file = path.basename(abs, path.extname(abs));
    const base = stripResponsiveTail(file);
    const key  = `${dir1}/${base}`;                // p.ej. hero/imagen

    const arr = groups.get(key) || [];
    arr.push({ abs, ext, dir1, file, base });
    groups.set(key, arr);
  }
  return groups;
}

function pickOriginal(candidates) {
  // preferimos el que NO tiene sufijo y mejor formato
  const pure = candidates.filter(c => c.file === c.base);
  const list = (pure.length ? pure : candidates).slice().sort((a,b)=>{
    const sa = EXT_SCORE[a.ext] ?? 99;
    const sb = EXT_SCORE[b.ext] ?? 99;
    return sa - sb;
  });
  return list[0];
}

function buildVariants(candidates) {
  const variants = [];
  const seenW = new Set();
  for (const c of candidates) {
    const w = widthFromName(c.file);
    if (w && !seenW.has(w)) {
      variants.push({ path: relPosix(c.abs), w });
      seenW.add(w);
    }
  }
  variants.sort((a,b)=>a.w-b.w);
  return variants;
}

async function main(){
  // comprobar media/
  try { await fs.access(MEDIA_DIR); }
  catch { console.error('❌ No encuentro la carpeta ./media'); process.exit(1); }

  // asegurar content/
  await fs.mkdir(path.resolve('./content'), { recursive: true });

  const files  = await walk(MEDIA_DIR);
  const groups = groupByKey(files);

  const manifest = {};
  for (const [key, items] of groups) {
    try {
      const original = pickOriginal(items);
      const variants = buildVariants(items);
      manifest[key] = {
        original: relPosix(original.abs),
        variants
      };
    } catch (err) {
      // nunca romper: si algo raro pasa con ese grupo, lo saltamos
      console.warn('⚠️  Grupo omitido por nombre raro:', key, '–', err?.message || err);
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a],[b]) => a.localeCompare(b))
  );
  await fs.writeFile(OUT_FILE, JSON.stringify(sorted, null, 2), 'utf8');

  console.log(`✅ Manifest creado: ${relPosix(OUT_FILE)}  (entradas: ${Object.keys(sorted).length})`);
}

main().catch(err => {
  console.error('❌ Error generando manifest:', err);
  process.exit(1);
});
