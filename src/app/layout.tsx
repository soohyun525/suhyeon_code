import type { Metadata } from 'next';
import { Jua, Baloo_2 } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

// Chunky rounded fonts for the MapleStory-style cartoon UI.
const jua = Jua({ weight: '400', subsets: ['latin'], variable: '--font-head' });
const baloo = Baloo_2({ subsets: ['latin'], variable: '--font-body' });

const TITLE = 'Saju ✨ What’s Your K-Destiny Type?';
const DESC =
  'The 1,000-year-old Korean cosmic personality read. Meet your Saju type — Main Character Sun? Moonlight Mist? — from your exact birth moment, read to you like a bestie. Free.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: TITLE,
  description: DESC,
  openGraph: {
    title: TITLE,
    description: DESC,
    type: 'website',
    siteName: 'Saju — Korean Destiny Reading',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jua.variable} ${baloo.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
