#!/usr/bin/env node
/**
 * patch-index.mjs — Parcheador único, idempotente y sin warnings.
 *
 * Inserta o reemplaza (UPSERT) dos bloques justo antes de </body>:
 *   <style id="autoPatch-style"> … </style>
 *   <script id="autoPatch"> … </script>
 *
 * No toca nada más del HTML. No reordena el header. Solo rellena logos/hero en runtime.
 *
 * Uso:
 *   node patch-index.mjs --file ./index.html
 */
import fs from 'node:fs';
import path from 'node:path';

function argsMap(argv){
  const m = new Map();
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = (i+1<argv.length && !argv[i+1].startsWith('--')) ? argv[++i] : true;
    m.set(k, v);
  }
  return m;
}

const args = argsMap(process.argv);
const file = args.get('file') || './index.html';
const abs  = path.resolve(process.cwd(), file);
if (!fs.existsSync(abs)) { console.error(`[patch] No existe: ${abs}`); process.exit(1); }

let html = fs.readFileSync(abs, 'utf8');
const bak = abs.replace(/\.html?$/i, '.bak');
fs.writeFileSync(bak, html, 'utf8');
console.log(`[patch] Backup creado: ${bak}`);

function upsertBlock(markup, tag, id, inner){
  const full = new RegExp(`<${tag}[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/${tag}>`, 'i');
  const block = `<${tag} id="${id}">\n${inner}\n</${tag}>`;
  if (full.test(markup)) return markup.replace(full, block);
  if (!/<\/body>/i.test(markup)) throw new Error('No </body> para inyectar');
  return markup.replace(/<\/body>/i, `${block}\n</body>`);
}

// ===== STYLE (ratio uniforme Projects) =====
const styleInner = `
  /* Projects: misma proporción sin tocar plantillas */
  #projects_list .media-32,
  #projects_list .media-34,
  #projects_list .media-uniform{
    aspect-ratio: var(--projects-ratio, 3 / 2);
    border-radius: var(--radius, 8px);
    overflow: hidden;
    background:#fff;
    border:1px solid var(--line, #E3E8F0);
  }
  #projects_list .media-32>img,
  #projects_list .media-34>img,
  #projects_list .media-uniform>img{ width:100%; height:100%; object-fit:cover; display:block }
  /* Hero: oculta flechas si solo hay 1 */
  #heroCarousel.single .ctrl{ display:none }
`;

// ===== SCRIPT (header + hero solo con hero.json) =====
const scriptInner = `
(function(){
  var $ = function(id){ return document.getElementById(id) };
  function norm(p){ return String(p||'').replace(/\\/g,'/') }
  function ext(s){ var m=String(s).toLowerCase().match(/\.[a-z0-9]+$/); return m?m[0]:'' }
  function fname(s){ return String(s).split('/').pop() }
  function stripExt(n){ return n.replace(/\.[^.]+$/,'') }
  function stripTail(b){ return b.replace(/([._-])(?:\d{3,4}x\d{3,4}|@?\d+x|\d{2,4}w?)$/i,'') }
  function baseName(s){ return stripTail(stripExt(fname(s))).toLowerCase() }
  function dedupePreferWebp(list){
    var EXT=['.webp','.avif','.jpg','.jpeg','.png'];
    var g=new Map();
    (list||[]).forEach(function(it){ var k=baseName(it.src||''); var arr=g.get(k); if(!arr){arr=[]; g.set(k,arr)} arr.push(it) });
    var out=[]; g.forEach(function(arr){ arr.sort(function(a,b){ return EXT.indexOf(ext(a.src))-EXT.indexOf(ext(b.src)) }); out.push(arr[0]) });
    return out;
  }
  function j(p){ return fetch(p,{cache:'no-store'}).then(function(r){return r.ok? r.json(): null}).catch(function(){return null}) }
  function first(paths){ return (async function(){ for (var i=0;i<paths.length;i++){ var x=await j(paths[i]); if(x) return x } return null })() }

  (async function run(){
    // HEADER (no reordena, solo rellena)
    try{
      var header = await first(['./content/header.json','./header.json']);
      if(header && Array.isArray(header.logos)){
        var left=header.logos[0]||null, right=header.logos[1]||null;
        var leftImg=$('brandLeft');
        if(leftImg && left && left.src){
          leftImg.src=norm(left.src); leftImg.alt=left.alt||leftImg.alt||'';
          leftImg.onerror=function(){ this.onerror=null; if(this.src.endsWith('.webp')) this.src=this.src.replace(/\.webp$/i,'.png'); };
          var leftA=document.querySelector('header.site .brand');
          if(leftA && left.href && left.href!=='#') leftA.href=left.href;
        }
        var rightWrap=document.querySelector('header.site .brand-right');
        if(rightWrap && right && right.src){
          var el=right.href?document.createElement('a'):document.createElement('span');
          if(right.href){ el.href=right.href; el.target='_blank'; el.rel='noopener'; }
          el.innerHTML='<img id="brandRight" alt="'+(right.alt||'logo')+'">';
          rightWrap.innerHTML=''; rightWrap.appendChild(el);
          var rImg=rightWrap.querySelector('#brandRight');
          rImg.src=norm(right.src);
          rImg.onerror=function(){ this.onerror=null; if(this.src.endsWith('.webp')) this.src=this.src.replace(/\.webp$/i,'.png'); };
        }
      }
    }catch(e){ console.warn('header patch failed', e); }

    // HERO (EXCLUSIVO hero.json)
    try{
      var hero=await first(['./content/hero.json','./hero.json']);
      if(hero){
        if('kicker' in hero && $('home_kicker')) $('home_kicker').textContent=hero.kicker||'';
        if('title'  in hero && $('home_title'))  $('home_title').textContent =hero.title||'';
        if('intro'  in hero && $('home_intro'))  $('home_intro').innerHTML   =hero.intro||'';
        if(Array.isArray(hero.gallery)&&hero.gallery.length&&$('heroTrack')){
          var list=dedupePreferWebp(hero.gallery.filter(function(it){return it&&it.src}).map(function(it){return {src:norm(it.src),alt:it.alt||''}}));
          $('heroTrack').innerHTML=list.map(function(it){ return '<div class="slide"><img src="'+encodeURI(it.src)+'" alt="'+it.alt+'" loading="lazy" decoding="async"></div>' }).join('');
          var carousel=document.getElementById('heroCarousel');
          if(carousel && list.length<=1){ carousel.classList.add('single'); }
        }
      } else {
        console.warn('hero.json no encontrado');
      }
    }catch(e){ console.warn('hero patch failed', e); }
  })();
})();
`;

html = upsertBlock(html, 'style',  'autoPatch-style', styleInner.trim());
html = upsertBlock(html, 'script', 'autoPatch',       scriptInner.trim());

fs.writeFileSync(abs, html, 'utf8');
console.log('[patch] Parche aplicado sin warnings ✔️');
