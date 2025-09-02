// cleanup-minimal.mjs
// Ejecuta: node cleanup-minimal.mjs
// Borra scripts utilitarios que no afectan al index.html.
// Crea un backup ZIP antes si se pasa --backup (recomendado).

import { rm, access } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const maybe = async (p)=>{
  try { await access(p); return true; } catch { return false; }
};

async function backupZip(){
  return new Promise((resolve, reject)=>{
    const out = createWriteStream('backup-before-clean.zip');
    const zip = spawn(process.platform === 'win32' ? 'powershell' : 'zip',
      process.platform === 'win32'
        ? ['-noprofile','-command', `Compress-Archive -Path * -DestinationPath backup-before-clean.zip -Force`]
        : ['-r','backup-before-clean.zip','.']
    );
    zip.on('error', reject);
    zip.on('close', code => code===0 ? resolve() : reject(new Error('zip failed '+code)));
  });
}

const DELETABLE = [
  'extract-docx.mjs',
  'raw-to-section.mjs',
  'optimize-images.mjs',
  'projects-img-link.mjs',
  'ingest-about.mjs',
  'patch-gavilan.mjs',
  'patch-gavilan.config.json',
  'prefer-webp-in-json.mjs',
  'relocate-gavilan.mjs',
  'update-footer-logos.mjs',
  'update-home-gallery.mjs',
  'update-projects-from-folder.mjs',
  'verify-setup.mjs',
  'slider-standalone.html',
  '.cache/optimize-images.json'
];

async function main(){
  const doBackup = process.argv.includes('--backup');
  if(doBackup){
    console.log('📦 Creando backup ZIP (backup-before-clean.zip)...');
    try { await backupZip(); console.log('✅ Backup listo.'); }
    catch(e){ console.warn('⚠️ No se pudo crear backup automáticamente:', e.message); }
  }

  for(const p of DELETABLE){
    if(await maybe(p)){
      console.log('🗑  Borrando', p);
      await rm(p, { recursive: true, force: true });
    } else {
      // silencioso
    }
  }

  console.log('✅ Limpieza terminada. Revisa git status o la carpeta.');
  console.log('Sigue con: npm run update');
}

main().catch(e=>{ console.error('❌ Error en cleanup:', e.message); process.exit(1); });
