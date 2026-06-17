import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Saju · Korean Destiny Reading',
  description:
    'Discover your Saju (사주) — the ancient Korean Four Pillars of Destiny — calculated from the Manseryeok and interpreted by AI. Free personality reading, with an optional in-depth report.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
