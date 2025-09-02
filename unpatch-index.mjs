#!/usr/bin/env node
/**
 * unpatch-index.mjs — Revierte el parche:
 *   1) Opción A (por defecto): elimina el <script id="autoPatch">…</script> del index.html
 *   2) Opción B (--restore): restaura index.bak completo (si existe)
 *
 * Uso:
 *   node unpatch-index.mjs --file ./index.html          # elimina solo el <script id="autoPatch">
 *   node unpatch-index.mjs --file ./index.html --restore # restaura el backup .bak
 */
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv){
  const out = new Map();
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = (i+1 < argv.length && !argv[i+1].startsWith('--')) ? argv[++i] : true;
    out.set(k, v);
  }
  return out;
}

const args = parseArgs(process.argv);
const file = args.get('file') || './index.html';
const restore = args.has('restore');
const abs = path.resolve(process.cwd(), file);

if (!fs.existsSync(abs)){
  console.error(`[unpatch-index] No existe: ${abs}`);
  process.exit(1);
}

if (restore){
  const bak = abs.replace(/\.html?$/i, '.bak');
  if (!fs.existsSync(bak)){
    console.error(`[unpatch-index] No existe backup: ${bak}`);
    process.exit(2);
  }
  fs.copyFileSync(bak, abs);
  console.log(`[unpatch-index] Restaurado desde backup: ${bak} → ${abs}`);
  process.exit(0);
}

let html = fs.readFileSync(abs, 'utf8');
const before = html;

// Elimina solo el bloque <script id="autoPatch"> … </script>
// Soporta minificado y múltiples espacios/nuevas líneas
const re = /\n?\s*<script\b[^>]*\bid=["']autoPatch["'][^>]*>\s*[\s\S]*?<\/script>\s*/i;
if (!re.test(html)){
  console.log('[unpatch-index] No se encontró <script id="autoPatch">. Nada que quitar.');
  process.exit(0);
}
html = html.replace(re, '\n');

fs.writeFileSync(abs, html, 'utf8');
console.log('[unpatch-index] Bloque <script id="autoPatch"> eliminado ✔️');

// OPCIONAL: limpia dobles saltos si quedaron
try {
  let clean = fs.readFileSync(abs, 'utf8').replace(/\n{3,}/g,'\n\n');
  if (clean !== html){ fs.writeFileSync(abs, clean, 'utf8'); }
} catch {}
