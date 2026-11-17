'use client';

// 첫 화면. 스크롤 효과는 GSAP ScrollTrigger, 3D 배경은 stage.p 로 따라 움직인다.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { ActionButton } from '@seed-design/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { stage } from './stage';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const SCRIPT: [who: 'mine' | 'theirs', text: string][] = [
  ['mine', '먼저 서로의 비공개 조건을 확인할게요. 내용은 주고받지 않고요.'],
  ['theirs', '양쪽 모두 통과예요. 이제 취향 이야기를 해볼까요?'],
  ['mine', '러닝, 커피, 여행이 겹치네요. 토요일 오후 3시 어떠세요?'],
  ['theirs', '좋아요. 조용한 카페로 하죠. 각자 주인께 승인받아요.'],
];
const PROMISES = [
  ['안 되는 조건은 밖으로 나가지 않습니다', '에이전트끼리도 내용은 주고받지 않습니다. 통과했는지, 아닌지만 확인합니다.'],
  ['겹치는 시간만 드러납니다', '내 일정표 전체가 아니라, 두 사람이 모두 되는 시간 하나만 상대에게 보입니다.'],
  ['확정은 사람이 합니다', '에이전트는 제안까지만 합니다. 두 사람이 모두 승인해야 데이트가 잡힙니다.'],
];
const TAPE = '묻는 것도 에이전트 — 답하는 것도 에이전트 — 승인은 사람 — ';

export default function Landing({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia(root);
    mm.add({ motion: '(prefers-reduced-motion: no-preference)', still: '(prefers-reduced-motion: reduce)' }, (c) => {
      // 스크롤 전체 진행도 → 3D 여정 (나머지 구간은 앱 화면이 이어받는다)
      ScrollTrigger.create({
        trigger: root.current, start: 'top top', end: 'bottom bottom',
        onUpdate: (s) => { stage.p = s.progress * 0.6; stage.show = 1; },
      });
      if (!c.conditions!.motion) return;

      gsap.from('.cq-hero .line > span', { yPercent: 112, duration: 1.15, ease: 'power4.out', stagger: 0.1 });
      gsap.from('.cq-hero [data-fade]', { opacity: 0, y: 18, duration: 0.9, delay: 0.55, stagger: 0.09, ease: 'power2.out' });

      gsap.utils.toArray<HTMLElement>('.cq-step').forEach((step) => {
        gsap.from(step.querySelectorAll('[data-rise]'), {
          y: 44, opacity: 0, duration: 0.95, ease: 'power3.out', stagger: 0.09,
          scrollTrigger: { trigger: step, start: 'top 74%' },
        });
        gsap.fromTo(step.querySelector('.num'), { yPercent: 22 }, {
          yPercent: -22, ease: 'none', scrollTrigger: { trigger: step, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
      // 대화가 스크롤을 따라 한 줄씩 또렷해진다
      gsap.fromTo('.cq-demo-script li', { opacity: 0.14, x: 28 }, {
        opacity: 1, x: 0, ease: 'none', stagger: 0.5,
        scrollTrigger: { trigger: '.cq-demo-script', start: 'top 82%', end: 'bottom 58%', scrub: 0.6 },
      });
      // 도장이 내려와 찍힌다
      gsap.fromTo('.cq-demo .cq-stamp', { scale: 2.6, rotate: 24, opacity: 0 }, {
        scale: 1, rotate: -11, opacity: 1, ease: 'power2.in',
        scrollTrigger: { trigger: '.cq-demo.cq-invite', start: 'top 72%', end: 'top 38%', scrub: 0.4 },
      });
      gsap.fromTo('.cq-tape p:first-child', { xPercent: 0 }, { xPercent: -28, ease: 'none', scrollTrigger: { trigger: '.cq-tape', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo('.cq-tape p:last-child', { xPercent: -28 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.cq-tape', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.cq-promises li', {
        y: 36, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12,
        scrollTrigger: { trigger: '.cq-promises', start: 'top 72%' },
      });
      gsap.from('.cq-final h2', { yPercent: 40, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.cq-final', start: 'top 70%' } });
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={root}>
      <section className="cq-hero cq-page">
        <p className="cq-kicker" data-fade>에이전트 소개팅 <span>데모</span></p>
        <h1>
          <span className="line"><span>첫 데이트는</span></span>
          <span className="line"><span><em>에이전트</em>가</span></span>
          <span className="line"><span>잡아옵니다.</span></span>
        </h1>
        <div className="base">
          <p data-fade>나를 알려주면 내 에이전트가 상대의 에이전트와 이야기해서, 잘 맞는 사람과 만날 날짜를 들고 돌아옵니다.</p>
          <div data-fade><ActionButton variant="brandSolid" size="large" onClick={onStart}>내 에이전트 보내기</ActionButton></div>
        </div>
        <span className="scroll" data-fade aria-hidden>스크롤</span>
      </section>

      <section className="cq-step cq-page">
        <span className="num" aria-hidden>01</span>
        <div className="body">
          <h2 data-rise>나를 알려줍니다</h2>
          <p data-rise>좋아하는 것, 중요하게 여기는 것, 절대 안 되는 조건, 만날 수 있는 시간. 3분이면 충분합니다.</p>
          <ul className="cq-demo cq-demo-tags" data-rise aria-label="입력 예시">
            {['러닝', '커피', '여행', '전시'].map((t) => <li key={t} className="picked">{t}</li>)}
            {['요리', '영화', '독서'].map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </section>

      <section className="cq-step cq-page">
        <span className="num" aria-hidden>02</span>
        <div className="body">
          <h2 data-rise>에이전트끼리 이야기합니다</h2>
          <p data-rise>조건을 확인하고, 취향을 맞춰보고, 시간을 조율합니다. 어색한 첫 연락은 에이전트의 몫입니다.</p>
          <ol className="cq-script cq-demo cq-demo-script">
            {SCRIPT.map(([who, text], i) => (
              <li key={i} className={who}>
                <b>{who === 'mine' ? '내 에이전트' : '상대 에이전트'}</b>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cq-step cq-page">
        <span className="num" aria-hidden>03</span>
        <div className="body">
          <h2 data-rise>날짜를 들고 돌아옵니다</h2>
          <p data-rise>마음에 들면 승인만 누르세요. 다른 시간을 고르거나, 이번엔 넘겨도 됩니다.</p>
          <div className="cq-invite cq-demo" data-rise>
            <header><span>첫 데이트 제안</span></header>
            <p className="when">토요일 오후 3시</p>
            <p className="where">조용한 카페에서 커피 한 잔</p>
            <footer><span>둘 다 러닝 · 커피 · 여행을 좋아해요</span></footer>
            <span className="cq-stamp" aria-hidden>확정</span>
          </div>
        </div>
      </section>

      <div className="cq-tape" aria-hidden>
        <p>{TAPE.repeat(4)}</p>
        <p>{TAPE.repeat(4)}</p>
      </div>

      <section className="cq-promises cq-page">
        <h2>세 가지 약속</h2>
        <ol>
          {PROMISES.map(([title, body], i) => (
            <li key={title}>
              <span className="n">{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cq-final">
        <div className="cq-page">
          <h2>이제, 보내볼까요?</h2>
          <ActionButton variant="neutralSolid" size="large" onClick={onStart}>내 에이전트 보내기</ActionButton>
          <p>데모 버전입니다. 상대는 가상 인물이고, 실제 예약은 하지 않습니다.</p>
        </div>
      </section>
    </div>
  );
}
