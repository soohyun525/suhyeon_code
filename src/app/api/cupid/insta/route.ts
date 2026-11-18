import { NextResponse } from 'next/server';
import { fetchFeed, InstaError, parseHandle, readTaste } from '@/lib/cupid/insta';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!rateLimit(`cupid-insta:${clientKey(req)}`, 6)) {
    return NextResponse.json({ error: '요청이 너무 많아요. 1분 뒤에 다시 시도해주세요.' }, { status: 429 });
  }
  try {
    const handle = parseHandle((await req.json())?.handle);
    return NextResponse.json({ taste: readTaste(await fetchFeed(handle)) });
  } catch (e) {
    if (e instanceof InstaError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error('cupid insta error', e);
    return NextResponse.json({ error: '인스타그램을 읽어오지 못했어요. 직접 입력으로 진행해주세요.' }, { status: 500 });
  }
}
