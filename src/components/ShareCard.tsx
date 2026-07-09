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
  Wood: '#58c15e',
  Fire: '#ff7043',
  Earth: '#ffb830',
  Metal: '#9fb2bd',
  Water: '#4fc3f7',
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

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const blobs: [number, number, number][] = [
    [0, 0, 46], [40, -14, 36], [-42, -10, 34], [78, 2, 30], [-78, 4, 28],
  ];
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

const BROWN = '#5f4023';

function outlined(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  strokeW: number,
) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = strokeW;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawCard(canvas: HTMLCanvasElement, d: ShareCardData) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W;
  canvas.height = H;

  // ── Background: cartoon sky + grass ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#7ec9f4');
  bg.addColorStop(0.6, '#c9ecff');
  bg.addColorStop(1, '#bfe7a1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  cloud(ctx, 170, 150, 1);
  cloud(ctx, 900, 240, 1.25);
  cloud(ctx, 250, 1180, 0.9);

  // ── Cream signboard panel ──
  ctx.fillStyle = 'rgba(95,64,35,0.3)';
  roundRect(ctx, 60, 74, W - 120, H - 134, 40);
  ctx.fill();
  ctx.fillStyle = '#fff6dd';
  roundRect(ctx, 60, 60, W - 120, H - 134, 40);
  ctx.fill();
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 9;
  roundRect(ctx, 60, 60, W - 120, H - 134, 40);
  ctx.stroke();

  // ── Header ──
  ctx.textAlign = 'center';
  ctx.font = '700 40px system-ui, sans-serif';
  outlined(ctx, '✦ MY SAJU TYPE ✦', W / 2, 150, '#ffd23f', 10);

  // Big emoji
  ctx.font = '150px system-ui, sans-serif';
  ctx.fillText(d.archetype.emoji, W / 2, 330);

  // Type name — chunky with brown outline
  ctx.font = '800 82px system-ui, sans-serif';
  const typeLines = wrapText(ctx, d.archetype.name.toUpperCase(), W - 240);
  let ty = 450;
  for (const l of typeLines) {
    outlined(ctx, l, W / 2, ty, '#ff9b26', 14);
    ty += 92;
  }

  ctx.fillStyle = '#937355';
  ctx.font = 'italic 400 38px Georgia, serif';
  ctx.fillText(`“${d.archetype.tagline}”`, W / 2, ty + 4);
  ty += 66;

  // Day master line
  ctx.fillStyle = '#8a5a2b';
  ctx.font = '700 33px system-ui, sans-serif';
  ctx.fillText(
    `${d.dayMaster.yin ? 'Yin' : 'Yang'} ${d.dayMaster.element} (${d.dayMaster.han}) · ${d.zodiacAnimal}`,
    W / 2,
    ty + 8,
  );

  // ── Four pillars row — item slots ──
  const tags = ['HOUR', 'DAY', 'MONTH', 'YEAR'] as const;
  const ps = [d.pillars.hour, d.pillars.day, d.pillars.month, d.pillars.year];
  const cellW = 196;
  const gap = 26;
  const totalW = cellW * 4 + gap * 3;
  const x0 = (W - totalW) / 2;
  const y0 = ty + 66;
  ps.forEach((p, i) => {
    const x = x0 + i * (cellW + gap);
    ctx.fillStyle = 'rgba(95,64,35,0.25)';
    roundRect(ctx, x, y0 + 6, cellW, 320, 22);
    ctx.fill();
    ctx.fillStyle = '#fffdf5';
    roundRect(ctx, x, y0, cellW, 320, 22);
    ctx.fill();
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 6;
    roundRect(ctx, x, y0, cellW, 320, 22);
    ctx.stroke();

    ctx.fillStyle = '#3fa9f5';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(tags[i], x + cellW / 2, y0 + 48);

    const tile = (han: string, el: string, cy: number) => {
      const tw = 108;
      ctx.fillStyle = EL_COLORS[el] || '#ccc';
      roundRect(ctx, x + (cellW - tw) / 2, cy, tw, 108, 18);
      ctx.fill();
      ctx.strokeStyle = BROWN;
      ctx.lineWidth = 5;
      roundRect(ctx, x + (cellW - tw) / 2, cy, tw, 108, 18);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 74px serif';
      ctx.fillText(han, x + cellW / 2, cy + 86);
    };
    if (p) {
      tile(p.stem.han, p.stem.element, y0 + 70);
      tile(p.branch.han, p.branch.element, y0 + 192);
    } else {
      ctx.fillStyle = 'rgba(95,64,35,0.3)';
      ctx.font = '700 80px serif';
      ctx.fillText('?', x + cellW / 2, y0 + 205);
    }
  });

  // ── Share line ── (never let it collide with the footer)
  let sy = y0 + 320 + 76;
  if (d.shareLine) {
    ctx.fillStyle = '#4d3722';
    ctx.font = 'italic 500 38px Georgia, serif';
    const lines = wrapText(ctx, `“${d.shareLine}”`, W - 260);
    const maxLines = Math.max(1, Math.floor((H - 210 - sy) / 52));
    const shown = lines.slice(0, maxLines);
    if (shown.length < lines.length) {
      shown[shown.length - 1] = shown[shown.length - 1].replace(/[”]?$/, '…”');
    }
    for (const l of shown) {
      ctx.fillText(l, W / 2, sy);
      sy += 52;
    }
  }

  // ── Footer ──
  ctx.font = '700 40px system-ui, sans-serif';
  outlined(ctx, "what's your saju type? ✨", W / 2, H - 130, '#ffd23f', 10);
  ctx.fillStyle = '#8a5a2b';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText('saju — korean destiny reading', W / 2, H - 34);
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
