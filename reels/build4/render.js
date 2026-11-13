// usage: REEL=reel3.html node render.js stills 1.5,4.2 | full | tl out.json   (SEQ=dir for frame output)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FPS = 30;
(async () => {
  const mode = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(__dirname, process.env.REEL || 'reel.html') + '?render');
  await p.evaluate(async () => {
    document.querySelectorAll('.scene').forEach(s => s.classList.add('on'));
    seek(18.5);
    await document.fonts.ready;
    await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
    await document.fonts.ready;
  });
  await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
  await p.waitForTimeout(800);
  if (mode === 'tl') {
    fs.writeFileSync(process.argv[3], JSON.stringify(await p.evaluate(() => ({ duration: DURATION, lines: TL, scenes: SCENES, marks: MARKS })), null, 1));
  } else if (mode === 'stills') {
    for (const t of process.argv[3].split(',')) {
      await p.evaluate(t => seek(t), +t);
      await p.screenshot({ path: path.join(__dirname, '..', 'frames', `t${t}.png`) });
    }
  } else {
    const dir = path.join(__dirname, '..', process.env.SEQ || 'seq'); fs.mkdirSync(dir, { recursive: true });
    const dur = await p.evaluate(() => DURATION), n = Math.round(dur * FPS);
    for (let i = 0; i < n; i++) {
      await p.evaluate(t => seek(t), i / FPS);
      await p.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
      if (i % 200 === 0) console.log(i, '/', n);
    }
  }
  await b.close();
})();
