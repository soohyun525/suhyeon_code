// Saju "types" — a meme-able identity label for each of the 10 Day Masters.
// This is the shareable core of the product (think MBTI energy): every user
// gets a type name + emoji + tagline they can post.

export interface Archetype {
  key: string; // stem romanization
  emoji: string;
  name: string; // the shareable type name
  tagline: string;
  vibe: string; // short "energy" description used on the photocard
}

// Indexed by heavenly-stem index (甲乙丙丁戊己庚辛壬癸).
export const ARCHETYPES: Archetype[] = [
  {
    key: 'Gap',
    emoji: '🌳',
    name: 'Big Tree Energy',
    tagline: 'unbothered, rooted, always growing',
    vibe: 'natural-born leader who grows through everything',
  },
  {
    key: 'Eul',
    emoji: '🌷',
    name: 'Wildflower',
    tagline: 'soft-launch exterior, survivor interior',
    vibe: 'gentle but bends without breaking — ever',
  },
  {
    key: 'Byeong',
    emoji: '☀️',
    name: 'Main Character Sun',
    tagline: 'walks in and the room lights up',
    vibe: 'radiant, magnetic, impossible to ignore',
  },
  {
    key: 'Jeong',
    emoji: '🕯️',
    name: 'Candlelight Muse',
    tagline: 'quiet glow, unreal depth',
    vibe: 'warm in close-up, unforgettable in the dark',
  },
  {
    key: 'Mu',
    emoji: '⛰️',
    name: 'Mountain Unbothered',
    tagline: 'steady, grounded, zero drama',
    vibe: 'the one everyone leans on when it all falls apart',
  },
  {
    key: 'Gi',
    emoji: '🌿',
    name: 'Secret Garden',
    tagline: 'lowkey nurturing, highkey powerful',
    vibe: 'grows people like plants — quietly, completely',
  },
  {
    key: 'Gyeong',
    emoji: '⚔️',
    name: 'Steel Idol',
    tagline: 'sharp, loyal, cuts through nonsense',
    vibe: 'polished under pressure, dangerous when focused',
  },
  {
    key: 'Sin',
    emoji: '💎',
    name: 'Gemstone',
    tagline: 'rare, precise, born polished',
    vibe: 'refined taste, sharper mind, softest core',
  },
  {
    key: 'Im',
    emoji: '🌊',
    name: 'Ocean Deep',
    tagline: 'big feelings, bigger dreams',
    vibe: 'moves like a tide — unstoppable and everywhere',
  },
  {
    key: 'Gye',
    emoji: '🌙',
    name: 'Moonlight Mist',
    tagline: 'intuitive. sees everything. says little.',
    vibe: 'reads the room before entering it',
  },
];

export function archetypeForStem(stemIndex: number): Archetype {
  return ARCHETYPES[stemIndex];
}
