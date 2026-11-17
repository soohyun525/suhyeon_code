// 큐피트 로고: 두 점(나와 상대)을 잇는 호 + 워드마크.
// 3D 배경의 "두 점과 점선"과 같은 그림이다.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 36 24" fill="none" aria-hidden>
      <path d="M6 17 C 12 3, 24 3, 30 17" stroke="var(--cq-rose-400)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="6" cy="17" r="4.2" fill="var(--cq-rose-800)" />
      <circle cx="30" cy="17" r="4.2" fill="var(--cq-rose-500)" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="cq-logo">
      <LogoMark />
      <span>큐피트</span>
    </span>
  );
}
