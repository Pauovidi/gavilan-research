// apply-patches.mjs
// Aplica 4 cambios puntuales sobre index.html:
// - Helpers con normalizePath + buildImgAttrs + imgAttrs (robustos)
// - HEADER desde content/header.json
// - HERO desde content/hero.json (gallery o images)
// - FOOTER desde content/footer.json
// - CSS About (alineado arriba, centrado, -30% ancho)
//
// Uso: node apply-patches.mjs

import fs from 'fs';
import path from 'path';

const FILE = 'index.html';
if (!fs.existsSync(FILE)) {
  console.error('❌ No encuentro index.html en la carpeta actual.');
  process.exit(1);
}

// --- Utilidades ---
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backup = `index.backup-${stamp}.html`;

function saveBackup(src, dest){
  fs.copyFileSync(src, dest);
  console.log(`🗂️  Backup creado: ${dest}`);
}

function replaceOrInsert(text, findRe, replacement, insertAnchorRe, where='after') {
  if (findRe.test(text)) {
    return text.replace(findRe, replacement);
  }
  // insertar si no existe
  const m = text.match(insertAnchorRe);
  if (!m) return text + '\n' + replacement + '\n';
  if (where === 'before') {
    return text.replace(insertAnchorRe, `${replacement}\n$&`);
  } else {
    // after
    const idx = m.index + m[0].length;
    return text.slice(0, idx) + `\n${replacement}\n` + text.slice(idx);
  }
}

function ensureCSSBlock(html, css) {
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/i;
  const m = html.match(styleRe);
  if (!m) {
    // no hay <style>, creamos uno en <head>
    return html.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`);
  }
  const full = m[0], inner = m[1];
  if (inner.includes('#about .about-grid') && inner.includes('#about_figure img')) {
    console.log('✅ CSS About ya presente (detectado).');
    return html;
  }
  const newStyle = full.replace(inner, inner + '\n\n/* === PATCH About === */\n' + css);
  return html.replace(styleRe, newStyle);
}

// --- Cargar HTML ---
let html = fs.readFileSync(FILE, 'utf8');
saveBackup(FILE, backup);

// --- 1) Helpers: normalizePath + buildImgAttrs + imgAttrs ---
// Intentamos sustituir bloques previos de estas funciones si existen.
const helpersReplacement = `\
    /* ===== Helpers fetch/DOM ===== */
    function setText(id,v){const el=document.getElementById(id); if(el) el.textContent=v??"";}
    function setHTML(id,v){const el=document.getElementById(id); if(el) el.innerHTML=v??"";}
    async function loadJSON(p){try{const r=await fetch(p,{cache:'no-store'}); if(!r.ok) return null; return await r.json();}catch{ return null; }}

    /* ===== Responsive images helpers (con \\\\ → / y con/sin manifest) ===== */
    let IMG_MANIFEST = {};
    function normalizePath(p){
      let s = String(p||"").replace(/\\\\/g,'/').replace(/^\\.\\//,'').replace(/^\\//,'');
      if (!/^https?:\\/\\//i.test(s)) s = './' + s;
      if (s.startsWith('media/')) s = './' + s;
      return s;
    }
    function buildImgAttrs(inputPath, defaultSizes="(max-width: 680px) 100vw, 360px") {
      const safePath = normalizePath(inputPath);
      if (!safePath) return { src: "", srcset: "", sizes: "" };
      const parts = safePath.replace(/^[.][\\/\\\\]*/,'').split('/');
      if (parts.length < 3) return { src: safePath, srcset: "", sizes: "" };
      const dir  = parts[1];
      const file = parts[parts.length - 1];
      const base = file.replace(/\\.[^.]+$/,'').replace(/-(\\d{2,4})$/,'');
      const key  = \`\${dir}/\${base}\`;
      const entry = IMG_MANIFEST[key];
      if (!entry) return { src: safePath, srcset: "", sizes: "" };
      const src    = entry.original || (entry.variants?.length ? entry.variants[entry.variants.length-1].path : safePath);
      const srcset = entry.variants?.length ? entry.variants.map(v => \`\${normalizePath(v.path)} \${v.w}w\`).join(', ') : "";
      return { src: normalizePath(src), srcset, sizes: srcset ? defaultSizes : "" };
    }
    function imgAttrs(path, sizes){
      const a = buildImgAttrs(path, sizes);
      const s = [\`src="\${a.src}"\`];
      if (a.srcset) s.push(\`srcset="\${a.srcset}"\`);
      if (a.sizes)  s.push(\`sizes="\${a.sizes}"\`);
      return s.join(' ');
    }`;

const helpersFindRe = /\/\*\s*=====?\s*Responsive images helpers[\s\S]*?function\s+imgAttrs\s*\([\s\S]*?\}\s*/i;
const scriptOpenRe  = /<script\b[^>]*>/i;
html = replaceOrInsert(html, helpersFindRe, helpersReplacement, scriptOpenRe, 'after');
console.log('✅ Helpers actualizados.');


// --- 2) HEADER block (solo JSON) ---
const headerReplacement = `\
      /* HEADER (content/header.json) */
      try{
        const hdr = await loadJSON("./content/header.json");
        if (hdr?.logos?.length) {
          const cont   = document.getElementById("header_logos");
          const single = document.getElementById("site_logo");
          if (cont) {
            cont.innerHTML = hdr.logos.map(l => \`
              <a \${l.href ? \`href="\${l.href}"\` : ""} aria-label="\${l.alt||'Logo'}">
                <img \${imgAttrs(normalizePath(l.src), "(max-width: 600px) 40vw, 200px")} alt="\${l.alt||'Logo'}">
              </a>\`).join("");
          } else if (single) {
            const main = hdr.logos[0];
            single.outerHTML = \`
              <a \${main.href ? \`href="\${main.href}"\` : ""} aria-label="\${main.alt||'Logo'}">
                <img \${imgAttrs(normalizePath(main.src), "(max-width: 600px) 40vw, 200px")} alt="\${main.alt||'Logo'}">
              </a>\`;
          }
        }
      } catch(e){ console.warn('header.json:', e); }`;

const headerFindRe = /\/\*\s*HEADER\b[\s\S]*?catch\([^)]*\)\s*\{\s*console\.warn\([\s\S]*?header\.json[\s\S]*?\}\s*\}/i;
const bootStartRe  = /\(\s*async\s+function\s+boot\s*\([\s\S]*?\)\s*\{/i;
html = replaceOrInsert(html, headerFindRe, headerReplacement, bootStartRe, 'after');
console.log('✅ HEADER parcheado.');


// --- 3) HERO block (solo JSON, soporta "gallery" y "images") ---
const heroReplacement = `\
      /* HERO (content/hero.json) */
      try{
        const hero = await loadJSON("./content/hero.json");
        if (hero) {
          setText("hero_kicker", hero.kicker ?? "");
          setText("hero_title",  hero.title  ?? "");
          setText("hero_sub",    hero.subtitle ?? "");
          setHTML("hero_intro",  hero.intro ?? "");
          const cta = document.getElementById("hero_cta");
          if (cta && hero?.cta?.label) {
            cta.style.display='inline-flex';
            cta.textContent = hero.cta.label;
            cta.href = hero.cta.href || "#";
          }
          const list = Array.isArray(hero.gallery) ? hero.gallery
                      : Array.isArray(hero.images) ? hero.images : [];
          if (list.length) {
            const wrap = document.getElementById("hero_gallery");
            if (wrap) {
              wrap.innerHTML = list.slice(0,4).map(h => \`
                <figure data-reveal>
                  <img \${imgAttrs(normalizePath(h.src), "(max-width: 1200px) 100vw, 900px")} alt="\${h.alt||''}">
                </figure>\`).join("");
            }
            const dlg  = document.getElementById("heroDialog");
            const grid = document.getElementById("hero_dialog_gallery");
            if (grid) {
              grid.innerHTML = list.map(h => \`
                <figure class="card">
                  <img \${imgAttrs(normalizePath(h.src), "(max-width: 1200px) 100vw, 900px")} alt="\${h.alt||''}">
                </figure>\`).join("");
            }
            const openBtn  = document.getElementById("hero_viewall");
            const closeBtn = document.getElementById("hero_dialog_close");
            openBtn?.addEventListener('click', () => dlg.showModal());
            closeBtn?.addEventListener('click', () => dlg.close());
            dlg?.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
          }
        }
      } catch(e){ console.warn('hero.json:', e); }`;

const heroFindRe = /\/\*\s*HERO\b[\s\S]*?catch\([^)]*\)\s*\{\s*console\.warn\([\s\S]*?hero\.json[\s\S]*?\}\s*\}/i;
html = replaceOrInsert(html, heroFindRe, heroReplacement, bootStartRe, 'after');
console.log('✅ HERO parcheado.');


// --- 4) FOOTER block (solo JSON) ---
const footerReplacement = `\
      /* FOOTER (content/footer.json) */
      try{
        const f = await loadJSON("./content/footer.json");
        const wrap = document.getElementById('footer_logos');
        if (wrap && f?.items?.length) {
          wrap.innerHTML = f.items.map(l => \`
            <a href="\${l.href||'#'}" target="_blank" rel="noopener">
              <img src="\${normalizePath(l.src)}" alt="\${l.alt||''}">
            </a>\`).join("");
        }
      } catch(e){ console.warn('footer.json:', e); }`;

const footerFindRe = /\/\*\s*FOOTER\b[\s\S]*?catch\([^)]*\)\s*\{\s*console\.warn\([\s\S]*?footer\.json[\s\S]*?\}\s*\}/i;
html = replaceOrInsert(html, footerFindRe, footerReplacement, bootStartRe, 'after');
console.log('✅ FOOTER parcheado.');


// --- 5) CSS About (alinear arriba, centrar y -30% ancho) ---
const aboutCSS = `
#about .about-grid{
  grid-template-columns: minmax(0, 420px) minmax(0, 560px);
  column-gap: clamp(12px, 2vw, 20px);
  justify-content: center;
  align-items: start;
}
#about_figure{ align-self: start; }
#about_figure img{ width: clamp(182px, 25vw, 294px); }`;

html = ensureCSSBlock(html, aboutCSS);
console.log('✅ CSS About aplicado.');

// --- Guardar resultado ---
fs.writeFileSync(FILE, html, 'utf8');
console.log('🎉 Parches aplicados a index.html');
