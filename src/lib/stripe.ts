// Stripe helper. When STRIPE_SECRET_KEY is unset the app runs in "demo unlock"
// mode (no real charge) so it can be developed and demoed without an account.
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;
export const stripeEnabled = Boolean(secret);

export const stripe = secret ? new Stripe(secret) : null;

export const PRICE_CENTS = Number(process.env.DETAILED_READING_PRICE_CENTS || 900);
export const CURRENCY = process.env.DETAILED_READING_CURRENCY || 'usd';
