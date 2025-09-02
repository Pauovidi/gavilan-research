// fix-hero-header-about.js
const fs = require('fs');
const FILE = 'index.html';

if (!fs.existsSync(FILE)) {
  console.error('No encuentro index.html en esta carpeta.');
  process.exit(1);
}

let html = fs.readFileSync(FILE, 'utf8');
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
fs.writeFileSync(`${FILE}.bak-${stamp}`, html, 'utf8'); // backup

// 1) Asegurar que el manifest se carga al inicio del boot()
html = html.replace(
  /\(\s*async\s*function\s*boot\s*\(\)\s*\{\s*/,
  m => `${m}  IMG_MANIFEST = (await loadJSON("./content/images-manifest.json")) || {};\n`
);

// 2) Hacer que buildHeroSlider use srcset/sizes del manifest
html = html.replace(
  /function\s+buildHeroSlider\([\s\S]*?\}\s*\n/gm,
  `
function buildHeroSlider(images){
  const track = document.getElementById('heroTrack');
  const prev  = document.getElementById('heroPrev');
  const next  = document.getElementById('heroNext');
  const list  = Array.isArray(images) ? images : [];

  track.innerHTML = (list.length ? list : [{src:"./media/hero/hero.webp",alt:"Hero"}])
    .map((it,i)=>\`
      <div class="slide">
        <img \${imgAttrs(it.src, "(max-width: 1200px) 100vw, 1200px")}
             alt="\${it.alt||''}" loading="\${i===0?'eager':'lazy'}"
             \${i===0?'fetchpriority="high"':''} decoding="async">
      </div>\`).join('');

  const width = ()=>track.clientWidth;
  const slides=()=>Array.from(track.children);
  const index = ()=>Math.round(track.scrollLeft/width());
  const wrap  = i => { const N=slides().length; return (i%N+N)%N; };
  const goTo  = i => track.scrollTo({left:wrap(i)*width(),behavior:'smooth'});
  const nextFn=()=>goTo(index()+1), prevFn=()=>goTo(index()-1);

  prev.onclick=prevFn; next.onclick=nextFn;

  let timer=null, hovering=false;
  const stop = ()=>{ if(timer){ clearInterval(timer); timer=null; } };
  const start= ()=>{ stop(); if(slides().length>1) timer=setInterval(()=>{ if(!hovering && !document.hidden) nextFn(); }, 3000); };

  track.addEventListener('mouseenter',()=>{ hovering=true;  stop(); });
  track.addEventListener('mouseleave',()=>{ hovering=false; start(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) stop(); else start(); });
  window.addEventListener('resize',()=>{ goTo(index()); }, {passive:true});

  slides().forEach(sl=>{
    const im=sl.querySelector('img');
    im.addEventListener('load',()=>im.classList.add('is-loaded'),{once:true});
    im.addEventListener('error',()=>{ sl.remove(); if(slides().length<=1){ prev.style.display=next.style.display='none'; stop(); } },{once:true});
  });

  if(slides().length<=1){ prev.style.display=next.style.display='none'; }
  start();

  // View all (reabrible)
  const openGalleryBtn=document.getElementById('openGallery');
  openGalleryBtn?.addEventListener('click', ()=>{
    let dlg=document.getElementById('galleryDialog');
    const listNow = Array.from(track.querySelectorAll('img')).map(im=>({src: im.currentSrc || im.src, alt: im.alt||''}));
    if(!dlg){
      dlg=document.createElement('dialog');
      dlg.id='galleryDialog';
      dlg.setAttribute('aria-label','Gallery');
      dlg.innerHTML=\`
        <div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid var(--line);background:#fff">
          <strong>Gallery</strong>
          <button class="btn btn-primary" id="closeGallery" type="button">Close</button>
        </div>
        <div id="galleryGrid" style="padding:1rem;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem;max-height:75vh;overflow:auto"></div>\`;
      document.body.appendChild(dlg);
      dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.close(); });
      dlg.addEventListener('cancel',()=>dlg.close());
      dlg.addEventListener('keydown',e=>{ if(e.key==='Escape') dlg.close(); });
      dlg.querySelector('#closeGallery').addEventListener('click',()=>dlg.close());
    }
    const grid=dlg.querySelector('#galleryGrid');
    grid.innerHTML = listNow.map(it=>\`<div class="media-32"><img src="\${it.src}" alt="\${it.alt}"></div>\`).join('');
    dlg.showModal();
  });
}
\n`
);

// 3) Llamar realmente al slider cuando cargamos hero.json
html = html.replace(
  /(const\s+list\s*=\s*Array\.isArray\(hero\.gallery\)\s*\?\s*hero\.gallery[\s\S]*?;\s*)(if\s*\(list\.length\)\s*\{)/,
  (_, a, b) => `${a}\n      buildHeroSlider(list);\n      ${b}`
);

// 4) LOGOS desde header.json → aplica a #brandLeft y #brandRight
html = html.replace(
  /\/\*\s*HEADER\s*\(content\/header\.json\)\s*\*\/[\s\S]*?catch\(e\)\{\s*console\.warn\('header\.json:',\s*e\);\s*\}\s*/m,
  `
/* HEADER (content/header.json) */
try{
  const hdr = await loadJSON("./content/header.json");
  if (hdr?.logos?.length) {
    const [left,right] = hdr.logos;

    // IZQUIERDA
    const leftImg = document.getElementById("brandLeft");
    if (leftImg && left) {
      const a = leftImg.closest('a');
      leftImg.outerHTML = \`<img class="brand-logo" \${imgAttrs(left.src,"(max-width: 600px) 40vw, 200px")} alt="\${left.alt||'Logo'}">\`;
      if (a && left.href) a.href = left.href;
    }

    // DERECHA
    const rightImg = document.getElementById("brandRight");
    if (rightImg && right) {
      rightImg.outerHTML = \`<img id="brandRight" \${imgAttrs(right.src,"(max-width: 600px) 30vw, 160px")} alt="\${right.alt||'Logo'}">\`;
      // si lo quieres linkable, envuélvelo tú con <a> en el HTML
    }
  }
} catch(e){ console.warn('header.json:', e); }
`
);

// 5) Overrides CSS About (alinear arriba, acercar, -30% tamaño)
if (html.includes('</style>')) {
  html = html.replace('</style>', `
/* === PATCH About (alineación & spacing) === */
#about .about-grid{
  grid-template-columns: minmax(0, 420px) minmax(0, 560px);
  column-gap: clamp(12px, 1.6vw, 16px);
  justify-content: center;
  align-items: start;
}
#about_figure{ align-self:start; margin-top:.6rem; }
#about_figure img{ width: clamp(182px, 25vw, 294px); }
/* === /PATCH === */
</style>`);
}

fs.writeFileSync(FILE, html, 'utf8');
console.log('✅ Parche aplicado. Backup ->', `${FILE}.bak-${stamp}`);
