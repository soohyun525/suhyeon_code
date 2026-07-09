import { NextResponse } from 'next/server';
import { computeChart } from '@/lib/saju/calculator';
import { computeCompat } from '@/lib/saju/compat';
import { archetypeForStem } from '@/lib/saju/archetypes';
import { generateCompatReading } from '@/lib/ai';
import { parseBirthData } from '@/lib/validate';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  let a, b;
  try {
    a = parseBirthData(body?.a);
    b = parseBirthData(body?.b);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const chartA = computeChart(a);
    const chartB = computeChart(b);
    const compat = computeCompat(chartA, chartB);
    const reading = await generateCompatReading(chartA, chartB, compat.score, compat.factors);

    const lite = (c: typeof chartA) => ({
      name: c.birth.name || null,
      archetype: archetypeForStem(c.pillars.day.stemIndex),
      dayMaster: {
        han: c.dayMaster.han,
        rom: c.dayMaster.rom,
        element: c.dayMaster.element,
        yin: c.dayMaster.yin,
      },
      zodiacAnimal: c.zodiacAnimal,
    });

    return NextResponse.json({
      a: lite(chartA),
      b: lite(chartB),
      score: compat.score,
      label: compat.label,
      factors: compat.factors,
      reading,
    });
  } catch (e) {
    console.error('compat route error', e);
    return NextResponse.json({ error: 'Failed to compute compatibility.' }, { status: 500 });
  }
}
