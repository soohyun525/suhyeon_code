// Shared canvas helpers for the MapleStory-style share cards.

export const BROWN = '#5f4023';

export const EL_COLORS: Record<string, string> = {
  Wood: '#58c15e',
  Fire: '#ff7043',
  Earth: '#ffb830',
  Metal: '#9fb2bd',
  Water: '#4fc3f7',
};

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  // Unlike CSS border-radius, canvas arcTo does NOT clamp an oversized radius
  // — it draws giant arcs across the canvas. Clamp to the pill maximum.
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

export function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const blobs: [number, number, number][] = [
    [0, 0, 46],
    [40, -14, 36],
    [-42, -10, 34],
    [78, 2, 30],
    [-78, 4, 28],
  ];
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function outlined(
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

/** Cartoon sky + grass background with clouds, and the cream signboard panel. */
export function drawCardBase(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#7ec9f4');
  bg.addColorStop(0.6, '#c9ecff');
  bg.addColorStop(1, '#bfe7a1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  cloud(ctx, 170, 150, 1);
  cloud(ctx, W - 180, 240, 1.25);
  cloud(ctx, 250, H - 170, 0.9);

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
}

/** Save/share a rendered canvas — native share sheet on mobile, download otherwise. */
export async function saveCanvas(canvas: HTMLCanvasElement, filename: string, title: string) {
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch(() => {});
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
