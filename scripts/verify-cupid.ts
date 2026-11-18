// 큐피트 상태 머신 + 협상 엔진 자체 점검.  npm run test:cupid
import assert from 'node:assert/strict';
import { COURT_FLOW, COURT_STATES, transition, isTerminal, type CourtState, type CourtEvent } from '../src/lib/cupid/machine';
import { applyOwnerEvent } from '../src/lib/cupid/owner';
import { runAll, slotToDate, discover, FIT_THRESHOLD } from '../src/lib/cupid/engine';
import { parseProfile } from '../src/lib/cupid/validate';
import { SAMPLE_PROFILE } from '../src/lib/cupid/sample';
import { InstaError, parseHandle, readTaste } from '../src/lib/cupid/insta';
import { INTERESTS, VALUES } from '../src/lib/cupid/types';

// 1) 모든 전이의 도착지는 정의된 상태다
for (const s of COURT_STATES) for (const to of Object.values(COURT_FLOW[s])) assert.ok(COURT_STATES.includes(to!));

// 2) 표에 없는 전이는 막힌다
assert.throws(() => transition('discovered', 'AGREE'));
assert.throws(() => transition('confirmed', 'MY_PASS'));
assert.throws(() => transition('scheduling', 'PARTNER_APPROVE'));

// 3) 불변식: confirmed 로 가는 모든 경로는 MY_APPROVE 와 PARTNER_APPROVE 를 거친다
const walk = (s: CourtState, seen: CourtEvent[], visited: Set<string>) => {
  if (s === 'confirmed') {
    assert.ok(seen.includes('MY_APPROVE') && seen.includes('PARTNER_APPROVE'), `사람 승인 없이 확정됨: ${seen}`);
    return;
  }
  for (const [e, to] of Object.entries(COURT_FLOW[s]) as [CourtEvent, CourtState][]) {
    const key = `${s}|${e}`;
    if (visited.has(key)) continue;
    walk(to, [...seen, e], new Set(visited).add(key));
  }
};
walk('discovered', [], new Set());

// 4) 모든 상태에서 종료 상태에 도달할 수 있다 (막다른 길 없음)
for (const s of COURT_STATES) {
  const reach = new Set<CourtState>([s]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of Array.from(reach)) for (const to of Object.values(COURT_FLOW[r])) if (!reach.has(to!)) { reach.add(to!); changed = true; }
  }
  assert.ok(Array.from(reach).some(isTerminal), `${s} 에서 끝날 수 없음`);
}

// 5) 날짜 계산: 2026-11-17(화) 기준 토요일 오후 = 11/21 15:00 KST, 최소 이틀 뒤
const now = new Date('2026-11-17T03:00:00Z');
assert.equal(slotToDate('sat-afternoon', now).iso, '2026-11-21T15:00:00+09:00');
assert.equal(slotToDate('wed-evening', now).iso, '2026-11-25T19:00:00+09:00'); // 내일(수)은 너무 촉박 → 다음 주
assert.equal(slotToDate('thu-lunch', now).label, '11월 19일 (목) 점심 12시');

// 6) 예시 프로필로 전체 실행
const me = parseProfile(SAMPLE_PROFILE);
const all = runAll(me, now);
const by = Object.fromEntries(all.map((c) => [c.id, c]));
assert.deepEqual(all.map((c) => c.id).sort(), discover(me, now).map((p) => p.id).sort());
assert.equal(by.doyun.state, 'awaiting_owner');
assert.ok(by.doyun.proposal && by.doyun.score! >= FIT_THRESHOLD);
assert.equal(by.minjae.state, 'no_fit'); // 흡연 + 다른 도시 → 내 비공개 조건
assert.ok(by.minjae.closedReason!.includes('흡연자'));
assert.equal(by.siwoo.state, 'no_slot');
for (const c of all) {
  assert.equal(c.messages.at(-1)!.state, c.state); // 대화 기록과 최종 상태가 일치
  assert.equal(c.state === 'awaiting_owner', c.proposal !== null); // 제안은 그 상태에서만 존재
  // 상대의 비공개 조건 내용은 어떤 메시지에도 새어 나가지 않는다
  if (c.closedReason?.startsWith('상대')) assert.ok(!/흡연|술|반려동물|장거리/.test(c.closedReason));
}

// 7) 사람 단계: 승인 → 상대 승인 → 확정 / 시간 바꾸기 / 거절
let d = by.doyun;
const first = d.proposal!.slot.id;
d = applyOwnerEvent(d, 'RESCHEDULE');
assert.equal(d.state, 'awaiting_owner');
assert.notEqual(d.proposal!.slot.id, first);
while (d.state === 'awaiting_owner' && d.proposal!.alternatives.length) d = applyOwnerEvent(d, 'RESCHEDULE');
assert.equal(applyOwnerEvent(d, 'RESCHEDULE').state, 'no_slot'); // 대안이 떨어지면 종료
d = applyOwnerEvent(d, 'MY_APPROVE');
assert.equal(d.state, 'awaiting_partner');
assert.throws(() => applyOwnerEvent(d, 'MY_APPROVE')); // 중복 승인 불가
assert.equal(applyOwnerEvent(d, 'PARTNER_APPROVE').state, 'confirmed');
assert.equal(applyOwnerEvent(by.doyun, 'MY_PASS').state, 'declined');

// 8) 검증: 잘못된 입력은 거부
assert.throws(() => parseProfile({ ...SAMPLE_PROFILE, name: ' ' }));
assert.throws(() => parseProfile({ ...SAMPLE_PROFILE, slots: ['never-ever'] }));
assert.throws(() => parseProfile({ ...SAMPLE_PROFILE, birth: { year: 1995, month: 2, day: 30 } }));

// 9) 인스타 읽기: 아이디 정리, 허용 목록 안의 결과, 같은 입력엔 같은 결과
assert.equal(parseHandle(' @Haneul.Run '), 'haneul.run');
assert.equal(parseHandle('https://www.instagram.com/haneul_run/?hl=ko'), 'haneul_run');
for (const bad of ['', 'a b', '.abc', 'abc.', 'a..b', 'x'.repeat(31), '한글']) assert.throws(() => parseHandle(bad), InstaError);
const taste = readTaste({ handle: 't', source: 'demo', bio: '', captions: ['한강 러닝 10k 완주 #도전', '러닝 후 라떼 ㅋㅋ #카페', '전시 다녀옴 #미술관', '러닝 기록 ㅋㅋ'] });
assert.equal(taste.interests[0], '러닝');
assert.ok(taste.interests.every((i) => INTERESTS.includes(i)) && taste.values.every((v) => VALUES.includes(v)));
assert.ok(taste.dateStyles.includes('walk') && taste.tone === 'witty');
assert.throws(() => readTaste({ handle: 't', source: 'demo', bio: '', captions: ['오늘 하루'] }), InstaError);
assert.ok(!/무의식|상처|우울|진단|애착/.test(JSON.stringify(taste))); // 진단형 표현 금지

console.log(`✓ cupid: 상태 머신·엔진 점검 통과 (후보 ${all.length}명: ${all.map((c) => `${c.card.name}=${c.state}`).join(', ')})`);
