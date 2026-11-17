import type { Metadata } from 'next';
// UI는 당근의 Seed Design(https://github.com/daangn/seed-design, Apache-2.0)을 쓴다.
import '@seed-design/css/base.min.css';
import '@seed-design/css/recipes/action-button.css';
import '@seed-design/css/recipes/chip.css';
import '@seed-design/css/recipes/text-input.css';
import '@seed-design/css/recipes/badge.css';
import '@seed-design/css/recipes/callout.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './cupid.css';

export const metadata: Metadata = {
  title: '큐피트 — 첫 데이트는 에이전트가 잡아옵니다',
  description: '내 AI 에이전트가 상대의 에이전트와 대화해서 잘 맞는 사람을 찾고, 첫 데이트 시간과 장소까지 잡아옵니다.',
};

export default function CupidLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cq" lang="ko" data-seed="" data-seed-color-mode="light-only">
      {children}
    </div>
  );
}
