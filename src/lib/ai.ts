// AI interpretation of a Saju chart via Claude. Returns structured JSON so the
// UI can render clean sections. If ANTHROPIC_API_KEY is unset, falls back to a
// templated reading so the app stays usable for local demos.

import Anthropic from '@anthropic-ai/sdk';
import { ELEMENT_TRAITS, STEMS, BRANCHES } from './saju/constants';
import { pillarLabel, type SajuChart } from './saju/calculator';
import { archetypeForStem } from './saju/archetypes';

const MODEL = 'claude-opus-4-8';
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export interface FreeReading {
  shareLine: string; // one spicy, postable sentence about them
  overview: string;
  personality: {
    summary: string;
    traits: string[]; // 성격적 특징
    strengths: string[]; // 장점
    weaknesses: string[]; // 단점
    innerConflict: string; // 내적갈등
  };
  elementNote: string;
}

export interface DetailedReading {
  yearFortune: string; // 올해(2026) 운세
  compatibility: string; // 타인과의 궁합
  benefactors: string; // 귀인 (helpful people)
  cautions: string; // 멀리해야 할 상황 / 사람
  career: string;
  wealth: string;
  relationships: string;
  health: string;
  lifePhases: string;
  luckyElements: string;
  advice: string[];
}

const SYSTEM = `You are the reader's close friend who happens to know Korean Saju (사주, the Four Pillars of Destiny) really well — and you're reading their chart for them over coffee. The reader is international and may be new to Saju.

Voice:
- Talk TO them, warmly and directly, in second person ("you"). Use their name if given. Sound like a real friend, not a textbook or a fortune-cookie machine — curious, affectionate, a little playful, genuinely excited to share what you see.
- Your audience lives on TikTok and loves K-pop and astrology memes. A light Gen-Z internet-native energy is welcome (e.g. "main character", "lowkey", "era") — but sparingly, like seasoning; never forced, never more than a couple per section.
- Use natural, conversational English. When a Korean/Chinese term slips in, explain it casually like you would to a friend ("your Day Master — basically 'you' in the chart").
- React to what's actually in their chart (specific pillars, the Day Master, the element balance). Point things out like you noticed them: "see how Fire shows up twice? that tracks with…". Make it feel personal and observed, never generic.
- Be encouraging and honest. Name the tricky parts gently, the way a good friend would — as something to grow into, not a verdict.

Boundaries:
- Never make medical, financial, or legal guarantees, and avoid fear-based or absolute predictions.
- This is for reflection and fun, not fixed fate — keep that spirit. Stay respectful and culturally authentic.`;

function yearPillarLabel(y: number): string {
  const s = STEMS[(((y - 4) % 10) + 10) % 10];
  const b = BRANCHES[(((y - 4) % 12) + 12) % 12];
  return `${s.rom}-${b.rom} (${s.han}${b.han}) — ${s.yin ? 'Yin' : 'Yang'} ${s.element} ${b.animal}`;
}

function pillarDetail(label: string, p: SajuChart['pillars']['year'] | null): string {
  if (!p) return `  ${label}: unknown (omitted)`;
  const stemGod = p.tenGod ? `${p.tenGod.ko}/${p.tenGod.en}` : 'Day Master (self)';
  return `  ${label}: ${pillarLabel(p)} — stem Ten God: ${stemGod}; branch Ten God: ${p.branchTenGod.ko}/${p.branchTenGod.en}; life stage: ${p.stage.ko}/${p.stage.en}; hidden stems: ${p.hidden.map((h) => h.han).join('')}`;
}

function chartContext(chart: SajuChart): string {
  const p = chart.pillars;
  const lines = [
    `Name: ${chart.birth.name || 'the seeker'}`,
    `Gender: ${chart.birth.gender || 'unspecified'}`,
    `Birth (local time): ${chart.birth.year}-${String(chart.birth.month).padStart(2, '0')}-${String(
      chart.birth.day,
    ).padStart(2, '0')} ${chart.birth.timeUnknown ? '(time unknown)' : `${String(chart.birth.hour).padStart(2, '0')}:${String(chart.birth.minute).padStart(2, '0')}`}`,
    `Zodiac animal (year branch): ${chart.zodiacAnimal}`,
    '',
    'Four Pillars (사주) with full detail:',
    pillarDetail('Year ', p.year),
    pillarDetail('Month', p.month),
    pillarDetail('Day  ', p.day),
    pillarDetail('Hour ', p.hour),
    '',
    `Day Master (일간, "the self"): ${chart.dayMaster.rom} (${chart.dayMaster.han}) — ${
      chart.dayMaster.yin ? 'Yin' : 'Yang'
    } ${chart.dayMaster.element}. Symbolism: ${ELEMENT_TRAITS[chart.dayMaster.element]}.`,
    (() => {
      const a = archetypeForStem(chart.pillars.day.stemIndex);
      return `Their Saju type (our shareable archetype for this Day Master): ${a.emoji} "${a.name}" — ${a.tagline}. Reference it naturally once or twice.`;
    })(),
    '',
    'Five-element balance (오행):',
    ...Object.entries(chart.elementCounts).map(([el, n]) => `  ${el}: ${n}`),
    `Dominant element: ${chart.dominantElement}.`,
    `Missing element(s): ${chart.lackingElements.length ? chart.lackingElements.join(', ') : 'none'}.`,
    '',
    `Ten Gods (십성) present across the chart shape the personality and life themes — weave them in.`,
    '',
    'Spirit stars (신살):',
    ...(chart.sinsal.length
      ? chart.sinsal.map((s) => `  ${s.ko}/${s.en} (${s.where.join(', ')}): ${s.desc}`)
      : ['  none of the major stars']),
    '',
    `Daeun (대운, 10-year luck), ${chart.daeun.forward ? 'forward' : 'reverse'} from age ${chart.daeun.startAge}:`,
    ...chart.daeun.pillars
      .slice(0, 6)
      .map((d) => `  age ${d.age}: ${d.stem.rom}-${d.branch.rom} (${d.stem.han}${d.branch.han}), ${d.tenGod.ko}/${d.tenGod.en}`),
    '',
    `Saeun (세운, yearly luck) — this year ${chart.currentSaeun.year}: ${chart.currentSaeun.stem.han}${chart.currentSaeun.branch.han} (${chart.currentSaeun.stem.rom}-${chart.currentSaeun.branch.rom}), Ten God ${chart.currentSaeun.tenGod.ko}/${chart.currentSaeun.tenGod.en}.`,
  ];
  return lines.join('\n');
}

const FREE_SCHEMA = {
  type: 'object',
  properties: {
    shareLine: { type: 'string' },
    overview: { type: 'string' },
    personality: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        traits: { type: 'array', items: { type: 'string' } },
        strengths: { type: 'array', items: { type: 'string' } },
        weaknesses: { type: 'array', items: { type: 'string' } },
        innerConflict: { type: 'string' },
      },
      required: ['summary', 'traits', 'strengths', 'weaknesses', 'innerConflict'],
      additionalProperties: false,
    },
    elementNote: { type: 'string' },
  },
  required: ['shareLine', 'overview', 'personality', 'elementNote'],
  additionalProperties: false,
};

const DETAILED_SCHEMA = {
  type: 'object',
  properties: {
    yearFortune: { type: 'string' },
    compatibility: { type: 'string' },
    benefactors: { type: 'string' },
    cautions: { type: 'string' },
    career: { type: 'string' },
    wealth: { type: 'string' },
    relationships: { type: 'string' },
    health: { type: 'string' },
    lifePhases: { type: 'string' },
    luckyElements: { type: 'string' },
    advice: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'yearFortune',
    'compatibility',
    'benefactors',
    'cautions',
    'career',
    'wealth',
    'relationships',
    'health',
    'lifePhases',
    'luckyElements',
    'advice',
  ],
  additionalProperties: false,
};

async function callClaude(prompt: string, schema: object, maxTokens: number): Promise<string> {
  // output_config is the current structured-outputs surface; cast keeps us
  // resilient to SDK typing differences.
  const res = await client!.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema } },
  } as any);
  const text = res.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  return text;
}

export async function generateFreeReading(chart: SajuChart): Promise<FreeReading> {
  if (!client) return fallbackFree(chart);
  const prompt = `${chartContext(chart)}

Read this for them like a friend would, in the warm second-person voice. Return a FREE-TIER reading with a genuinely useful personality picture:
- "shareLine": ONE postable sentence (max ~120 chars) that captures them so precisely it's almost unfair — spicy, specific to THEIR chart, screenshot-worthy. No hashtags, no emoji. Think "the caption they'd post". Written in second person.
- "overview": 2–3 short paragraphs easing them in — what their chart feels like at a glance, who their Day Master makes them, and what the Four Pillars are (explained casually). Talk to them, not about them.
- "personality":
    - "summary": a conversational paragraph describing who they are, like you're describing them to their face.
    - "traits": 4–6 short personality characteristics (성격적 특징) — the defining notes of their temperament.
    - "strengths": 3–5 short items (장점).
    - "weaknesses": 3–4 short, kind items (단점) — honest but gentle.
    - "innerConflict": one warm paragraph on the inner tension they likely carry (내적갈등) — the push-and-pull inside them implied by the Day Master and element balance (e.g. craving freedom yet needing security). This is the emotionally resonant heart of the free reading.
- "elementNote": one friendly paragraph on what their element balance (what's strong, what's missing) says about them and what's worth leaning into.`;
  try {
    return JSON.parse(await callClaude(prompt, FREE_SCHEMA, 3500)) as FreeReading;
  } catch {
    return fallbackFree(chart);
  }
}

export async function generateDetailedReading(chart: SajuChart): Promise<DetailedReading> {
  if (!client) return fallbackDetailed(chart);
  const year = new Date().getFullYear();
  const prompt = `${chartContext(chart)}

The current year is ${year}, whose Saju pillar is ${yearPillarLabel(year)}. Interpret how this year's energy interacts with their chart.

Now go deep — same warm, friend-to-friend voice, talking directly to them. This is the PREMIUM reading, so be generous and specific (2–4 paragraphs where natural), always tying it back to their actual pillars and elements:
- "yearFortune": their outlook for ${year} specifically — how the ${yearPillarLabel(year)} year meets their chart, what to lean into and watch for this year, across work, money, love, and well-being. Make it feel timely and concrete.
- "compatibility": how they tend to click (or clash) with others — which Day Masters / elements / zodiac animals harmonize with them and which create friction, in love, friendship, and work.
- "benefactors": their 귀인 (helpful people / fortunate allies) — the kinds of people, element types, or situations that tend to lift them up, and how to recognize and attract them.
- "cautions": situations and types of people to be careful around or keep at a distance — patterns that drain or destabilize them, framed constructively (not as fear).
- "career": vocational tendencies, work style, and fields that suit their Day Master and element profile.
- "wealth": their relationship with money, earning style, and prosperity tendencies.
- "relationships": love, family, and social dynamics in depth.
- "health": general constitution and well-being themes from the element balance (no diagnoses).
- "lifePhases": how energy and fortune may shift across early life, mid-life, and later years.
- "luckyElements": which elements to strengthen or balance, with concrete everyday suggestions (colors, directions, activities, seasons).
- "advice": 4–6 practical, uplifting pieces of life guidance.`;
  try {
    return JSON.parse(await callClaude(prompt, DETAILED_SCHEMA, 6000)) as DetailedReading;
  } catch {
    return fallbackDetailed(chart);
  }
}

// ── Offline / no-key fallbacks (templated, clearly non-AI) ──────────────────
function fallbackFree(chart: SajuChart): FreeReading {
  const dm = chart.dayMaster;
  const trait = ELEMENT_TRAITS[dm.element];
  const traitWords = trait.split(', ').map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  return {
    shareLine: `You lead with ${trait.split(', ')[0]} and everyone around you can feel it.`,
    overview: `Your Four Pillars center on a ${dm.yin ? 'Yin' : 'Yang'} ${dm.element} Day Master (${dm.rom}, ${dm.han}) — this is "the self" in Saju, the lens through which your whole chart is read. Your year branch makes you a ${chart.zodiacAnimal}. The Four Pillars (year, month, day, hour) map the seasons of your life: ancestry and early years, family and growth, your core self and partnerships, and your later years and legacy.\n\n(This is a templated reading. Add an ANTHROPIC_API_KEY to unlock AI-generated interpretation.)`,
    personality: {
      summary: `As a ${dm.element} Day Master, your nature leans toward ${trait}. Your chart's dominant element is ${chart.dominantElement}, which colors how you meet the world.`,
      traits: traitWords,
      strengths: traitWords.slice(0, 3).map((t) => `Strong sense of ${t.toLowerCase()}`),
      weaknesses: chart.lackingElements.length
        ? chart.lackingElements.map((e) => `Can underuse ${e} qualities (${ELEMENT_TRAITS[e]})`)
        : ['Your strongest tendencies can overshadow subtler ones'],
      innerConflict: `As a ${dm.element} type you may feel a pull between ${trait.split(', ')[0]} and the balance your chart's ${
        chart.lackingElements[0] || 'quieter'
      } side asks for — a quiet tension between who you are and who you're growing into.`,
    },
    elementNote: `Your element balance is dominant in ${chart.dominantElement}${
      chart.lackingElements.length ? ` and light on ${chart.lackingElements.join(', ')}` : ''
    }. In Saju, harmony among the five elements supports steadiness; leaning into what is missing is a gentle way to grow.`,
  };
}

function fallbackDetailed(chart: SajuChart): DetailedReading {
  const dm = chart.dayMaster;
  const year = new Date().getFullYear();
  return {
    yearFortune: `In ${year}, the year's energy meets your ${dm.element} Day Master in its own way — a season to lean into your strengths and tend your balance. (Templated — add an ANTHROPIC_API_KEY for a full AI reading.)`,
    compatibility: `Your ${dm.yin ? 'Yin' : 'Yang'} ${dm.element} nature tends to harmonize with complementary elements and clash with those that overwhelm it.`,
    benefactors: `Your 귀인 (helpful allies) are often people who carry the ${chart.lackingElements[0] || 'balancing'} energy your chart is lighter on.`,
    cautions: `Be mindful around situations that overload your dominant ${chart.dominantElement} energy or drain your reserves.`,
    career: `A ${dm.element} Day Master often thrives in work that expresses ${ELEMENT_TRAITS[dm.element]}.`,
    wealth: `Your dominant ${chart.dominantElement} energy shapes a distinctive relationship with resources and timing.`,
    relationships: `In partnership, your ${dm.yin ? 'Yin' : 'Yang'} ${dm.element} nature seeks complementary energy that balances your chart.`,
    health: `Element balance points to tending your ${chart.lackingElements[0] || 'most overextended'} side for overall well-being.`,
    lifePhases: `The pillars suggest your energy matures across early, middle, and later seasons of life.`,
    luckyElements: `Strengthening ${chart.lackingElements[0] || chart.dominantElement} energy — through its colors, seasons, and activities — can bring balance.`,
    advice: [
      'Lean into your natural strengths while gently developing what your chart lacks.',
      'Treat this reading as a mirror for reflection, not a fixed script.',
      'Notice which life seasons energize you and plan around them.',
    ],
  };
}
