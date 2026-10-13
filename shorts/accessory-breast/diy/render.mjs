// Render scene.html frame-by-frame with Playwright and encode with ffmpeg.
//
//   node render.mjs <build_dir> <out.mp4>              full render
//   node render.mjs <build_dir> --preview 0.5 3.2 ...  PNG stills into build_dir
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const [buildDir, ...rest] = process.argv.slice(2);
const tl = JSON.parse(readFileSync(path.join(buildDir, 'timeline.json'), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(t => { window.TL = t; }, tl);
await page.goto('file://' + path.join(here, process.env.SCENE_HTML || 'scene.html'));
await page.evaluate(() => document.fonts.load('40px Jua').then(() => document.fonts.load('40px BHS')));
await page.evaluate(() => document.fonts.ready);

if (rest[0] === '--preview') {
  for (const t of rest.slice(1).map(Number)) {
    await page.evaluate(t => window.render(t), t);
    const out = path.join(buildDir, `preview_${t.toFixed(2)}.png`);
    await page.screenshot({ path: out });
    console.log(out);
  }
} else {
  const outFile = rest[0];
  const frames = Math.round(tl.total * tl.fps);
  const ff = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-framerate', String(tl.fps), '-i', '-',
    '-i', path.join(buildDir, 'mix.wav'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.render(t), i / tl.fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  console.log('saved', outFile);
}
await browser.close();
