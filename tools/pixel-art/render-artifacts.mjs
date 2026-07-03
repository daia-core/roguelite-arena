import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { GLYPHS } from './artifact-glyphs.mjs';

// label refs (name + a short concept note) for review
const REFS = {
  fist:'fist/glove', gun:'pistol',
  art_glass_cannon:'cannon', art_titans_heart:'armored heart', art_scholars_codex:'book',
  art_fleetfoot:'winged boot', art_executioner:'axe', art_second_wind:'phoenix feather',
  art_vampiric_field:'fangs+drop', art_momentum:'gear', art_berserk_core:'glow core',
  art_spiked_aura:'morningstar', art_ironbark_totem:'totem', art_duelists_edge:'rapier',
  art_stormcaller:'cloud+bolt', art_assassins_guile:'hooded mask', art_warlords_banner:'banner',
  art_prodigys_insight:'eye', art_windrunner_boots:'speed boot', art_colossus_plating:'pauldron',
  art_snipers_focus:'scope', art_crown_of_slaughter:'crown+gem',
};
const items = Object.entries(GLYPHS).map(([name,gl])=>({name, gl, ref:REFS[name]||''}));

const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
const COLS=6, SCALE=8, CELL=12*SCALE, PAD=16, LABELH=30;
const cellW=CELL+PAD*2, cellH=CELL+PAD+LABELH;
const buf = await page.evaluate(async (items, o)=>{
  const {COLS,SCALE,CELL,PAD,LABELH,cellW,cellH}=o;
  const rows=Math.ceil(items.length/COLS);
  const c=document.createElement('canvas'); c.width=cellW*COLS; c.height=cellH*rows;
  const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#15171e'; ctx.fillRect(0,0,c.width,c.height);
  items.forEach((it,k)=>{
    const gx=(k%COLS)*cellW, gy=Math.floor(k/COLS)*cellH;
    const g=it.gl.g, p=it.gl.p;
    for(let y=0;y<g.length;y++)for(let x=0;x<g[y].length;x++){
      const ci=g[y][x]; if(ci>0&&p[ci]&&p[ci]!=='transparent'){ ctx.fillStyle=p[ci]; ctx.fillRect(gx+PAD+x*SCALE, gy+PAD+y*SCALE, SCALE, SCALE);}
    }
    ctx.fillStyle='#e8e8ee'; ctx.font='12px monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(it.name.replace('art_',''), gx+cellW/2, gy+PAD+CELL+4);
    ctx.fillStyle='#889'; ctx.font='10px monospace';
    ctx.fillText(it.ref, gx+cellW/2, gy+PAD+CELL+18);
  });
  return c.toDataURL('image/png');
}, items, {COLS,SCALE,CELL,PAD,LABELH,cellW,cellH});
fs.writeFileSync('shots/artifact-glyphs.png', Buffer.from(buf.split(',')[1],'base64'));
console.log('wrote shots/artifact-glyphs.png ('+items.length+' glyphs)');
await browser.close();
