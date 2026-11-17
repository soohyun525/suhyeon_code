import { NextResponse } from 'next/server';
import { runAll } from '@/lib/cupid/engine';
import { parseProfile } from '@/lib/cupid/validate';
import { voiceAll } from '@/lib/cupid/voice';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!rateLimit(`cupid:${clientKey(req)}`, 10)) {
    return NextResponse.json({ error: '요청이 너무 많아요. 1분 뒤에 다시 시도해주세요.' }, { status: 429 });
  }
  let profile;
  try {
    profile = parseProfile((await req.json())?.profile);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const courtships = runAll(profile, new Date());
    const voiced = await voiceAll(profile, courtships);
    return NextResponse.json({ courtships, voiced });
  } catch (e) {
    console.error('cupid match error', e);
    return NextResponse.json({ error: '에이전트를 보내지 못했어요. 다시 시도해주세요.' }, { status: 500 });
  }
}
