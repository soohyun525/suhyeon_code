# Saju · Korean Destiny Reading 사주

A web app that reads your **Saju (사주)** — the Korean *Four Pillars of Destiny* —
for an international audience. It calculates your chart from the traditional
**Manseryeok (만세력)** and uses AI to interpret it in plain English.

- **Free tier:** your Four Pillars chart, five-element balance, an overview, and
  a personality analysis.
- **Premium tier ($9, one-time via Stripe):** an in-depth report covering career,
  wealth, relationships, health, life phases, lucky elements, and guidance.

## How it works

```
Birth date/time/zone ─▶ Manseryeok engine ─▶ Four Pillars + 五行 balance ─▶ Claude ─▶ English reading
                         (src/lib/saju)                                      (src/lib/ai.ts)
```

The Saju engine (`src/lib/saju/`) is a from-scratch TypeScript implementation:

- **Year pillar** changes at **입춘 (Lichun)**, computed from the Sun's true
  ecliptic longitude — not the civil New Year.
- **Month pillar** branch comes from the solar term the birth falls in; the stem
  follows 월두법 (五虎遁).
- **Day pillar** uses the continuous 60-day sexagenary cycle, anchored on the
  documented 1900-01-01 = 甲戌 day.
- **Hour pillar** maps the two-hour 子–亥 blocks; the stem follows 시두법 (五鼠遁).

The astronomy follows Meeus' low-accuracy solar position (accurate to ~0.01°).
Run the engine's self-checks:

```bash
npm run test:saju
```

## Tech stack

- **Next.js 14** (App Router) + TypeScript + React
- **Claude (`claude-opus-4-8`)** via `@anthropic-ai/sdk` with structured outputs
- **Stripe Checkout** for the premium unlock

## Getting started

```bash
npm install
cp .env.example .env.local   # add your keys (both optional for a local demo)
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | AI interpretation. Without it, a templated fallback reading is returned. |
| `STRIPE_SECRET_KEY` | Payments. Without it, the app runs in **demo unlock** mode (no real charge). |
| `DETAILED_READING_PRICE_CENTS` | Premium price in cents (default `900` = $9). |
| `NEXT_PUBLIC_BASE_URL` | Base URL for Stripe redirects (falls back to request origin). |

Both keys are optional: the app is fully functional for local development
without them, degrading gracefully (templated reading, demo unlock).

## Notes

- The day boundary is taken at local midnight. The classic 야자시/조자시 edge
  case (births in the 23:00–24:00 window) uses the calendar-date day pillar.
- Saju is offered for cultural insight and self-reflection — not as a prediction
  of fixed fate.
