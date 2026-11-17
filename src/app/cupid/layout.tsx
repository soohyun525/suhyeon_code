import type { Metadata } from 'next';
import './cupid.css';

export const metadata: Metadata = {
  title: '큐피트 💘 내 에이전트가 잡아주는 첫 데이트',
  description: '내 AI 에이전트가 상대의 에이전트와 대화해서 잘 맞는 사람을 찾고, 첫 데이트 시간과 장소까지 잡아옵니다.',
};

export default function CupidLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cq" lang="ko">
      <div className="cq-bg" aria-hidden>
        <i /><i /><i />
      </div>
      {children}
    </div>
  );
}
