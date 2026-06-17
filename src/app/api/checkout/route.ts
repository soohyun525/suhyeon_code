import { NextResponse } from 'next/server';
import { stripe, stripeEnabled, PRICE_CENTS, CURRENCY } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    req.headers.get('origin') ||
    new URL(req.url).origin;

  // Demo mode: no Stripe configured → unlock without a real charge.
  if (!stripeEnabled || !stripe) {
    return NextResponse.json({ demo: true });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: 'Saju — Detailed Destiny Reading',
              description: 'In-depth AI interpretation of your Four Pillars.',
            },
            unit_amount: PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('checkout error', e);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });
  }
}
