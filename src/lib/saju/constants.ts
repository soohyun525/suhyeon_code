// Reference data for the Four Pillars (사주팔자) of Korean Saju.
// Heavenly Stems (천간) and Earthly Branches (지지), with romanization,
// five-element (오행) assignment, polarity, and zodiac animals — all in
// English for a foreign audience.

export type Element = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

export interface Stem {
  han: string; // Chinese character
  rom: string; // Korean romanization
  element: Element;
  yin: boolean; // true = yin (음), false = yang (양)
}

export interface Branch {
  han: string;
  rom: string;
  element: Element;
  animal: string;
  yin: boolean;
}

// 天干 — 10 Heavenly Stems
export const STEMS: Stem[] = [
  { han: '甲', rom: 'Gap', element: 'Wood', yin: false },
  { han: '乙', rom: 'Eul', element: 'Wood', yin: true },
  { han: '丙', rom: 'Byeong', element: 'Fire', yin: false },
  { han: '丁', rom: 'Jeong', element: 'Fire', yin: true },
  { han: '戊', rom: 'Mu', element: 'Earth', yin: false },
  { han: '己', rom: 'Gi', element: 'Earth', yin: true },
  { han: '庚', rom: 'Gyeong', element: 'Metal', yin: false },
  { han: '辛', rom: 'Sin', element: 'Metal', yin: true },
  { han: '壬', rom: 'Im', element: 'Water', yin: false },
  { han: '癸', rom: 'Gye', element: 'Water', yin: true },
];

// 地支 — 12 Earthly Branches
export const BRANCHES: Branch[] = [
  { han: '子', rom: 'Ja', element: 'Water', animal: 'Rat', yin: false },
  { han: '丑', rom: 'Chuk', element: 'Earth', animal: 'Ox', yin: true },
  { han: '寅', rom: 'In', element: 'Wood', animal: 'Tiger', yin: false },
  { han: '卯', rom: 'Myo', element: 'Wood', animal: 'Rabbit', yin: true },
  { han: '辰', rom: 'Jin', element: 'Earth', animal: 'Dragon', yin: false },
  { han: '巳', rom: 'Sa', element: 'Fire', animal: 'Snake', yin: true },
  { han: '午', rom: 'O', element: 'Fire', animal: 'Horse', yin: false },
  { han: '未', rom: 'Mi', element: 'Earth', animal: 'Goat', yin: true },
  { han: '申', rom: 'Sin', element: 'Metal', animal: 'Monkey', yin: false },
  { han: '酉', rom: 'Yu', element: 'Metal', animal: 'Rooster', yin: true },
  { han: '戌', rom: 'Sul', element: 'Earth', animal: 'Dog', yin: false },
  { han: '亥', rom: 'Hae', element: 'Water', animal: 'Pig', yin: true },
];

export const ELEMENTS: Element[] = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

// Hex colors used in the UI element-balance chart.
export const ELEMENT_COLORS: Record<Element, string> = {
  Wood: '#3a9d6e',
  Fire: '#d8503a',
  Earth: '#c79a3e',
  Metal: '#9aa3ad',
  Water: '#3b6fb6',
};

// A short English gloss for each element's symbolism.
export const ELEMENT_TRAITS: Record<Element, string> = {
  Wood: 'growth, ambition, compassion, planning',
  Fire: 'passion, expression, energy, charisma',
  Earth: 'stability, reliability, nurturing, patience',
  Metal: 'discipline, structure, justice, determination',
  Water: 'wisdom, adaptability, intuition, communication',
};
