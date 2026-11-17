'use client';

// 큐피트 디자인 시스템 초안 — 살아 있는 문서. 여기 보이는 것은 전부 실제 토큰과 컴포넌트다.

import { useState } from 'react';
import { ActionButton, Badge, Callout, Chip, TextField } from '@seed-design/react';
import Logo, { LogoMark } from '../Logo';

const ROSE: [step: number, hex: string, onDark: boolean][] = [
  [100, '#fff0f4', false], [200, '#ffdde6', false], [300, '#ffbccd', false], [400, '#ff8fab', false], [500, '#f55a84', false],
  [600, '#dc2660', true], [700, '#b81a4e', true], [800, '#8f143e', true], [900, '#5f0e2a', true],
];
const TYPE: [token: string, use: string, sample: string][] = [
  ['hero', '첫 화면 한 문장', '첫 데이트는'],
  ['display', '구역 제목', '날짜를 들고 돌아옵니다'],
  ['title', '화면 제목', '데이트 1건을 잡아왔습니다'],
  ['date', '초대장의 날짜', '11월 21일 (토) 오후 3시'],
  ['heading', '소제목', '확정은 사람이 합니다'],
];
const VOICE: [yes: string, no: string][] = [
  ['데이트 1건을 잡아왔습니다', '매칭 성공! 🎉 운명의 상대를 찾았어요!'],
  ['케미는 좋지만 겹치는 시간이 없어요', '매칭 실패'],
  ['확정은 두 분이 승인해야 됩니다', 'AI가 알아서 다 해드려요'],
  ['상대에게 내용은 전달되지 않아요', '개인정보는 안전하게 암호화됩니다'],
];

export default function SystemPage() {
  const [picked, setPicked] = useState(['러닝', '커피']);
  const [tone, setTone] = useState('witty');
  const [name, setName] = useState('하늘');
  return (
    <>
      <header className="cq-head cq-page">
        <a className="cq-mark" href="/cupid" aria-label="큐피트 처음으로"><Logo /></a>
        <ol className="cq-crumbs"><li aria-current="step">디자인 시스템 v0.1</li></ol>
      </header>
      <main className="cq-page cq-sys">
        <header>
          <p className="cq-kicker">큐피트 디자인 시스템 <span>초안</span></p>
          <h1>편지처럼 조용하게,<br />약속처럼 분명하게.</h1>
          <p>당근 Seed Design 위에 큐피트의 색 하나와 말투, 그리고 몇 가지 고유한 모양을 얹었습니다. 이 화면의 모든 요소는 실제 서비스가 쓰는 토큰과 컴포넌트입니다.</p>
        </header>

        <section>
          <h2><small>01</small>브랜드</h2>
          <div className="cols">
            <div className="cq-brandmark">
              <div><Logo /></div>
              <div className="rose"><LogoMark size={56} /></div>
            </div>
            <p className="note">두 점은 나와 상대, 호는 그 사이를 오가는 에이전트입니다. 같은 그림이 3D 배경에서 움직이고, 초대장의 도장으로 찍힙니다. 하트와 화살은 쓰지 않습니다.</p>
          </div>
        </section>

        <section>
          <h2><small>02</small>색</h2>
          <div className="cols">
            <div>
              <h3>로즈 레터 — 브랜드색은 이것 하나</h3>
              <div className="cq-swatches">
                {ROSE.map(([step, hex, dark]) => (
                  <div key={step} style={{ background: hex, color: dark ? '#fff' : '#5f0e2a' }}>{step}<code>{hex}</code></div>
                ))}
              </div>
            </div>
            <p className="note">600이 기준색입니다. 흰 글자를 올려도, 흰 바탕 위 글자로 써도 명도 대비 4.7:1로 읽기 기준(4.5:1)을 넘습니다. 누를 수 있는 가장 중요한 것 하나, 내 에이전트의 말, 확정된 상태에만 씁니다. 나머지는 Seed의 회색 단계입니다.</p>
            <div className="cq-swatches">
              {['00', '100', '200', '300', '400', '500', '600', '800', '1000'].map((g, i) => (
                <div key={g} style={{ background: `var(--seed-color-palette-gray-${g})`, color: i > 5 ? '#fff' : '#1a1c20' }}>gray {g}</div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2><small>03</small>글자</h2>
          <div className="cols">
            <div className="cq-specs">
              {TYPE.map(([token, use, sample]) => (
                <div key={token}>
                  <span>{token} · {use}</span>
                  <p style={{ fontSize: `min(var(--cq-type-${token}), 48px)` }}>{sample}</p>
                </div>
              ))}
              <div><span>quote · 에이전트 대사</span><p className="plain" style={{ fontSize: 'var(--cq-type-quote)' }}>러닝, 커피, 여행이 겹치네요. 토요일 오후 3시 어떠세요?</p></div>
              <div><span>body · 본문 16</span><p className="plain">나를 알려주면 내 에이전트가 상대의 에이전트와 이야기합니다.</p></div>
              <div><span>label 13 · caption 12</span><p className="plain" style={{ fontSize: 'var(--cq-type-label)' }}>04 — 결과 · 33세 · 프로덕트 매니저 · 서울</p></div>
            </div>
            <p className="note">글꼴은 Pretendard 하나. 제목은 800, 본문은 400~500. 큰 글자일수록 자간을 좁힙니다(-0.03 ~ -0.055em). 한글은 단어 중간에서 줄을 바꾸지 않습니다.</p>
          </div>
        </section>

        <section>
          <h2><small>04</small>컴포넌트</h2>
          <div className="cols two">
            <div>
              <h3>버튼 — 한 화면에 로즈는 하나</h3>
              <div className="cq-demo-row">
                <ActionButton variant="brandSolid" size="large">이 데이트 승인하기</ActionButton>
                <ActionButton variant="neutralWeak" size="large">다른 시간으로</ActionButton>
                <ActionButton variant="ghost" size="large">이번엔 넘기기</ActionButton>
              </div>
            </div>
            <div>
              <h3>상태 배지</h3>
              <div className="cq-demo-row">
                <Badge.Root tone="brand" variant="solid" size="large"><Badge.Label>데이트 확정</Badge.Label></Badge.Root>
                <Badge.Root tone="brand" variant="weak" size="large"><Badge.Label>내 승인 대기</Badge.Label></Badge.Root>
                <Badge.Root tone="neutral" variant="weak" size="large"><Badge.Label>시간 불일치</Badge.Label></Badge.Root>
              </div>
            </div>
            <div>
              <h3>여러 개 고르기</h3>
              <div className="cq-chips">
                {['러닝', '커피', '여행', '전시', '요리'].map((x) => (
                  <Chip.Toggle key={x} variant="outlineStrong" size="medium" checked={picked.includes(x)} onCheckedChange={() => setPicked((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]))}>
                    <Chip.Label>{x}</Chip.Label>
                  </Chip.Toggle>
                ))}
              </div>
            </div>
            <div>
              <h3>하나만 고르기</h3>
              <Chip.RadioRoot className="cq-chips" aria-label="에이전트 말투" value={tone} onValueChange={setTone}>
                {[['polite', '정중하게'], ['witty', '재치 있게'], ['direct', '단도직입']].map(([id, label]) => (
                  <Chip.RadioItem key={id} variant="outlineStrong" size="medium" value={id}><Chip.Label>{label}</Chip.Label></Chip.RadioItem>
                ))}
              </Chip.RadioRoot>
            </div>
            <div>
              <h3>입력칸</h3>
              <TextField.Root variant="underline" size="large" value={name} onValueChange={setName}>
                <TextField.Input aria-label="이름" placeholder="닉네임도 좋아요" />
              </TextField.Root>
            </div>
            <div>
              <h3>알림</h3>
              <Callout.Root tone="critical"><Callout.Content><Callout.Description>가능한 시간을 1개 이상 골라주세요.</Callout.Description></Callout.Content></Callout.Root>
            </div>
          </div>
        </section>

        <section>
          <h2><small>05</small>큐피트만의 모양</h2>
          <div className="cols">
            <div>
              <h3>초대장 — 에이전트가 들고 오는 결과물</h3>
              <div className="cq-invite" style={{ marginTop: 34 }}>
                <header><span>첫 데이트 확정 · 도윤 × 하늘</span></header>
                <p className="when">11월 21일 (토) 오후 3시</p>
                <p className="where">조용한 카페에서 커피 한 잔 · 서울</p>
                <ul><li>둘 다 러닝 · 커피 · 여행을 좋아해요</li><li className="tip">&quot;러닝&quot; 이야기로 시작해보세요.</li></ul>
                <span className="cq-stamp" aria-hidden>확정</span>
              </div>
            </div>
            <div>
              <h3>대본 — 에이전트끼리의 대화는 말풍선이 아니라 기록</h3>
              <ol className="cq-script">
                <li className="mine"><b>하늘의 에이전트</b><span>먼저 서로의 비공개 조건을 확인할게요.</span></li>
                <li className="theirs"><b>도윤의 에이전트</b><span>양쪽 모두 통과예요. 이제 취향 이야기를 해볼까요?</span></li>
              </ol>
            </div>
            <div>
              <h3>시간표 — 누른 순서가 선호 순서</h3>
              <div className="cq-grid">
                <span />{['월', '화', '수', '목', '금', '토', '일'].map((d) => <span key={d}>{d}</span>)}
                <span className="rowh">오후</span>
                {[0, 0, 2, 0, 0, 1, 0].map((n, i) => <button key={i} type="button" className="cq-slot" aria-pressed={n > 0}>{n || ''}</button>)}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2><small>06</small>말투</h2>
          <div className="cols">
            <div className="cq-voice">
              <div><span>이렇게 씁니다</span><span>이렇게 쓰지 않습니다</span></div>
              {VOICE.map(([yes, no]) => <div key={yes}><span>{yes}</span><span>{no}</span></div>)}
            </div>
            <p className="note">결과를 먼저, 이유는 한 문장으로. 과장·이모지·느낌표를 쓰지 않습니다. 안 된 일도 숨기지 않고, 다음에 할 수 있는 일을 붙입니다.</p>
          </div>
        </section>

        <section>
          <h2><small>07</small>움직임</h2>
          <div className="cols">
            <div className="cq-specs">
              <div><span>등장</span><p className="plain">아래에서 26px 올라오며 나타남 · 0.75초 · 항목 간 0.05초 차이</p></div>
              <div><span>누름·전환</span><p className="plain">0.15 ~ 0.25초 · 색과 위치만</p></div>
              <div><span>스크롤</span><p className="plain">첫 화면에서만. 스크롤이 3D 카메라와 두 점의 거리를 움직임</p></div>
              <div><span>확정</span><p className="plain">도장이 내려와 찍히고, 두 점이 만나며 고리가 한 번 퍼짐</p></div>
            </div>
            <p className="note">움직임은 "에이전트가 일하고 있다"와 "약속이 잡혔다" 두 순간을 위해 아껴 씁니다. 기기에서 움직임 줄이기를 켜면 모두 멈춥니다.</p>
          </div>
        </section>
      </main>
    </>
  );
}
