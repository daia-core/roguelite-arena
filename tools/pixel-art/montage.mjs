#!/usr/bin/env node
// Tile the sprite-compare PNGs into a few grid contact sheets for fast visual review.
// Usage: node montage.mjs <name1,name2,...>  → shots/sprite-compare/_sheet-N.png
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DIR = '/workspace/work/roguelite-game/shots/sprite-compare';
const names = (process.argv[2] || '').split(',').map(s=>s.trim()).filter(Boolean);
const COLS = 3, PER_SHEET = 12;

const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();

const chunks = [];
for (let i=0;i<names.length;i+=PER_SHEET) chunks.push(names.slice(i,i+PER_SHEET));

let sheet=0;
for (const chunk of chunks) {
  const imgs = chunk.map(n => ({ name:n, data:'data:image/png;base64,'+fs.readFileSync(path.join(DIR,`${n}.png`)).toString('base64') }));
  const buf = await page.evaluate(async (imgs, COLS) => {
    const load=(u)=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=u;});
    const loaded=[]; for(const it of imgs) loaded.push({name:it.name, img:await load(it.data)});
    const PAD=10; const cellW=Math.max(...loaded.map(l=>l.img.width)); const cellH=Math.max(...loaded.map(l=>l.img.height));
    const rows=Math.ceil(loaded.length/COLS);
    const c=document.createElement('canvas'); c.width=PAD+(cellW+PAD)*COLS; c.height=PAD+(cellH+PAD)*rows;
    const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.fillStyle='#15171e'; ctx.fillRect(0,0,c.width,c.height);
    loaded.forEach((l,k)=>{ const cx=PAD+(k%COLS)*(cellW+PAD); const cy=PAD+Math.floor(k/COLS)*(cellH+PAD); ctx.drawImage(l.img,cx,cy); });
    return c.toDataURL('image/png');
  }, imgs, COLS);
  const outPath = path.join(DIR, `_sheet-${sheet}.png`);
  fs.writeFileSync(outPath, Buffer.from(buf.split(',')[1],'base64'));
  console.log('wrote', outPath, '('+chunk.join(', ')+')');
  sheet++;
}
await browser.close();
