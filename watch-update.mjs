// watch-update.mjs
// Observa cambios en content/**, media/** y scripts .mjs para lanzar `node update-all.mjs` con "debounce".

import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const DEBOUNCE_MS = 400;
let timer = null;
let running = false;
let pending = false;

function runUpdate(){
  if (running) { pending = true; return; }
  running = true;
  const p = spawn(process.execPath, ['update-all.mjs'], { stdio: 'inherit' });
  p.on('close', code => {
    running = false;
    if (pending) { pending = false; runUpdate(); }
  });
}

function bump(){
  clearTimeout(timer);
  timer = setTimeout(runUpdate, DEBOUNCE_MS);
}

function watchRecursive(dir){
  if (!existsSync(dir)) return;
  try {
    watch(dir, { recursive: true }, (event, filename) => {
      if (!filename) return;
      // ignora temporales
      if (/\.(tmp|swp|part)$/i.test(filename)) return;
      bump();
    });
    console.log('👀 Watching', dir);
  } catch(e){
    console.warn('⚠️ No se pudo observar', dir, e.message);
  }
}

// Observa contenido, media y scripts raíz
watchRecursive('content');
watchRecursive('media');
watchRecursive('.');
console.log('🚀 Auto-update listo. Cambia algo y se reconstruye solo.');
runUpdate(); // primera pasada
