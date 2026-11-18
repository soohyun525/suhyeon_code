// 깊은 대화 → 속마음 읽기.
// 여섯 가지 질문에 대한 이야기에서, 말로 고른 이상형이 아니라 반복해서 나오는 바람을 찾는다.
// 키가 있으면 Claude가 읽고(허용 목록 안에서만 고른다), 없거나 실패하면 낱말 사전으로 센다.

import Anthropic from '@anthropic-ai/sdk';
import { NEEDS, needLabel, type Need } from './psych';
import { QUESTIONS } from './questions';

export { QUESTIONS };

export interface Insight {
  needs: Need[]; // 가장 자주 드러난 바람 (최대 2)
  evidence: { need: Need; count: number }[];
  stated: string; // 본인이 말한 이상형
  gap: string; // 말한 것과 드러난 것의 차이
  source: 'ai' | 'rule';
}

export class InterviewError extends Error {}

const WORDS: Record<Need, string[]> = {
  steady: ['편안', '편했', '안정', '한결', '꾸준', '불안', '연락', '믿', '변하지', '일관', '확신', '기다리', '잠수'],
  space: ['혼자', '자유', '간섭', '집착', '답답', '존중', '각자', '공간', '숨'],
  praise: ['칭찬', '인정', '고맙', '알아주', '표현', '예쁘다', '멋지다', '무시', '당연하게'],
  fun: ['웃', '재미', '장난', '설레', '유머', '새로운', '즉흥', '지루'],
  depth: ['대화', '이야기', '들어주', '들어줬', '공감', '말이 통', '솔직', '깊', '이해'],
  support: ['챙겨', '챙겼', '도와', '곁', '응원', '힘이', '든든', '의지', '위로', '옆에', '다정'],
};

const tally = (text: string) =>
  (Object.keys(WORDS) as Need[])
    .map((need) => ({ need, count: WORDS[need].reduce((n, w) => n + (text.split(w).length - 1), 0) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

function gapLine(stated: string, needs: Need[]): string {
  const statedNeeds = tally(stated).map((x) => x.need);
  const top = needs[0];
  if (!stated.trim()) return `이야기에서는 ${needLabel(top)}이(가) 가장 자주 나왔어요.`;
  return statedNeeds.includes(top)
    ? `말한 이상형과 이야기 속 바람이 같은 방향이에요. 둘 다 ${needLabel(top)}을(를) 가리켜요.`
    : `이상형은 "${stated.trim()}"(이)라고 했지만, 이야기에서 가장 자주 나온 건 ${needLabel(top)}이에요.`;
}

/** 낱말 사전으로 읽기. 같은 입력이면 항상 같은 결과. */
export function readByRule(answers: Record<string, string>): Insight {
  const stated = answers.ideal ?? '';
  const story = QUESTIONS.filter((q) => q.id !== 'ideal').map((q) => answers[q.id] ?? '').join('\n');
  const evidence = tally(story);
  if (evidence.length === 0) throw new InterviewError('이야기가 조금 짧아요. 두세 문장만 더 들려주세요.');
  const needs = evidence.slice(0, 2).map((x) => x.need);
  return { needs, evidence: evidence.slice(0, 4), stated: stated.trim(), gap: gapLine(stated, needs), source: 'rule' };
}

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 }) : null;
const IDS = NEEDS.map((n) => n.id);

export async function readInsight(answers: Record<string, string>): Promise<Insight> {
  const filled = QUESTIONS.filter((q) => (answers[q.id] ?? '').trim().length >= 4).length;
  if (filled < 3) throw new InterviewError('세 가지 이상 답해주시면 읽어볼 수 있어요.');
  const rule = (() => { try { return readByRule(answers); } catch { return null; } })();
  if (!client) {
    if (!rule) throw new InterviewError('이야기가 조금 짧아요. 두세 문장만 더 들려주세요.');
    return rule;
  }
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 600,
      system:
        '너는 소개팅 주선자의 메모를 정리한다. 사용자의 연애 이야기에서 반복해서 드러나는 바람을 고른다. ' +
        `고를 수 있는 값: ${NEEDS.map((n) => `${n.id}(${n.label})`).join(', ')}. ` +
        '이상형 질문(ideal)의 답이 아니라 나머지 이야기에서 드러나는 것을 기준으로, 가장 강한 것부터 1~2개 고른다. ' +
        '진단하지 않는다. 상처·트라우마·병리 표현을 쓰지 않는다. 이야기에 없는 사실을 만들지 않는다.',
      messages: [{ role: 'user', content: JSON.stringify(answers) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { needs: { type: 'array', items: { type: 'string', enum: IDS } } },
            required: ['needs'],
            additionalProperties: false,
          },
        },
      },
    } as any);
    const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const needs = (JSON.parse(text).needs as string[]).filter((n): n is Need => IDS.includes(n as Need)).slice(0, 2);
    if (needs.length === 0) throw new Error('empty');
    const stated = (answers.ideal ?? '').trim();
    return { needs, evidence: rule?.evidence ?? [], stated, gap: gapLine(stated, needs), source: 'ai' };
  } catch (e) {
    console.error('cupid interview fallback', e);
    if (!rule) throw new InterviewError('이야기를 읽지 못했어요. 조금만 더 들려주세요.');
    return rule;
  }
}
