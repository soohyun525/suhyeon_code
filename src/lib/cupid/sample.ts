import type { Profile } from './types';

// "예시로 채우기" 버튼과 자체 점검 스크립트가 같이 쓰는 예시 프로필.
export const SAMPLE_PROFILE: Profile = {
  name: '하늘',
  birth: { year: 1995, month: 5, day: 25 },
  gender: 'female',
  seeking: ['male'],
  ageRange: [27, 36],
  city: '서울',
  interests: ['커피', '여행', '러닝', '전시'],
  values: ['성장', '유머', '배려'],
  smoker: false,
  drink: 'social',
  likesPets: true,
  dealbreakers: ['smoker', 'other_city'],
  dateStyles: ['coffee', 'walk'],
  slots: ['sat-afternoon', 'wed-evening', 'sun-lunch'],
  tone: 'witty',
  bond: { intent: 'serious', contact: 'daily', conflict: 'talk', closeness: [1, 1, 0, 0], loveGive: 'acts', loveGet: 'time', gives: ['support', 'depth'], needs: ['steady', 'depth'] },
};
