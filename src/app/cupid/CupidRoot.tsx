'use client';

// UI는 OpenGlass UI (https://github.com/moekoelueker/open-glass-ui, MIT)를 그대로 쓴다.
import 'open-glass-ui/styles.css';
import './cupid.css';
import { GlassSystemProvider } from 'open-glass-ui';

export default function CupidRoot({ children }: { children: React.ReactNode }) {
  return (
    <GlassSystemProvider
      theme={{
        appearance: 'dark',
        defaultAppearance: 'dark',
        theme: { preset: 'violet', accent: '#ff5c9d', radius: 'soft', glass: 'liquid' },
        className: 'cq',
        lang: 'ko',
      }}
    >
      <div className="cq-bg" aria-hidden>
        <i /><i /><i /><i />
      </div>
      {children}
    </GlassSystemProvider>
  );
}
