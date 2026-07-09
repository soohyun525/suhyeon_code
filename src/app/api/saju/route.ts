import { NextResponse } from 'next/server';
import { computeChart, type BirthData } from '@/lib/saju/calculator';
import { serializeChart } from '@/lib/saju/serialize';
import { generateFreeReading } from '@/lib/ai';
import { parseBirthData } from '@/lib/validate';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!rateLimit(`saju:${clientKey(req)}`, 10)) {
    return NextResponse.json({ error: 'Too many readings — take a breath and try again in a minute ✨' }, { status: 429 });
  }
  let birth: BirthData;
  try {
    const body = await req.json();
    birth = parseBirthData(body);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const chart = computeChart(birth);
    const reading = await generateFreeReading(chart);
    return NextResponse.json({ chart: serializeChart(chart), reading });
  } catch (e) {
    console.error('saju route error', e);
    return NextResponse.json({ error: 'Failed to generate reading.' }, { status: 500 });
  }
}
