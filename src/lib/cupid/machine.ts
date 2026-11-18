// 명시적 상태 머신 — 한 쌍(내 에이전트 ↔ 상대 에이전트)의 "소개팅 성사 과정".
// 모든 전이는 이 표에만 있다. 표에 없는 전이는 예외를 던진다.
//
// 핵심 불변식: `confirmed`는 MY_APPROVE → PARTNER_APPROVE 를 모두 거쳐야만
// 도달한다. 에이전트는 날짜를 "제안"까지만 할 수 있고, 확정은 사람 둘이 한다.

export const COURT_STATES = [
  'discovered', // 상대 에이전트 카드를 발견
  'screening', // 비공개 조건(딜브레이커) 예/아니오 확인
  'exploring', // 관심사·가치관 교환, 케미 점수 계산
  'scheduling', // 시간·장소 제안/역제안
  'awaiting_owner', // 제안 완성 — 내 승인 대기
  'awaiting_partner', // 나는 승인 — 상대 승인 대기
  'confirmed', // 종료: 첫 데이트 확정
  'declined', // 종료: 사람이 거절
  'no_fit', // 종료: 조건 불일치 또는 점수 미달
  'no_slot', // 종료: 겹치는 시간이 없음
] as const;
export type CourtState = (typeof COURT_STATES)[number];

export type CourtEvent =
  | 'HELLO'
  | 'SCREEN_PASS'
  | 'SCREEN_FAIL'
  | 'FIT_OK'
  | 'FIT_LOW'
  | 'PROPOSE'
  | 'COUNTER'
  | 'AGREE'
  | 'NO_OVERLAP'
  | 'MY_APPROVE'
  | 'MY_PASS'
  | 'RESCHEDULE'
  | 'PARTNER_APPROVE'
  | 'PARTNER_PASS';

export const COURT_FLOW: Record<CourtState, Partial<Record<CourtEvent, CourtState>>> = {
  discovered: { HELLO: 'screening' },
  screening: { SCREEN_PASS: 'exploring', SCREEN_FAIL: 'no_fit' },
  exploring: { FIT_OK: 'scheduling', FIT_LOW: 'no_fit' },
  scheduling: {
    PROPOSE: 'scheduling',
    COUNTER: 'scheduling',
    AGREE: 'awaiting_owner',
    NO_OVERLAP: 'no_slot',
  },
  awaiting_owner: {
    MY_APPROVE: 'awaiting_partner',
    MY_PASS: 'declined',
    RESCHEDULE: 'awaiting_owner',
    NO_OVERLAP: 'no_slot',
  },
  awaiting_partner: { PARTNER_APPROVE: 'confirmed', PARTNER_PASS: 'declined' },
  confirmed: {},
  declined: {},
  no_fit: {},
  no_slot: {},
};

export function canFire(state: CourtState, event: CourtEvent): boolean {
  return event in COURT_FLOW[state];
}

export function transition(state: CourtState, event: CourtEvent): CourtState {
  const next = COURT_FLOW[state][event];
  if (!next) throw new Error(`Illegal transition: ${state} --${event}-->`);
  return next;
}

export const isTerminal = (s: CourtState) => Object.keys(COURT_FLOW[s]).length === 0;

// 화면에 보여줄 진행 단계 (종료 상태 제외).
export const COURT_STEPS: { state: CourtState; label: string }[] = [
  { state: 'discovered', label: '발견' },
  { state: 'screening', label: '조건 확인' },
  { state: 'exploring', label: '케미 탐색' },
  { state: 'scheduling', label: '일정 조율' },
  { state: 'awaiting_owner', label: '내 승인' },
  { state: 'awaiting_partner', label: '상대 승인' },
  { state: 'confirmed', label: '확정' },
];

export const COURT_LABEL: Record<CourtState, string> = {
  discovered: '발견',
  screening: '조건 확인 중',
  exploring: '케미 탐색 중',
  scheduling: '일정 조율 중',
  awaiting_owner: '내 승인 대기',
  awaiting_partner: '상대 승인 대기',
  confirmed: '데이트 확정',
  declined: '거절됨',
  no_fit: '맞지 않음',
  no_slot: '시간 불일치',
};

// ── 앱 화면 흐름 (두 번째 상태 머신) ───────────────────────────────
// 로딩/에러를 boolean 플래그로 흩어놓지 않고 화면 상태 하나로 관리한다.

export type Screen = 'landing' | 'connect' | 'reading' | 'persona' | 'onboarding' | 'briefing' | 'dispatching' | 'watching' | 'results' | 'proposal';
export type ScreenEvent =
  | 'START'
  | 'HOME'
  | 'HANDLE_SENT'
  | 'SKIP'
  | 'READ_OK'
  | 'READ_FAILED'
  | 'CONTINUE'
  | 'RETRY'
  | 'PROFILE_SAVED'
  | 'EDIT'
  | 'DISPATCH'
  | 'LOADED'
  | 'FAILED'
  | 'WATCHED'
  | 'OPEN'
  | 'BACK';

export const SCREEN_FLOW: Record<Screen, Partial<Record<ScreenEvent, Screen>>> = {
  landing: { START: 'connect' },
  connect: { HANDLE_SENT: 'reading', SKIP: 'onboarding', HOME: 'landing' },
  reading: { READ_OK: 'persona', READ_FAILED: 'connect' },
  persona: { CONTINUE: 'onboarding', RETRY: 'connect' },
  onboarding: { PROFILE_SAVED: 'briefing', HOME: 'landing' },
  briefing: { EDIT: 'onboarding', DISPATCH: 'dispatching' },
  dispatching: { LOADED: 'watching', FAILED: 'briefing' },
  watching: { WATCHED: 'results' },
  results: { OPEN: 'proposal', EDIT: 'onboarding', DISPATCH: 'dispatching' },
  proposal: { BACK: 'results' },
};
