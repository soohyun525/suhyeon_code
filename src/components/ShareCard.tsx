'use client';

// The viral loop: render the user's result as a K-pop-photocard-style image
// (1080×1350, IG/TikTok-friendly) entirely client-side on a <canvas>, then
// let them save / share it with one tap.

import { useCallback, useState } from 'react';

interface PillarLite {
  stem: { han: string; element: string };
  branch: { han: string; element: string };
}

export interface ShareCardData {
  name?: string;
  archetype: { emoji: string; name: string; tagline: string; vibe: string };
  dayMaster: { han: string; rom: string; element: string; yin: boolean };
  zodiacAnimal: string;
  elementCounts: Record<string, number>;
  pillars: { year: PillarLite | null; month: PillarLite | null; day: PillarLite | null; hour: PillarLite | null };
  shareLine?: string;
}

const EL_COLORS: Record<string, string> = {
  Wood: '#34e39a',
  Fire: '#ff5d73',
  Earth: '#ffc94d',
  Metal: '#cdd7e4',
  Water: '#4dc3ff',
};

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(canvas: HTMLCanvasElement, d: ShareCardData) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W;
  canvas.height = H;

  // ── Background: deep violet with neon glows ──
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#12041f');
  bg.addColorStop(0.5, '#1b0a33');
  bg.addColorStop(1, '#0a0118');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.85, H * 0.1, 500, 'rgba(255,46,136,0.35)');
  glow(W * 0.1, H * 0.35, 450, 'rgba(124,77,255,0.35)');
  glow(W * 0.75, H * 0.85, 500, 'rgba(34,211,238,0.22)');

  // Sparkles
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const sparkles = [
    [90, 140, 3], [980, 220, 4], [160, 1180, 3], [930, 1130, 3],
    [220, 300, 2], [860, 480, 2], [120, 720, 2], [990, 860, 3], [540, 120, 2],
  ];
  for (const [x, y, r] of sparkles) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Header ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2e88';
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText('✦ MY SAJU TYPE ✦', W / 2, 110);

  // Big emoji
  ctx.font = '160px system-ui, sans-serif';
  ctx.fillText(d.archetype.emoji, W / 2, 320);

  // Type name (gradient)
  const nameGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  nameGrad.addColorStop(0, '#ff2e88');
  nameGrad.addColorStop(0.5, '#c77dff');
  nameGrad.addColorStop(1, '#22d3ee');
  ctx.fillStyle = nameGrad;
  ctx.font = '800 84px system-ui, sans-serif';
  const typeLines = wrapText(ctx, d.archetype.name.toUpperCase(), W - 160);
  let ty = 440;
  for (const l of typeLines) {
    ctx.fillText(l, W / 2, ty);
    ty += 92;
  }

  ctx.fillStyle = '#cbb8ee';
  ctx.font = 'italic 400 40px Georgia, serif';
  ctx.fillText(`“${d.archetype.tagline}”`, W / 2, ty + 8);
  ty += 70;

  // Day master line
  ctx.fillStyle = '#8f86b8';
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.fillText(
    `${d.dayMaster.yin ? 'Yin' : 'Yang'} ${d.dayMaster.element} (${d.dayMaster.han}) · ${d.zodiacAnimal}`,
    W / 2,
    ty + 10,
  );

  // ── Four pillars row ──
  const tags = ['HOUR', 'DAY', 'MONTH', 'YEAR'] as const;
  const ps = [d.pillars.hour, d.pillars.day, d.pillars.month, d.pillars.year];
  const cellW = 200;
  const gap = 30;
  const totalW = cellW * 4 + gap * 3;
  let x0 = (W - totalW) / 2;
  const y0 = ty + 70;
  ps.forEach((p, i) => {
    const x = x0 + i * (cellW + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, y0, cellW, 330, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(199,125,255,0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y0, cellW, 330, 24);
    ctx.stroke();

    ctx.fillStyle = '#8f86b8';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(tags[i], x + cellW / 2, y0 + 48);

    if (p) {
      ctx.font = '700 92px serif';
      ctx.fillStyle = EL_COLORS[p.stem.element] || '#fff';
      ctx.fillText(p.stem.han, x + cellW / 2, y0 + 160);
      ctx.fillStyle = EL_COLORS[p.branch.element] || '#fff';
      ctx.fillText(p.branch.han, x + cellW / 2, y0 + 280);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '700 80px serif';
      ctx.fillText('?', x + cellW / 2, y0 + 200);
    }
  });

  // ── Share line ── (never let it collide with the footer)
  let sy = y0 + 330 + 80;
  if (d.shareLine) {
    ctx.fillStyle = '#f3eaff';
    ctx.font = 'italic 500 40px Georgia, serif';
    const lines = wrapText(ctx, `“${d.shareLine}”`, W - 200);
    const maxLines = Math.max(1, Math.floor((H - 190 - sy) / 54));
    const shown = lines.slice(0, maxLines);
    if (shown.length < lines.length) {
      shown[shown.length - 1] = shown[shown.length - 1].replace(/[”]?$/, '…”');
    }
    for (const l of shown) {
      ctx.fillText(l, W / 2, sy);
      sy += 54;
    }
  }

  // ── Footer ──
  ctx.fillStyle = '#ff2e88';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText("what's your saju type? ✨", W / 2, H - 110);
  ctx.fillStyle = '#8f86b8';
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.fillText('saju — korean destiny reading', W / 2, H - 60);
}

export default function ShareCard({ data }: { data: ShareCardData }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const makeBlob = useCallback(async (): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    drawCard(canvas, data);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  }, [data]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await makeBlob();
      const file = new File([blob], 'my-saju-type.png', { type: 'image/png' });
      // Native share sheet on mobile (IG/TikTok stories in one tap), download on desktop.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Saju Type' }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-saju-type.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setBusy(false);
    }
  }, [makeBlob]);

  const copyCaption = useCallback(async () => {
    const caption = `${data.archetype.emoji} I'm ${data.archetype.name} — ${data.shareLine || data.archetype.tagline}\nwhat's your saju type? ✨`;
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [data]);

  return (
    <div className="sharebox">
      <div className="sharebox-head">
        <span className="sharebox-emoji">{data.archetype.emoji}</span>
        <div>
          <div className="sharebox-type">{data.archetype.name}</div>
          <div className="sharebox-tag">{data.archetype.tagline}</div>
        </div>
      </div>
      <div className="sharebox-btns">
        <button className="btn" onClick={save} disabled={busy}>
          {busy ? '…' : '📸'} Save my photocard
        </button>
        <button className="btn ghost" onClick={copyCaption}>
          {copied ? '✓ Copied!' : '✍️ Copy caption'}
        </button>
      </div>
      <p className="sharebox-hint">1080×1350 — made for your story. Tag a friend who needs to know their type.</p>
    </div>
  );
}
