import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const src = fs.readFileSync('frontend/src/items/itemIcons.ts','utf8');

// brace-match extract an object literal after a marker
function extractObj(marker){
  const i = src.indexOf(marker);
  const s = src.indexOf('{', i);
  let d=0, j=s;
  for(; j<src.length; j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(d===0){j++;break;}} }
  return src.slice(s, j);
}
const glyphsTxt = extractObj('const GLYPHS');
const mapTxt = extractObj('EMOJI_MAP');
const GLYPHS = eval('('+glyphsTxt+')');
const EMOJI_MAP = eval('('+mapTxt+')');

// order emojis by catalog first-appearance
const cat = fs.readFileSync('frontend/src/items/catalog.ts','utf8');
const order = [...new Set([...cat.matchAll(/icon:\s*'([^']*)'/g)].map(m=>m[1]))];

const items = order.map(e=>({emoji:e, name:EMOJI_MAP[e], glyph:GLYPHS[EMOJI_MAP[e]]})).filter(x=>x.glyph);
console.log('glyphs to render:', items.length);

const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();

const COLS=8, SCALE=6, CELL=12*SCALE, PAD=14, LABELH=26;
const cellW=CELL+PAD*2, cellH=CELL+PAD+LABELH;
const PER=48;
let sheet=0;
for(let start=0; start<items.length; start+=PER){
  const chunk=items.slice(start,start+PER);
  const buf = await page.evaluate(async (chunk, o)=>{
    const {COLS,SCALE,CELL,PAD,LABELH,cellW,cellH}=o;
    const rows=Math.ceil(chunk.length/COLS);
    const c=document.createElement('canvas'); c.width=cellW*COLS; c.height=cellH*rows;
    const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#15171e'; ctx.fillRect(0,0,c.width,c.height);
    chunk.forEach((it,k)=>{
      const gx=(k%COLS)*cellW, gy=Math.floor(k/COLS)*cellH;
      // glyph
      const g=it.glyph.g, p=it.glyph.p;
      for(let y=0;y<g.length;y++)for(let x=0;x<g[y].length;x++){
        const ci=g[y][x]; if(ci>0&&p[ci]&&p[ci]!=='transparent'){ ctx.fillStyle=p[ci]; ctx.fillRect(gx+PAD+x*SCALE, gy+PAD+y*SCALE, SCALE, SCALE);}
      }
      // reference emoji top-right small
      ctx.font='16px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='top';
      ctx.fillText(it.emoji, gx+cellW-4, gy+2);
      // name label
      ctx.fillStyle='#aab'; ctx.font='11px monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(it.name, gx+cellW/2, gy+PAD+CELL+4);
    });
    return c.toDataURL('image/png');
  }, chunk, {COLS,SCALE,CELL,PAD,LABELH,cellW,cellH});
  fs.writeFileSync(`shots/item-glyphs-${sheet}.png`, Buffer.from(buf.split(',')[1],'base64'));
  console.log('wrote shots/item-glyphs-'+sheet+'.png ('+chunk.length+' glyphs)');
  sheet++;
}
await browser.close();
