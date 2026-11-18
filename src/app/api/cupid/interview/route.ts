import { NextResponse } from 'next/server';
import { InterviewError, QUESTIONS, readInsight } from '@/lib/cupid/interview';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!rateLimit(`cupid-interview:${clientKey(req)}`, 6)) {
    return NextResponse.json({ error: '요청이 너무 많아요. 1분 뒤에 다시 시도해주세요.' }, { status: 429 });
  }
  try {
    const body = (await req.json())?.answers ?? {};
    // 허용된 질문의 답만, 길이를 제한해서 받는다. 답은 저장하지 않는다.
    const answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, String(body[q.id] ?? '').slice(0, 600)]));
    return NextResponse.json({ insight: await readInsight(answers) });
  } catch (e) {
    if (e instanceof InterviewError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error('cupid interview error', e);
    return NextResponse.json({ error: '이야기를 읽지 못했어요. 다시 시도해주세요.' }, { status: 500 });
  }
}
