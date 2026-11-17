// 사람(주인) 단계. 브라우저에서 실행되므로 후보의 비공개 정보(personas)를
// 끌어오는 engine.ts 를 import 하지 않는다.
import { transition } from './machine';
import type { Courtship } from './types';

/** 사람(주인) 단계의 이벤트 적용. 화면은 이 함수만 통해 상태를 바꾼다. */
export type OwnerEvent = 'MY_APPROVE' | 'MY_PASS' | 'RESCHEDULE' | 'PARTNER_APPROVE' | 'PARTNER_PASS';
export function applyOwnerEvent(c: Courtship, event: OwnerEvent): Courtship {
  if (event === 'RESCHEDULE') {
    const [next, ...rest] = c.proposal?.alternatives ?? [];
    if (!next) {
      return { ...c, state: transition(c.state, 'NO_OVERLAP'), proposal: null, closedReason: '다른 겹치는 시간이 없어요' };
    }
    return { ...c, state: transition(c.state, 'RESCHEDULE'), proposal: { ...c.proposal!, slot: next, alternatives: rest } };
  }
  const state = transition(c.state, event);
  const closedReason = event === 'MY_PASS' ? '내가 거절함' : event === 'PARTNER_PASS' ? '상대가 거절함' : c.closedReason;
  return { ...c, state, closedReason };
}
