import type { Metadata } from 'next';
import './globals.css';

const TITLE = 'Saju ✨ What’s Your K-Destiny Type?';
const DESC =
  'The 1,000-year-old Korean cosmic personality read. Meet your Saju type — Main Character Sun? Moonlight Mist? — from your exact birth moment, read to you like a bestie. Free.';

export const metadata: Metadata = {
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
      <body>{children}</body>
    </html>
  );
}
