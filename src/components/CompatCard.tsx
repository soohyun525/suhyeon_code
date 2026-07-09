'use client';

// Couple photocard for the 궁합 result — two types, the score, the verdict.
// Same 1080×1350 story-friendly format as the solo card.

import { useCallback, useState } from 'react';
import { BROWN, roundRect, wrapText, outlined, drawCardBase, saveCanvas } from '@/lib/cardCanvas';

export interface CompatCardData {
  a: { name: string | null; archetype: { emoji: string; name: string }; zodiacAnimal: string };
  b: { name: string | null; archetype: { emoji: string; name: string }; zodiacAnimal: string };
  score: number;
  label: string;
  verdict?: string;
}

const W = 1080;
const H = 1350;

function personBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: CompatCardData['a'],
  fallback: string,
) {
  ctx.fillStyle = 'rgba(95,64,35,0.25)';
  roundRect(ctx, x, y + 6, w, h, 26);
  ctx.fill();
  ctx.fillStyle = '#fffdf5';
  roundRect(ctx, x, y, w, h, 26);
  ctx.fill();
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 7;
  roundRect(ctx, x, y, w, h, 26);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '110px system-ui, sans-serif';
  ctx.fillText(p.archetype.emoji, x + w / 2, y + 150);

  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillStyle = '#8a4d12';
  const name = p.name || fallback;
  ctx.fillText(name.length > 12 ? name.slice(0, 11) + '…' : name, x + w / 2, y + 225);

  ctx.font = '600 30px system-ui, sans-serif';
  ctx.fillStyle = '#937355';
  const lines = wrapText(ctx, p.archetype.name, w - 50);
  let ly = y + 272;
  for (const l of lines.slice(0, 2)) {
    ctx.fillText(l, x + w / 2, ly);
    ly += 38;
  }
  ctx.font = '500 26px system-ui, sans-serif';
  ctx.fillStyle = '#b0906a';
  ctx.fillText(p.zodiacAnimal, x + w / 2, ly + 6);
}

function drawCompatCard(canvas: HTMLCanvasElement, d: CompatCardData) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W;
  canvas.height = H;

  drawCardBase(ctx, W, H);

  // ── Header ──
  ctx.textAlign = 'center';
  ctx.font = '700 40px system-ui, sans-serif';
  outlined(ctx, '💘 OUR SAJU MATCH 💘', W / 2, 150, '#ff9ec4', 10);

  // ── Two people + heart ──
  const boxW = 380;
  const boxH = 390;
  const boxY = 200;
  personBox(ctx, 110, boxY, boxW, boxH, d.a, 'Friend');
  personBox(ctx, W - 110 - boxW, boxY, boxW, boxH, d.b, 'You');
  ctx.font = '90px system-ui, sans-serif';
  ctx.fillText('💘', W / 2, boxY + boxH / 2 + 30);

  // ── Score ──
  ctx.font = '800 190px system-ui, sans-serif';
  outlined(ctx, String(d.score), W / 2, 810, '#ff6fa5', 20);

  ctx.font = '700 46px system-ui, sans-serif';
  outlined(ctx, d.label, W / 2, 885, '#ffd23f', 10);

  // Score bar
  const barX = 190;
  const barW = W - 380;
  const barY = 925;
  ctx.fillStyle = '#f0e4c8';
  roundRect(ctx, barX, barY, barW, 34, 999);
  ctx.fill();
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 5;
  roundRect(ctx, barX, barY, barW, 34, 999);
  ctx.stroke();
  const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  grad.addColorStop(0, '#ffd23f');
  grad.addColorStop(0.6, '#ff9ec4');
  grad.addColorStop(1, '#ff6fa5');
  ctx.fillStyle = grad;
  roundRect(ctx, barX + 4, barY + 4, Math.max(30, (barW - 8) * (d.score / 100)), 26, 999);
  ctx.fill();

  // ── Verdict quote ──
  if (d.verdict) {
    ctx.fillStyle = '#4d3722';
    ctx.font = 'italic 500 36px Georgia, serif';
    const lines = wrapText(ctx, `“${d.verdict}”`, W - 280);
    let sy = 1035;
    const maxLines = Math.max(1, Math.floor((H - 210 - sy) / 50));
    const shown = lines.slice(0, maxLines);
    if (shown.length < lines.length) {
      shown[shown.length - 1] = shown[shown.length - 1].replace(/[”]?$/, '…”');
    }
    for (const l of shown) {
      ctx.fillText(l, W / 2, sy);
      sy += 50;
    }
  }

  // ── Footer ──
  ctx.font = '700 40px system-ui, sans-serif';
  outlined(ctx, 'check your 궁합 with a friend ✨', W / 2, H - 130, '#ffd23f', 10);
  ctx.fillStyle = '#8a5a2b';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText('saju — korean destiny reading', W / 2, H - 34);
}

export default function CompatCard({ data }: { data: CompatCardData }) {
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      drawCompatCard(canvas, data);
      await saveCanvas(canvas, 'our-saju-match.png', 'Our Saju Match');
    } finally {
      setBusy(false);
    }
  }, [data]);

  return (
    <button className="btn" onClick={save} disabled={busy} style={{ maxWidth: 420 }}>
      {busy ? '…' : '📸'} Save our match card
    </button>
  );
}
