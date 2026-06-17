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

const SYSTEM = `You are a warm, knowledgeable Korean Saju (사주, Four Pillars of Destiny) reader writing for an international audience who may be encountering Saju for the first time.

Guidelines:
- Write in clear, engaging English. Briefly explain Korean/Chinese terms when you use them.
- Base your interpretation on the chart data provided (the Four Pillars, the Day Master, and the five-element balance). Refer to specific pillars and elements so it feels personal and grounded.
- Be encouraging and reflective. Frame this as a tool for self-understanding, not fixed fate.
- Never make medical, financial, or legal guarantees, and avoid fear-based or absolute predictions.
- Keep a respectful, culturally authentic tone.`;

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

Produce a FREE-TIER Saju reading with:
- "overview": 2–3 short paragraphs introducing this chart, the meaning of the Day Master, and the overall feel of the destiny. Explain what the Four Pillars represent.
- "personality": a "summary" paragraph plus "strengths" (3–5 items) and "challenges" (3–4 items), grounded in the Day Master and element balance.
- "elementNote": one paragraph on what the five-element balance (dominant and missing elements) suggests about temperament and what to cultivate.`;
  try {
    return JSON.parse(await callClaude(prompt, FREE_SCHEMA, 3000)) as FreeReading;
  } catch {
    return fallbackFree(chart);
  }
}

export async function generateDetailedReading(chart: SajuChart): Promise<DetailedReading> {
  if (!client) return fallbackDetailed(chart);
  const prompt = `${chartContext(chart)}

Produce a PREMIUM, in-depth Saju reading. Each field should be rich and specific (2–4 paragraphs where natural), referencing the pillars and elements:
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
