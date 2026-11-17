// 선택 기능: Claude가 에이전트 대사를 자연스럽게 다듬는다.
// 사실(이름·날짜·장소·점수)은 engine.ts가 정했고, 여기서는 문장만 바뀐다.
// 키가 없거나 실패하면 원래 대사를 그대로 쓴다.

import Anthropic from '@anthropic-ai/sdk';
import type { Courtship, Profile } from './types';

const MODEL = 'claude-haiku-5-5';
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey, timeout: 25_000, maxRetries: 0 }) : null;

const TONE = { polite: '정중하고 따뜻하게', witty: '재치 있고 장난스럽게', direct: '짧고 솔직하게' };

export async function voiceAll(me: Profile, courtships: Courtship[]): Promise<boolean> {
  if (!client) return false;
  const lines = courtships.flatMap((c) =>
    c.messages.map((m) => ({ who: m.from === 'mine' ? `${me.name}의 에이전트` : `${c.card.name}의 에이전트`, text: m.text })),
  );
  if (!lines.length) return false;
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system:
        '너는 소개팅을 주선하는 AI 에이전트들의 대화를 다듬는 편집자다. 각 줄을 자연스러운 한국어 대화체로 고쳐 쓴다. ' +
        '규칙: 이름, 날짜, 시간, 장소, 점수, 숫자, 통과/거절 여부는 절대 바꾸거나 더하지 않는다. 새 사실을 지어내지 않는다. 한 줄은 두 문장 이내. ' +
        `"${me.name}의 에이전트"는 ${TONE[me.tone]} 말한다. 입력과 같은 개수, 같은 순서로 돌려준다.`,
      messages: [{ role: 'user', content: JSON.stringify(lines) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { lines: { type: 'array', items: { type: 'string' } } },
            required: ['lines'],
            additionalProperties: false,
          },
        },
      },
    } as any);
    const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const out: unknown = JSON.parse(text).lines;
    if (!Array.isArray(out) || out.length !== lines.length || out.some((s) => typeof s !== 'string' || !s.trim())) return false;
    let i = 0;
    for (const c of courtships) for (const m of c.messages) m.text = out[i++] as string;
    return true;
  } catch (e) {
    console.error('cupid voice fallback', e);
    return false;
  }
}
