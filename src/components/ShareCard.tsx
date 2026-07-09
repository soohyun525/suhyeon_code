'use client';

// The viral loop: render the user's result as a photocard-style image
// (1080×1350, IG/TikTok-friendly) entirely client-side on a <canvas>, then
// let them save / share it with one tap.

import { useCallback, useState } from 'react';
import {
  BROWN,
  EL_COLORS,
  roundRect,
  wrapText,
  outlined,
  drawCardBase,
  saveCanvas,
} from '@/lib/cardCanvas';

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

const W = 1080;
const H = 1350;

function drawCard(canvas: HTMLCanvasElement, d: ShareCardData) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W;
  canvas.height = H;

  drawCardBase(ctx, W, H);

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

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      drawCard(canvas, data);
      await saveCanvas(canvas, 'my-saju-type.png', 'My Saju Type');
    } finally {
      setBusy(false);
    }
  }, [data]);

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
