import { NextResponse } from 'next/server';
import { computeChart, type BirthData } from '@/lib/saju/calculator';
import { generateDetailedReading } from '@/lib/ai';
import { parseBirthData } from '@/lib/validate';
import { stripe, stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // ── Verify payment ──
  if (stripeEnabled && stripe) {
    const sessionId = body?.sessionId;
    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'Payment required.' }, { status: 402 });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Payment not completed.' }, { status: 402 });
      }
    } catch {
      return NextResponse.json({ error: 'Could not verify payment.' }, { status: 402 });
    }
  }
  // In demo mode (no Stripe), access is granted without verification.

  let birth: BirthData;
  try {
    birth = parseBirthData(body?.birth);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const chart = computeChart(birth);
    const reading = await generateDetailedReading(chart);
    return NextResponse.json({ reading });
  } catch (e) {
    console.error('detailed route error', e);
    return NextResponse.json({ error: 'Failed to generate detailed reading.' }, { status: 500 });
  }
}
