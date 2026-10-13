// Shared drawing + subtitle helpers for the shorts scenes.
// ───────────────────────── helpers ─────────────────────────
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const prog = (t, a, b) => clamp((t - a) / (b - a));
// Overshooting pop-in scale: 0 → 1.15 → 1.
const pop = (t, t0, d = 0.35) => {
  const k = prog(t, t0, t0 + d);
  if (k <= 0) return 0;
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const C = {
  skin: '#FFDCC5', skinShade: '#F2B89C', hair: '#3A2622', line: '#2B1B17',
  top: '#FF8FAB', topLight: '#FFB8CB', pants: '#5B6C9E', blush: '#FF8C9A',
  coat: '#FFFFFF', coatShade: '#DDE6EE', shirt: '#7FB7E6',
};

// ───────────────────────── face ─────────────────────────
function face(expr, mouth, blink) {
  let s = '';
  // brows
  const brows = {
    neutral: [[-68, -578, -22, -584], [22, -584, 68, -578]],
    happy:   [[-68, -582, -22, -590], [22, -590, 68, -582]],
    sparkle: [[-68, -592, -22, -600], [22, -600, 68, -592]],
    deadpan: [[-68, -572, -22, -572], [22, -572, 68, -572]],
    proud:   [[-70, -585, -24, -600], [24, -600, 70, -585]],
    shock:   [[-70, -610, -24, -618], [24, -618, 70, -610]],
    worry:   [[-70, -578, -24, -598], [24, -598, 70, -578]],
  }[expr] || [[-68, -578, -22, -584], [22, -584, 68, -578]];
  for (const [x1, y1, x2, y2] of brows)
    s += `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - 8} ${x2} ${y2}" stroke="${C.hair}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  // eyes
  for (const ex of [-44, 44]) {
    if (blink && expr !== 'shock') {
      s += `<path d="M${ex - 16} -530 Q${ex} -522 ${ex + 16} -530" stroke="${C.line}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    } else if (expr === 'deadpan') {
      s += `<path d="M${ex - 18} -534 Q${ex} -508 ${ex + 18} -534 Z" fill="${C.line}"/>`;
      s += `<path d="M${ex - 22} -535 L${ex + 22} -535" stroke="${C.line}" stroke-width="7" stroke-linecap="round"/>`;
    } else if (expr === 'sparkle') {
      s += `<ellipse cx="${ex}" cy="-530" rx="24" ry="30" fill="${C.line}"/>`;
      s += `<circle cx="${ex + 8}" cy="-542" r="10" fill="#fff"/><circle cx="${ex - 8}" cy="-518" r="5" fill="#fff"/>`;
      s += `<path transform="translate(${ex - 10} -540) scale(.5)" d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="#FFE14D"/>`;
    } else if (expr === 'happy' || expr === 'proud') {
      s += `<path d="M${ex - 18} -526 Q${ex} -552 ${ex + 18} -526" stroke="${C.line}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
    } else if (expr === 'shock') {
      s += `<circle cx="${ex}" cy="-532" r="28" fill="#fff" stroke="${C.line}" stroke-width="5"/>`;
      s += `<circle cx="${ex}" cy="-530" r="9" fill="${C.line}"/>`;
    } else {
      s += `<ellipse cx="${ex}" cy="-530" rx="16" ry="21" fill="${C.line}"/>`;
      s += `<circle cx="${ex + 6}" cy="-538" r="6" fill="#fff"/>`;
    }
  }
  if (expr === 'proud') for (const ex of [-44, 44])
    s += `<path d="M${ex} -518 q-8 30 0 60 q8 -30 0 -60 Z" fill="#7CC8FF" opacity=".9"/>`;
  // blush
  s += `<ellipse cx="-74" cy="-488" rx="24" ry="13" fill="${C.blush}" opacity=".55"/>`;
  s += `<ellipse cx="74" cy="-488" rx="24" ry="13" fill="${C.blush}" opacity=".55"/>`;
  // mouth
  if (mouth > 0.04) {
    const rx = 15 + 9 * mouth, ry = 4 + 22 * mouth;
    s += `<ellipse cx="0" cy="${-466 + ry * 0.4}" rx="${rx}" ry="${ry}" fill="#A8323F"/>`;
    if (ry > 10) s += `<ellipse cx="0" cy="${-466 + ry * 1.0}" rx="${rx * 0.6}" ry="${ry * 0.35}" fill="#F27C8A"/>`;
  } else if (expr === 'happy' || expr === 'proud' || expr === 'sparkle') {
    s += `<path d="M-26 -476 Q0 -440 26 -476 Z" fill="#A8323F" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/>`;
  } else if (expr === 'shock') {
    s += `<ellipse cx="0" cy="-462" rx="13" ry="17" fill="#A8323F" stroke="${C.line}" stroke-width="4"/>`;
  } else if (expr === 'deadpan') {
    s += `<path d="M-20 -466 L20 -466" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>`;
  } else if (expr === 'worry') {
    s += `<path d="M-22 -462 q11 -10 22 0 q11 10 22 0" stroke="${C.line}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M-18 -470 Q0 -456 18 -470" stroke="${C.line}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}

// Arm as a bent stroke: shoulder → elbow → hand, blended between poses.
function arm(side, pose, k, t, color) {
  const sx = 102 * side, sy = -385;
  const poses = {
    down:  [[135 * side, -265], [70 * side, -175]],          // hand resting on belly
    up:    [[205 * side, -500], [95 * side, -625]],          // hand behind head
    wave:  [[190 * side, -430], [(215 + 25 * Math.sin(t * 12)) * side, -585]],
    touch: [[150 * side, -300], [118 * side, -360]],         // hand to side of chest
    hip:   [[165 * side, -290], [118 * side, -170]],
  };
  const [e0, h0] = poses.down, [e1, h1] = poses[pose] || poses.down;
  const ex = lerp(e0[0], e1[0], k), ey = lerp(e0[1], e1[1], k);
  const hx = lerp(h0[0], h1[0], k), hy = lerp(h0[1], h1[1], k);
  return `<path d="M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}" stroke="${C.skinShade}" stroke-width="48" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
       + `<path d="M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}" stroke="${color || C.skin}" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
       + `<circle cx="${hx}" cy="${hy}" r="25" fill="${C.skin}" stroke="${C.skinShade}" stroke-width="4"/>`;
}

// ───────────────────────── characters ─────────────────────────
function mom(o) {
  const { x, y, s = 1, mouth = 0, expr = 'neutral', blink = false, t = 0,
          rPose = 'down', rK = 0, lPose = 'down', lK = 0, tilt = 0, legs = true, girl = false } = o;
  const top = girl ? '#FFFFFF' : C.top, pants = girl ? '#2F3E73' : C.pants;
  let g = `<g transform="translate(${x} ${y}) scale(${s}) rotate(${tilt} 0 -400)">`;
  // back hair
  if (girl) {
    // pigtails
    for (const sd of [-1, 1]) g += `<path d="M${150 * sd} -560 C${230 * sd} -540 ${240 * sd} -420 ${190 * sd} -360 C${170 * sd} -420 ${150 * sd} -470 ${130 * sd} -520 Z" fill="${C.hair}"/><circle cx="${148 * sd}" cy="-570" r="18" fill="#FF5C8A"/>`;
  } else {
    g += `<path d="M-150 -540 C-165 -720 165 -720 150 -540 L162 -380 C110 -350 -110 -350 -162 -380 Z" fill="${C.hair}"/>`;
  }
  if (legs) {
    g += `<rect x="-105" y="-20" width="88" height="330" rx="40" fill="${pants}"/>`;
    g += `<rect x="17" y="-20" width="88" height="330" rx="40" fill="${pants}"/>`;
  }
  g += `<path d="M-120 -130 L120 -130 L125 30 Q0 55 -125 30 Z" fill="${pants}"/>`;
  // neck + shoulders (skin)
  g += `<rect x="-28" y="-445" width="56" height="70" fill="${C.skinShade}"/>`;
  g += `<path d="M-112 -360 Q-112 -405 -60 -408 L60 -408 Q112 -405 112 -360 L112 -330 L-112 -330 Z" fill="${C.skin}"/>`;
  // tank top
  g += `<path d="M-108 -370 L-70 -372 L-62 -408 L-40 -408 Q0 -360 40 -408 L62 -408 L70 -372 L108 -370 Q122 -250 120 -110 L-120 -110 Q-122 -250 -108 -370 Z" fill="${top}"/>`;
  if (girl) {
    // sailor collar + ribbon
    g += `<path d="M-100 -380 L-40 -408 L0 -330 L40 -408 L100 -380 L70 -320 L0 -300 L-70 -320 Z" fill="#2F3E73"/>`;
    g += `<path d="M0 -320 L-45 -290 L-35 -340 Z M0 -320 L45 -290 L35 -340 Z" fill="#FF3B5C"/><circle cx="0" cy="-320" r="12" fill="#FF3B5C"/>`;
  } else {
    // baby bump
    g += `<ellipse cx="0" cy="-200" rx="132" ry="118" fill="${top}"/>`;
    g += `<path d="M-80 -270 Q-40 -305 10 -300" stroke="${C.topLight}" stroke-width="14" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M-128 -120 Q0 -70 128 -120" stroke="#E36F8E" stroke-width="6" fill="none"/>`;
  }
  // left arm (viewer side), right arm drawn before head so a raised hand tucks behind it
  g += arm(-1, lPose, lK, t);
  g += arm(1, rPose, rK, t);
  // head
  g += `<circle cx="-122" cy="-520" r="22" fill="${C.skin}"/><circle cx="122" cy="-520" r="22" fill="${C.skin}"/>`;
  g += `<circle cx="0" cy="-530" r="126" fill="${C.skin}"/>`;
  g += `<path d="M-132 -545 C-125 -690 125 -700 132 -545 C95 -600 35 -612 5 -588 C-25 -615 -95 -602 -132 -545 Z" fill="${C.hair}"/>`;
  // hair clip
  g += `<g transform="translate(92 -628) rotate(20)"><path d="M-22 -10 L0 0 L-22 10 Z M22 -10 L0 0 L22 10 Z" fill="#FFD23F" stroke="#E0A800" stroke-width="3"/><circle r="7" fill="#FFD23F"/></g>`;
  g += face(expr, mouth, blink);
  g += `</g>`;
  return g;
}

function doctor(o) {
  const { x, y, s = 1, mouth = 0, expr = 'neutral', blink = false, t = 0, point = 0 } = o;
  let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
  // bun + hair
  g += `<circle cx="0" cy="-690" r="58" fill="#2E2A3A"/>`;
  g += `<path d="M-135 -540 C-140 -700 140 -700 135 -540 L130 -470 L-130 -470 Z" fill="#2E2A3A"/>`;
  g += `<rect x="-28" y="-445" width="56" height="70" fill="${C.skinShade}"/>`;
  // shirt + coat
  g += `<path d="M-125 -360 Q-125 -405 -60 -410 L60 -410 Q125 -405 125 -360 L135 0 L-135 0 Z" fill="${C.coat}" stroke="${C.coatShade}" stroke-width="6"/>`;
  g += `<path d="M-45 -410 L0 -320 L45 -410 Z" fill="${C.shirt}"/>`;
  g += `<path d="M-60 -410 L-5 -300 L-30 -120 M60 -410 L5 -300 L30 -120" stroke="${C.coatShade}" stroke-width="7" fill="none"/>`;
  // stethoscope
  g += `<path d="M-40 -405 Q-70 -300 -20 -260 M40 -405 Q70 -300 20 -260 M-20 -260 Q0 -240 20 -260" stroke="#5A6B7D" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  g += `<circle cx="0" cy="-232" r="16" fill="#9AA9B8" stroke="#5A6B7D" stroke-width="5"/>`;
  // pocket + badge
  g += `<rect x="45" y="-300" width="55" height="45" rx="6" fill="none" stroke="${C.coatShade}" stroke-width="5"/>`;
  g += `<rect x="52" y="-318" width="12" height="30" rx="3" fill="#4A90D9"/>`;
  // arms (white sleeves)
  g += arm(-1, 'hip', 1, t, C.coat);
  g += arm(1, 'wave', point, t * 0.25, C.coat);
  // head
  g += `<circle cx="-122" cy="-520" r="22" fill="${C.skin}"/><circle cx="122" cy="-520" r="22" fill="${C.skin}"/>`;
  g += `<circle cx="0" cy="-530" r="126" fill="${C.skin}"/>`;
  g += `<path d="M-130 -540 C-120 -690 120 -690 130 -540 C80 -620 -40 -630 -130 -540 Z" fill="#2E2A3A"/>`;
  g += face(expr, mouth, blink);
  // glasses
  g += `<circle cx="-44" cy="-530" r="36" fill="none" stroke="#5A3E2B" stroke-width="7"/>`;
  g += `<circle cx="44" cy="-530" r="36" fill="none" stroke="#5A3E2B" stroke-width="7"/>`;
  g += `<path d="M-8 -534 Q0 -542 8 -534" stroke="#5A3E2B" stroke-width="7" fill="none"/>`;
  g += `</g>`;
  return g;
}

// ───────────────────────── scene pieces ─────────────────────────
function heart(x, y, s, fill = '#FF5C8A', op = 1) {
  return `<path transform="translate(${x} ${y}) scale(${s})" opacity="${op}" d="M0 18 C-30 -8 -22 -34 0 -20 C22 -34 30 -8 0 18 Z" fill="${fill}" stroke="#fff" stroke-width="3"/>`;
}
function sweat(x, y, s = 1, op = 1) {
  return `<path transform="translate(${x} ${y}) scale(${s})" opacity="${op}" d="M0 -30 C14 -8 20 6 0 20 C-20 6 -14 -8 0 -30 Z" fill="#7CC8FF" stroke="#3A8FD0" stroke-width="3"/>`;
}
function outlined(x, y, text, size, fill, stroke = '#1B1B1F', sw = 14, font = 'Jua', anchor = 'middle', extra = '') {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" text-anchor="${anchor}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke" ${extra}>${esc(text)}</text>`;
}


function sparkleStar(x, y, s, op) {
  return `<path transform="translate(${x} ${y}) scale(${s})" opacity="${op}" d="M0 -20 L5 -5 L20 0 L5 5 L0 20 L-5 5 L-20 0 L-5 -5 Z" fill="#fff"/>`;
}


function cow(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">`
    + `<path d="M-90 -70 Q-140 -110 -150 -60 M90 -70 Q140 -110 150 -60" stroke="#E8D7B0" stroke-width="16" fill="none" stroke-linecap="round"/>`
    + `<ellipse cx="0" cy="0" rx="110" ry="100" fill="#fff" stroke="#333" stroke-width="5"/>`
    + `<path d="M-100 -30 Q-60 -80 -20 -60 Q-40 0 -95 10 Z" fill="#333"/><path d="M50 -90 Q100 -70 95 -20 Q60 -40 50 -90 Z" fill="#333"/>`
    + `<ellipse cx="0" cy="55" rx="75" ry="45" fill="#FFB3C6" stroke="#333" stroke-width="4"/>`
    + `<circle cx="-25" cy="55" r="9" fill="#333"/><circle cx="25" cy="55" r="9" fill="#333"/>`
    + `<circle cx="-40" cy="-15" r="12" fill="#222"/><circle cx="40" cy="-15" r="12" fill="#222"/></g>`;
}
function cat(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">`
    + `<path d="M-95 -40 L-80 -125 L-25 -80 Z M95 -40 L80 -125 L25 -80 Z" fill="#FFB547" stroke="#C97A1E" stroke-width="5" stroke-linejoin="round"/>`
    + `<ellipse cx="0" cy="0" rx="105" ry="90" fill="#FFB547" stroke="#C97A1E" stroke-width="5"/>`
    + `<path d="M-30 -85 L-20 -55 M0 -90 L0 -58 M30 -85 L20 -55" stroke="#C97A1E" stroke-width="7" stroke-linecap="round"/>`
    + `<path d="M-50 -5 q12 -14 24 0 M26 -5 q12 -14 24 0" stroke="#222" stroke-width="7" fill="none" stroke-linecap="round"/>`
    + `<path d="M-10 18 L10 18 L0 30 Z" fill="#FF6F91"/><path d="M0 30 q-14 14 -26 4 M0 30 q14 14 26 4" stroke="#222" stroke-width="4" fill="none"/>`
    + `<path d="M-50 25 L-120 15 M-50 35 L-120 45 M50 25 L120 15 M50 35 L120 45" stroke="#7a5a3a" stroke-width="3"/></g>`;
}
function dog(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">`
    + `<ellipse cx="-95" cy="10" rx="35" ry="75" fill="#8B5A3C" transform="rotate(15 -95 10)"/><ellipse cx="95" cy="10" rx="35" ry="75" fill="#8B5A3C" transform="rotate(-15 95 10)"/>`
    + `<ellipse cx="0" cy="0" rx="95" ry="95" fill="#D9A066"/>`
    + `<ellipse cx="0" cy="45" rx="55" ry="40" fill="#F3D3AE"/>`
    + `<ellipse cx="0" cy="25" rx="20" ry="14" fill="#222"/>`
    + `<circle cx="-35" cy="-15" r="12" fill="#222"/><circle cx="35" cy="-15" r="12" fill="#222"/>`
    + `<path d="M0 40 L0 55 M-18 60 Q0 70 18 60" stroke="#222" stroke-width="5" fill="none"/>`
    + `<ellipse cx="10" cy="80" rx="14" ry="20" fill="#FF6F91"/></g>`;
}
function bubble(x, y, text, p) {
  const w = text.length * 46 + 60;
  return `<g transform="translate(${x} ${y}) scale(${p})"><rect x="${-w / 2}" y="-50" width="${w}" height="88" rx="44" fill="#fff" stroke="#1B1B1F" stroke-width="5"/>`
    + `<path d="M-15 36 L0 64 L15 36 Z" fill="#fff" stroke="#1B1B1F" stroke-width="5" stroke-linejoin="round"/><rect x="-18" y="30" width="36" height="10" fill="#fff"/>`
    + `<text x="0" y="12" font-size="46" text-anchor="middle" fill="#1B1B1F">${esc(text)}</text></g>`;
}


function chunks(line, maxLen = 22) {
  const sentences = line.text.match(/[^.?!…,]+[.?!…,]+\s*|[^.?!…,]+$/g).map(p => p.trim()).filter(Boolean);
  // Break long sentences into word groups that fit two subtitle rows.
  const parts = [];
  for (const sen of sentences) {
    if (sen.length <= maxLen) { parts.push(sen); continue; }
    const words = sen.split(' ');
    const n = Math.ceil(sen.length / maxLen);
    const target = sen.length / n;
    let cur = '';
    for (const w of words) {
      if (cur && (cur + ' ' + w).length > target + 3) { parts.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) parts.push(cur);
  }
  const total = parts.reduce((a, p) => a + p.length, 0);
  let t = line.start;
  const span = line.end - line.start;
  return parts.map(p => { const d = span * p.length / total; const c = { text: p, start: t, end: t + d }; t += d; return c; });
}
function wrap(text, max = 11) {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  let best = [text], bestDiff = 1e9;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const d = Math.abs(a.length - b.length);
    if (d < bestDiff) { bestDiff = d; best = [a, b]; }
  }
  return best;
}
function subtitle(T) {
  for (const line of TL.lines) {
    for (const c of line._chunks) {
      if (T >= c.start - 0.05 && T < c.end + 0.25) {
        const rows = wrap(c.text);
        const p = Math.min(1, pop(T, c.start - 0.05, 0.22));
        const baseY = 1690 - (rows.length - 1) * 50;
        let s = `<g transform="translate(540 ${baseY}) scale(${p})">`;
        const tag = { doc: ['의사쌤', '#2E7D63'], narr: ['내레이션', '#8A5A00'] }[line.speaker];
        if (tag) {
          s += `<rect x="-110" y="${-150}" width="220" height="64" rx="32" fill="${tag[1]}"/>`;
          s += `<text x="0" y="${-105}" font-size="40" text-anchor="middle" fill="#fff">${tag[0]}</text>`;
        }
        const w = Math.max(...rows.map(r => r.length)) * 78 + 90;
        s += `<rect x="${-w / 2}" y="-85" width="${w}" height="${rows.length * 100 + 40}" rx="36" fill="#000" opacity=".45"/>`;
        rows.forEach((r, i) => {
          s += outlined(0, i * 100, r, 84, { doc: '#B8FFE4', narr: '#FFE14D' }[line.speaker] || '#fff', '#1B1B1F', 16);
        });
        return s + `</g>`;
      }
    }
  }
  return '';
}


// Attach subtitle chunks and a per-frame mouth lookup to every line.
function prepare() {
  for (const line of TL.lines) {
    line._chunks = chunks(line);
    const sc = TL.scenes.find(s => s.name === line.scene);
    line.sceneStart = sc.start;
    line.mouthAt = lt => {
      const T = lt + sc.start - line.start;
      if (T < 0 || T >= line.end - line.start) return 0;
      return line.mouth[Math.floor(T * TL.fps)] || 0;
    };
    sc.line = sc.line || line;
  }
}
