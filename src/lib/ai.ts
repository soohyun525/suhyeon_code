// AI interpretation of a Saju chart via Claude. Returns structured JSON so the
// UI can render clean sections. If ANTHROPIC_API_KEY is unset, falls back to a
// templated reading so the app stays usable for local demos.

import Anthropic from '@anthropic-ai/sdk';
import { ELEMENT_TRAITS } from './saju/constants';
import { pillarLabel, type SajuChart } from './saju/calculator';

const MODEL = 'claude-opus-4-8';
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export interface FreeReading {
  overview: string;
  personality: {
    summary: string;
    strengths: string[];
    challenges: string[];
  };
  elementNote: string;
}

export interface DetailedReading {
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
- Use natural, conversational English. When a Korean/Chinese term slips in, explain it casually like you would to a friend ("your Day Master — basically 'you' in the chart").
- React to what's actually in their chart (specific pillars, the Day Master, the element balance). Point things out like you noticed them: "see how Fire shows up twice? that tracks with…". Make it feel personal and observed, never generic.
- Be encouraging and honest. Name the tricky parts gently, the way a good friend would — as something to grow into, not a verdict.

Boundaries:
- Never make medical, financial, or legal guarantees, and avoid fear-based or absolute predictions.
- This is for reflection and fun, not fixed fate — keep that spirit. Stay respectful and culturally authentic.`;

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
    'Four Pillars (사주):',
    `  Year pillar:  ${pillarLabel(p.year)}`,
    `  Month pillar: ${pillarLabel(p.month)}`,
    `  Day pillar:   ${pillarLabel(p.day)}`,
    `  Hour pillar:  ${p.hour ? pillarLabel(p.hour) : 'unknown (omitted)'}`,
    '',
    `Day Master (일간, "the self"): ${chart.dayMaster.rom} (${chart.dayMaster.han}) — ${
      chart.dayMaster.yin ? 'Yin' : 'Yang'
    } ${chart.dayMaster.element}. Symbolism: ${ELEMENT_TRAITS[chart.dayMaster.element]}.`,
    '',
    'Five-element balance (오행):',
    ...Object.entries(chart.elementCounts).map(([el, n]) => `  ${el}: ${n}`),
    `Dominant element: ${chart.dominantElement}.`,
    `Missing element(s): ${chart.lackingElements.length ? chart.lackingElements.join(', ') : 'none'}.`,
  ];
  return lines.join('\n');
}

const FREE_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    personality: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        strengths: { type: 'array', items: { type: 'string' } },
        challenges: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'strengths', 'challenges'],
      additionalProperties: false,
    },
    elementNote: { type: 'string' },
  },
  required: ['overview', 'personality', 'elementNote'],
  additionalProperties: false,
};

const DETAILED_SCHEMA = {
  type: 'object',
  properties: {
    career: { type: 'string' },
    wealth: { type: 'string' },
    relationships: { type: 'string' },
    health: { type: 'string' },
    lifePhases: { type: 'string' },
    luckyElements: { type: 'string' },
    advice: { type: 'array', items: { type: 'string' } },
  },
  required: ['career', 'wealth', 'relationships', 'health', 'lifePhases', 'luckyElements', 'advice'],
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

Read this for them like a friend would, in the warm second-person voice. Return a FREE-TIER reading with:
- "overview": 2–3 short paragraphs easing them in — what their chart feels like at a glance, who their Day Master makes them, and what the Four Pillars are (explained casually). Talk to them, not about them.
- "personality": a "summary" paragraph (conversational, like you're describing them to their face), plus "strengths" (3–5 short items) and "challenges" (3–4 short, kind items).
- "elementNote": one friendly paragraph on what their element balance (what's strong, what's missing) says about them and what's worth leaning into.`;
  try {
    return JSON.parse(await callClaude(prompt, FREE_SCHEMA, 3000)) as FreeReading;
  } catch {
    return fallbackFree(chart);
  }
}

export async function generateDetailedReading(chart: SajuChart): Promise<DetailedReading> {
  if (!client) return fallbackDetailed(chart);
  const prompt = `${chartContext(chart)}

Now go deep — same warm, friend-to-friend voice, talking directly to them. This is the PREMIUM reading, so be generous and specific (2–4 paragraphs where natural), always tying it back to their actual pillars and elements:
- "career": vocational tendencies, work style, fields that may suit the Day Master and element profile.
- "wealth": relationship with money, earning style, and prosperity tendencies.
- "relationships": love, compatibility patterns, family and social dynamics.
- "health": general constitution and well-being themes implied by the element balance (no diagnoses).
- "lifePhases": how energy and fortune may shift across early life, mid-life, and later years.
- "luckyElements": which of the five elements to strengthen or balance, with concrete everyday suggestions (colors, directions, activities, seasons).
- "advice": 4–6 practical, uplifting pieces of life guidance.`;
  try {
    return JSON.parse(await callClaude(prompt, DETAILED_SCHEMA, 8000)) as DetailedReading;
  } catch {
    return fallbackDetailed(chart);
  }
}

// ── Offline / no-key fallbacks (templated, clearly non-AI) ──────────────────
function fallbackFree(chart: SajuChart): FreeReading {
  const dm = chart.dayMaster;
  const trait = ELEMENT_TRAITS[dm.element];
  return {
    overview: `Your Four Pillars center on a ${dm.yin ? 'Yin' : 'Yang'} ${dm.element} Day Master (${dm.rom}, ${dm.han}) — this is "the self" in Saju, the lens through which your whole chart is read. Your year branch makes you a ${chart.zodiacAnimal}. The Four Pillars (year, month, day, hour) map the seasons of your life: ancestry and early years, family and growth, your core self and partnerships, and your later years and legacy.\n\n(This is a templated reading. Add an ANTHROPIC_API_KEY to unlock AI-generated interpretation.)`,
    personality: {
      summary: `As a ${dm.element} Day Master, your nature leans toward ${trait}. Your chart's dominant element is ${chart.dominantElement}, which colors how you meet the world.`,
      strengths: trait.split(', ').map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
      challenges: chart.lackingElements.length
        ? chart.lackingElements.map((e) => `Cultivating ${e} energy (${ELEMENT_TRAITS[e]})`)
        : ['Balancing your strongest tendencies so they do not overwhelm subtler ones'],
    },
    elementNote: `Your element balance is dominant in ${chart.dominantElement}${
      chart.lackingElements.length ? ` and light on ${chart.lackingElements.join(', ')}` : ''
    }. In Saju, harmony among the five elements supports steadiness; leaning into what is missing is a gentle way to grow.`,
  };
}

function fallbackDetailed(chart: SajuChart): DetailedReading {
  const dm = chart.dayMaster;
  return {
    career: `A ${dm.element} Day Master often thrives in work that expresses ${ELEMENT_TRAITS[dm.element]}. (Templated — add an ANTHROPIC_API_KEY for a full AI reading.)`,
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
