/** Preserve the original sources; compress the cleaned registration sheets and pack the detachable weapons. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=new URL('../src/assets/hero/',import.meta.url).pathname;
const run=(...args)=>execFileSync('magick',args,{stdio:'inherit'});
for(const name of ['player_walk','player_walk_diagonal','player_combat','player_attack_down','player_attack_up']){
  if (process.argv.includes('--weapons-only')) break;
  run(root+'academy/unarmed/'+name+'.png','-quality','88',root+'academy/unarmed/'+name+'.webp');
}
const temp = mkdtempSync(join(tmpdir(), 'hero-weapons-'));
const base = join(temp, 'base.webp');
try {
  run('(',root+'weapons/source.png','-crop','1488x280+24+200','+repage','-resize','512x96!',')',
  '(',root+'weapons/source.png','-crop','1488x280+24+588','+repage','-resize','512x96!',')',
  '-append',
  '(', '-size','512x192','xc:none','-fill','white','-draw',
  'polygon 0,25 30,25 30,29 105,29 105,0 129,0 129,29 470,32 512,47 470,64 129,68 129,95 105,95 105,69 30,69 30,73 0,73 polygon 0,121 30,121 30,125 105,125 105,96 130,96 130,126 470,130 512,135 512,155 470,162 130,165 130,191 105,191 105,166 30,166 30,170 0,170', ')',
  '-compose','DstIn','-composite','-quality','90',base);
  execFileSync('python3', [fileURLToPath(new URL('./pack_weapon_atlases.py', import.meta.url)), base], { stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
