function buildHeroSlider(images){
  const $ = id => document.getElementById(id);
  const track = $('heroTrack'); const prev = $('heroPrev'); const next = $('heroNext');

  const DEF_SIZES = '(max-width: 900px) 800px, 1200px';

  // Normaliza cada item del JSON a {src, srcsetStr?, sizes?, alt?}
  const list = (Array.isArray(images) ? images : []).map(it => {
    // A) Declarativa: ya trae srcset/sizes
    if (it.srcset || it.sizes) {
      return {
        src: fixRel(it.src),
        srcsetStr: Array.isArray(it.srcset) ? it.srcset.map(fixRel).join(', ') : it.srcset || '',
        sizes: it.sizes || DEF_SIZES,
        alt: it.alt || ''
      };
    }
    // B) Compacta: base/ext/sizes -> construimos srcset
    if (it.base && it.ext && Array.isArray(it.sizes)) {
      const base = it.base.replace(/^\/?media\/hero\//,''); // solo nombre
      const ext  = it.ext.toLowerCase();
      const sizes = it.sizes.slice().sort((a,b)=>a-b);
      const srcsetStr = sizes.map(w => `media/hero/${base}-${w}.${ext} ${w}w`).join(', ');
      const src = `media/hero/${base}-${sizes[sizes.length-1]}.${ext}`; // mayor para src
      return { src, srcsetStr, sizes: DEF_SIZES, alt: it.alt || '' };
    }
    // Fallback: solo src “tal cual”
    if (it.src) return { src: fixRel(it.src), alt: it.alt || '' };
    return null;
  }).filter(Boolean);

  const data = list.length ? list : [{ src: 'media/hero/hero.webp', alt: 'Hero' }];

  // Pintar slides
  track.innerHTML = data.map((it,i) => `
    <div class="slide">
      <img
        src="${it.src}"
        ${it.srcsetStr ? `srcset="${it.srcsetStr}"` : ''}
        ${it.sizes ? `sizes="${it.sizes}"` : ''}
        alt="${it.alt || ''}"
        loading="${i===0 ? 'eager' : 'lazy'}" ${i===0 ? 'fetchpriority="high"' : ''}
        decoding="async">
    </div>
  `).join('');

  // ---------- slider (tu lógica original) ----------
  const width  = () => track.clientWidth;
  const slides = () => Array.from(track.children);
  const index  = () => Math.round(track.scrollLeft / width());
  const wrap   = i => { const N = slides().length; return (i % N + N) % N; };
  const goTo   = i => track.scrollTo({ left: wrap(i) * width(), behavior: 'smooth' });
  const nextFn = () => goTo(index() + 1);
  const prevFn = () => goTo(index() - 1);
  prev.onclick = prevFn; next.onclick = nextFn;

  let timer=null, hovering=false;
  const start = () => { stop(); if (slides().length>1) timer = setInterval(()=>{ if(!hovering && !document.hidden) nextFn(); }, 3000); };
  const stop  = () => { if (timer){ clearInterval(timer); timer=null; } };

  track.addEventListener('mouseenter', ()=>{ hovering=true; stop(); });
  track.addEventListener('mouseleave', ()=>{ hovering=false; start(); });
  document.addEventListener('visibilitychange', ()=>{ document.hidden ? stop() : start(); });
  window.addEventListener('resize', ()=>{ goTo(index()); }, { passive:true });

  slides().forEach(sl=>{
    const im=sl.querySelector('img');
    im.addEventListener('load',  ()=> im.classList.add('is-loaded'), {once:true});
    im.addEventListener('error', ()=> { sl.remove(); if (slides().length<=1){ $('heroPrev').style.display = $('heroNext').style.display = 'none'; stop(); }}, {once:true});
  });

  if (slides().length<=1){ $('heroPrev').style.display = $('heroNext').style.display = 'none'; }
  start();

  function fixRel(p){
    if (!p) return '';
    // Quita dominio y leading slash para que sea relativo al sitio en Vercel
    return String(p).replace(/^https?:\/\/[^/]+/i,'').replace(/^\//,'');
  }
}
