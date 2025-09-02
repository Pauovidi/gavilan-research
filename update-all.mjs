// update-all.mjs
// Orquestador: detecta cambios y regenera SOLO lo necesario
// Además: genera variantes responsive (todas las carpetas media/*)
// y actualiza el images-manifest.json

import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_DIR = join(__dirname, '.cache');
const STATE_FILE = join(CACHE_DIR, 'update-state.json');

const FILES = {
  teamDocx: 'content/TEAM.docx',
  teamJson: 'content/team.json',
  newsDocx: 'content/NEWS.docx',
  newsJson: 'content/news.json',
  newsMap:  'content/news-map.json',
  projDocx: 'content/PROJECTS.docx',
  projJson: 'content/projects.json',
  aboutDocx:'content/ABOUT.docx',
  aboutJson:'content/about.json',
  heroDir:  'media/hero'
};

const TASKS = {
  team:  { cmd: ['node','build-teams-from-docx.mjs','--doc',FILES.teamDocx,'--out',FILES.teamJson,'--media','media/team'] },
  news:  { cmd: ['node','build-news-from-docx.mjs','--doc',FILES.newsDocx,'--map',FILES.newsMap,'--media','media/news','--out',FILES.newsJson] },
  proj:  { cmd: ['node','build-projects-from-docx.mjs','--doc',FILES.projDocx,'--out',FILES.projJson,'--media','media/projects'] },
  hero:  { cmd: ['node','make-hero-manifest.mjs','--dir','media/hero','--out','content/hero-images.json'] }
};

function shasum(buf){ return createHash('sha256').update(buf).digest('hex'); }

async function hashFile(path){
  try { const buf = await readFile(path); return shasum(buf); }
  catch { return null; }
}

async function dirSignature(path){
  try{
    const items = await readdir(path, { withFileTypes: true });
    const parts = [];
    for(const ent of items){
      if(!ent.isFile()) continue;
      const p = join(path, ent.name);
      const st = await stat(p);
      parts.push(`${ent.name}:${st.mtimeMs}:${st.size}`);
    }
    return shasum(Buffer.from(parts.sort().join('|')));
  } catch { return null; }
}

async function loadState(){
  if(!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  if(!existsSync(STATE_FILE)) return {};
  try { return JSON.parse(await readFile(STATE_FILE,'utf8')); }
  catch { return {}; }
}

async function saveState(state){
  if(!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function run(cmd){
  return new Promise((resolve,reject)=>{
    const [file, ...args] = cmd;
    const child = execFile(file, args, { cwd: __dirname });
    child.stdout?.on('data', d => process.stdout.write(d));
    child.stderr?.on('data', d => process.stderr.write(d));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${file} ${args.join(' ')} exited ${code}`)));
  });
}

async function main(){
  const prev = await loadState();

  const sig = {
    teamDocx: await hashFile(FILES.teamDocx),
    teamJson: await hashFile(FILES.teamJson),
    newsDocx: await hashFile(FILES.newsDocx),
    newsMap:  await hashFile(FILES.newsMap),
    newsJson: await hashFile(FILES.newsJson),
    projDocx: await hashFile(FILES.projDocx),
    projJson: await hashFile(FILES.projJson),
    aboutDocx:await hashFile(FILES.aboutDocx),
    aboutJson:await hashFile(FILES.aboutJson),
    heroDir:  await dirSignature(FILES.heroDir)
  };

  const needs = {
    team: !!sig.teamDocx && (!sig.teamJson || sig.teamDocx !== prev.teamDocx),
    news: !!sig.newsDocx && (!sig.newsJson || sig.newsDocx !== prev.newsDocx || (sig.newsMap && sig.newsMap !== prev.newsMap)),
    proj: !!sig.projDocx && (!sig.projJson || sig.projDocx !== prev.projDocx),
    hero: !!sig.heroDir && sig.heroDir !== prev.heroDir
  };

  const changed = Object.entries(needs).filter(([,v])=>v).map(([k])=>k);
  console.log('🔎 Cambios detectados:', changed.length ? changed.join(', ') : 'ninguno');

  if(needs.team){ console.log('🛠  Generando team.json...'); await run(TASKS.team.cmd); }
  if(needs.news){ console.log('🛠  Generando news.json...'); await run(TASKS.news.cmd); }
  if(needs.proj){ console.log('🛠  Generando projects.json...'); await run(TASKS.proj.cmd); }
  if(needs.hero){ console.log('🛠  Actualizando hero-images.json...'); await run(TASKS.hero.cmd); }

  // --- HOOK DE IMÁGENES ---
  try {
    console.log('🛠  Generando variantes responsive en todas las carpetas media/*');
    await run(['node','optimize-images.mjs']);
  } catch(e) {
    console.warn('⚠️ optimize-images falló:', e.message);
  }

  try {
    console.log('🛠  Regenerando images-manifest.json');
    await run(['node','generate-images-manifest.mjs']);
  } catch(e) {
    console.warn('⚠️ images-manifest falló:', e.message);
  }

  const final = {
    teamDocx: sig.teamDocx,
    teamJson: await hashFile(FILES.teamJson) || prev.teamJson,
    newsDocx: sig.newsDocx,
    newsMap:  sig.newsMap,
    newsJson: await hashFile(FILES.newsJson) || prev.newsJson,
    projDocx: sig.projDocx,
    projJson: await hashFile(FILES.projJson) || prev.projJson,
    aboutDocx: sig.aboutDocx,
    aboutJson: sig.aboutJson,
    heroDir:  sig.heroDir
  };
  await saveState(final);
  console.log('✅ Update completo.');
}

main().catch(err=>{ console.error('❌ Update falló:', err.message); process.exit(1); });
