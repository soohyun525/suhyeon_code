// 인스타그램 공개 게시물 → 취향 읽기.
// 1) 가져오기: APIFY_TOKEN 이 있으면 수집 서비스로 실제 계정을 읽고, 없으면 예시 피드를 쓴다.
// 2) 읽어내기: 글·해시태그의 낱말을 세어 관심사·가치관·데이트 스타일을 고른다 (결정적 코드).
//    결과는 전부 types.ts 의 허용 목록 안에서만 나온다. 진단·심리 표현은 만들지 않는다.

import { INTERESTS, VALUES, type DateStyle, type Tone } from './types';

export interface InstaFeed {
  handle: string;
  source: 'live' | 'demo';
  bio: string;
  captions: string[];
}

export interface TasteRead {
  handle: string;
  source: 'live' | 'demo';
  typeName: string; // 예: 주말 전시 산책러
  summary: string;
  matchLine: string; // 이런 사람과 잘 맞아요
  interests: string[];
  values: string[];
  dateStyles: DateStyle[];
  tone: Tone;
  evidence: string[]; // 무엇을 보고 골랐는지
  postCount: number;
}

export class InstaError extends Error {}

const HANDLE = /^(?!\.)(?!.*\.\.)[a-zA-Z0-9._]{1,30}(?<!\.)$/;

/** "@name", 프로필 주소, 앞뒤 공백을 모두 받아 아이디만 남긴다. */
export function parseHandle(raw: unknown): string {
  const s = String(raw ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  if (!HANDLE.test(s)) throw new InstaError('인스타그램 아이디를 확인해주세요. 영문, 숫자, 마침표, 밑줄만 쓸 수 있어요.');
  return s.toLowerCase();
}

const WORDS: Record<string, string[]> = {
  러닝: ['러닝', '런닝', '마라톤', '조깅', 'running', '러너', '10k', '5k'],
  등산: ['등산', '산행', '정상', 'hiking', '둘레길'],
  요리: ['요리', '집밥', '레시피', '홈쿡', 'cooking', '베이킹'],
  '맛집 탐방': ['맛집', '먹스타', '오마카세', '웨이팅', 'foodie', '미식'],
  영화: ['영화', '넷플', 'movie', 'cinema', '시사회'],
  전시: ['전시', '미술관', '갤러리', 'gallery', 'museum', 'exhibition'],
  독서: ['독서', '북스타', '책', 'book', '서점', '완독'],
  여행: ['여행', 'trip', 'travel', '제주', '공항', '비행기', '숙소'],
  '음악·공연': ['콘서트', '공연', '페스티벌', '플레이리스트', 'concert', '라이브', 'lp'],
  게임: ['게임', '스팀', '닌텐도', 'game', '플스'],
  반려동물: ['강아지', '고양이', '멍스타', '냥스타', '댕댕', '반려', '산책메이트'],
  커피: ['커피', '카페', '라떼', 'coffee', 'cafe', '에스프레소', '드립'],
  사진: ['필름', '사진', 'film', 'camera', '출사', '35mm'],
  요가: ['요가', '필라테스', 'yoga', 'pilates', '명상'],
};
const VALUE_WORDS: Record<string, string[]> = {
  유머: ['ㅋㅋ', '웃', '드립', '웃겨'],
  성장: ['도전', '성장', '기록', '루틴', '목표', '공부', '완주'],
  안정: ['일상', '평범', '집이 최고', '느긋', '여유'],
  가족: ['가족', '엄마', '아빠', '부모님', '조카', '동생'],
  모험: ['처음', '즉흥', '떠나', '새로운', '무작정'],
  배려: ['고마', '감사', '덕분', '선물', '챙겨'],
  솔직함: ['솔직', '진심', '있는 그대로'],
  독립성: ['혼자', '혼밥', '혼행', '나만의', '혼영'],
};
const STYLE_OF: Record<string, DateStyle> = {
  커피: 'coffee', 독서: 'coffee', '맛집 탐방': 'meal', 요리: 'meal', 러닝: 'walk', 등산: 'walk', 반려동물: 'walk',
  전시: 'culture', 사진: 'culture', 영화: 'culture', 여행: 'walk', '음악·공연': 'activity', 게임: 'activity', 요가: 'activity',
};
const TYPES: Record<string, [name: string, match: string]> = {
  러닝: ['아침 공기 수집가', '같이 걷고, 걸으면서 이야기가 길어지는 사람'],
  등산: ['정상에서 김밥 먹는 사람', '느려도 끝까지 같이 가는 사람'],
  요리: ['부엌에서 제일 행복한 사람', '맛있게 먹고 맛있다고 말해주는 사람'],
  '맛집 탐방': ['맛있는 것 앞에 진심인 사람', '메뉴판을 같이 오래 들여다보는 사람'],
  영화: ['엔딩 크레딧까지 앉아 있는 사람', '보고 나서 한참 이야기하는 사람'],
  전시: ['주말 전시 산책러', '한 작품 앞에 같이 오래 서 있는 사람'],
  독서: ['밑줄 긋는 사람', '조용히 옆에서 각자 책 읽을 수 있는 사람'],
  여행: ['다음 비행기를 이미 찾아둔 사람', '계획과 즉흥을 반반 섞는 사람'],
  '음악·공연': ['플레이리스트 큐레이터', '이어폰 한쪽을 건네받는 사람'],
  게임: ['집에서 제일 바쁜 사람', '같이 한 판 하자고 하면 좋아하는 사람'],
  반려동물: ['산책길 동행인', '동물에게 먼저 인사하는 사람'],
  커피: ['조용한 카페 단골', '말없이 마주 앉아도 편한 사람'],
  사진: ['빛 좋은 시간을 아는 사람', '멈춰 서서 기다려주는 사람'],
  요가: ['숨 고르는 사람', '서두르지 않는 사람'],
};

const count = (text: string, words: string[]) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

/** 글에서 취향을 읽는다. 같은 입력이면 항상 같은 결과. */
export function readTaste(feed: InstaFeed): TasteRead {
  const posts = feed.captions.map((c) => c.toLowerCase());
  const hits = (dict: Record<string, string[]>) =>
    Object.entries(dict)
      .map(([key, words]) => ({ key, n: posts.filter((p) => count(p, words) > 0).length + count(feed.bio.toLowerCase(), words) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);

  const interestHits = hits(WORDS);
  const valueHits = hits(VALUE_WORDS);
  if (interestHits.length === 0) throw new InstaError('게시물에서 취향을 읽어내지 못했어요. 직접 골라주세요.');

  const interests = interestHits.slice(0, 5).map((x) => x.key).filter((k) => INTERESTS.includes(k));
  const values = valueHits.slice(0, 3).map((x) => x.key).filter((k) => VALUES.includes(k));
  const dateStyles = Array.from(new Set(interests.map((i) => STYLE_OF[i]))).slice(0, 3);
  const laughs = posts.filter((p) => p.includes('ㅋㅋ')).length;
  const tone: Tone = laughs >= Math.max(2, posts.length / 3) ? 'witty' : 'polite';
  const [typeName, matchLine] = TYPES[interests[0]];

  return {
    handle: feed.handle,
    source: feed.source,
    typeName,
    matchLine,
    summary: `${interests.slice(0, 3).join(', ')} 이야기가 자주 보여요.${values.length ? ` 글에서는 ${values.join(', ')}을(를) 아끼는 마음이 읽혀요.` : ''}`,
    interests,
    values,
    dateStyles,
    tone,
    evidence: interestHits.slice(0, 4).map((x) => `${x.key} — 게시물 ${x.n}개`),
    postCount: posts.length,
  };
}

// ── 가져오기 ─────────────────────────────────────────────────────

const DEMO_FEEDS: { bio: string; captions: string[] }[] = [
  {
    bio: '달리고 마시고 기록하는 사람',
    captions: [
      '한강 러닝 10k 완주. 오늘도 기록 갱신 #러닝 #런스타그램',
      '러닝 끝나고 마시는 아이스 라떼가 제일 맛있음 ㅋㅋ #카페',
      '주말 전시 다녀옴. 한 작품 앞에서 한참 서 있었다 #전시 #미술관',
      '제주 여행 2일차, 무작정 걷다가 만난 바다 #여행',
      '새로 찾은 동네 카페. 드립 커피가 진심이다 #커피',
      '마라톤 대회 신청 완료. 목표는 완주 #도전',
      '친구가 챙겨준 생일 선물, 고마워 ㅋㅋ',
      '필름 카메라 첫 롤 현상 #필름 #사진',
    ],
  },
  {
    bio: '먹는 데 진심 · 고양이 집사',
    captions: [
      '웨이팅 한 시간 한 보람이 있는 맛집 #맛집 #먹스타그램',
      '집밥 기록. 오늘은 파스타 #요리 #홈쿡',
      '우리 고양이 낮잠 자는 중 #냥스타그램',
      '엄마랑 오마카세 다녀옴. 가족이랑 먹는 밥이 제일 좋다',
      '넷플 정주행하다가 새벽 #영화',
      '새 레시피 도전했는데 대성공 ㅋㅋ',
      '주말엔 집이 최고. 느긋한 일상',
      '콘서트 다녀왔다. 라이브는 다르네 #공연',
    ],
  },
  {
    bio: '읽고 걷고 가끔 떠납니다',
    captions: [
      '이번 달 완독 세 권째 #독서 #북스타그램',
      '서점에서 두 시간. 책 냄새가 좋다',
      '혼자 다녀온 미술관. 혼자라서 더 오래 봤다 #전시',
      '북한산 정상. 김밥은 정상에서 먹어야 한다 #등산',
      '요가 6개월 차. 숨 고르는 법을 배우는 중 #요가',
      '조용한 카페에서 밑줄 긋는 오후 #카페',
      '강아지 산책메이트 구함. 진심임',
      '즉흥으로 떠난 강릉. 새로운 길은 늘 좋다 #여행',
    ],
  },
];

const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** 공개 계정의 최근 게시물 글을 가져온다. */
export async function fetchFeed(handle: string): Promise<InstaFeed> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    const demo = DEMO_FEEDS[hash(handle) % DEMO_FEEDS.length];
    return { handle, source: 'demo', ...demo };
  }
  // 수집 서비스(Apify instagram-profile-scraper). 인스타그램 공식 API가 아니다.
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [handle] }), signal: AbortSignal.timeout(50_000) },
  );
  if (!res.ok) throw new InstaError('인스타그램을 읽어오지 못했어요. 잠시 뒤 다시 시도하거나 직접 입력해주세요.');
  const item = ((await res.json()) as any[])?.[0];
  if (!item) throw new InstaError('그 아이디의 계정을 찾지 못했어요.');
  if (item.private) throw new InstaError('비공개 계정은 읽을 수 없어요. 직접 입력으로 진행해주세요.');
  const captions = ((item.latestPosts ?? []) as any[])
    .map((p) => `${p.caption ?? ''} ${(p.hashtags ?? []).map((h: string) => `#${h}`).join(' ')}`.trim())
    .filter(Boolean)
    .slice(0, 24);
  if (captions.length === 0) throw new InstaError('읽을 수 있는 게시물이 없어요. 직접 입력으로 진행해주세요.');
  return { handle, source: 'live', bio: String(item.biography ?? ''), captions };
}
