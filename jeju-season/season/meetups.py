"""청년 쪽: 저녁·주말 밋업 일정과 '시즌 카드'.

같은 농장이 아니어도 같은 거점, 또는 다른 거점의 참가자끼리 모이도록 장소·시간을 정한다.
막차 시간표 데이터를 받지 못해(버스정보시스템 접속 불가), 주말 모임은 시즌 셔틀을 추가 운행하는 것을 기본으로 한다.
"""
from __future__ import annotations

import pandas as pd

from . import data
from .geo import haversine_km, road_km
from .tools import Assumptions, evening_spend

# 한라산 탐방로 입구 (대략 좌표, 일반 지도 기준). 성판악·관음사 코스는 탐방 예약제 — 운영 여부는 국립공원 공지 확인 필요
TRAILHEADS = {
    "성판악": (33.3848, 126.6200),
    "영실": (33.3594, 126.4952),
    "어리목": (33.3920, 126.4953),
}
RESERVATION_REQUIRED = {"성판악"}

WEEKDAY_EVENTS = [  # (요일 번호, 이름, 시작, 길이 분, 설명)
    (1, "독서회", "19:30", 90, "숙소 공용 공간. 시즌 첫 주에 함께 읽을 책 한 권을 정한다"),
    (3, "영화 감상회", "19:30", 120, "숙소 공용 공간 또는 마을회관. 제주가 배경인 영화 위주"),
]


def _emd_hubs() -> dict[str, tuple[float, float]]:
    """읍면동의 중심지 = 반경 500m 안에 다른 정류소가 가장 많은 정류소 (마을 중심가로 본다)."""
    stops = data.bus_stops()
    out = {}
    for emd, g in stops.groupby("읍면동"):
        pts = g[["lat", "lon"]].to_numpy()
        dens = [(haversine_km(la, lo, pts[:, 0], pts[:, 1]) <= 0.5).sum() for la, lo in pts]
        i = int(max(range(len(pts)), key=lambda k: dens[k]))
        out[emd] = (float(pts[i, 0]), float(pts[i, 1]))
    return out


def choose_hub(bases: list[tuple[float, float]], max_extra_km: float = 30) -> dict:
    """여러 거점에서 모이기 좋은 읍면동: 저녁 상권(음식점 카드 매출)이 크고, 거점들에서의 최대 도로거리가 짧은 곳.

    거점이 하나면 그 거점에서 가장 가까운 큰 상권을 고른다.
    """
    cents, stores = _emd_hubs(), evening_spend()
    best = None
    for emd, c in cents.items():
        if emd not in stores:
            continue
        far = max(road_km(b, c) for b in bases)
        if far > max_extra_km:
            continue
        score = stores[emd] / max(stores.values()) * 60 + (1 - far / max_extra_km) * 40
        if best is None or score > best["점수"]:
            best = {"읍면동": emd, "lat": c[0], "lon": c[1], "음식점매출_백만원": int(stores[emd]),
                    "최대거리_km": round(far, 1), "점수": round(score, 1)}
    return best or {}


def nearest_trailhead(base: tuple[float, float]) -> dict:
    name, pt = min(TRAILHEADS.items(), key=lambda kv: road_km(base, kv[1]))
    return {"탐방로": name, "lat": pt[0], "lon": pt[1], "거리_km": round(road_km(base, pt), 1),
            "예약제": name in RESERVATION_REQUIRED}


def plan_meetups(packages: list, a: Assumptions | None = None) -> pd.DataFrame:
    """성립한 패키지들의 시즌 기간에 맞춘 밋업 달력. 일요일 휴무를 가정한다."""
    a = a or Assumptions()
    live = [p for p in packages if p.status in ("성립", "조건부: 수지 조정 필요") and p.basecamps]
    if not live:
        return pd.DataFrame()
    bases = {p.cluster.id: (p.basecamps[0]["lat"], p.basecamps[0]["lon"]) for p in live}
    hub = choose_hub(list(bases.values()))
    rows = []
    for p in live:
        b = p.basecamps[0]
        base = bases[p.cluster.id]
        trail = nearest_trailhead(base)
        others = [o.cluster.id for o in live if o.cluster.id != p.cluster.id]
        for d in pd.date_range(p.cluster.start, p.cluster.end):
            wd = d.weekday()
            for num, name, start, mins, desc in WEEKDAY_EVENTS:
                if wd == num:
                    rows.append({"날짜": d.date(), "요일": "월화수목금토일"[wd], "묶음": p.cluster.id, "모임": name,
                                 "시작": start, "장소": f"{b['마을']} (거점, 걸어서)", "이동": "도보",
                                 "함께": p.cluster.id, "설명": desc})
            if wd == 5 and hub:
                km = road_km(base, (hub["lat"], hub["lon"]))
                rows.append({"날짜": d.date(), "요일": "토", "묶음": p.cluster.id, "모임": "공유주방 저녁 + 파티",
                             "시작": "18:30", "장소": f"{hub['읍면동']} 중심가 (12월 음식점 카드 매출 {hub['음식점매출_백만원']:,}백만 원)",
                             "이동": f"시즌 셔틀 추가 운행 {km:.0f}km, 22:30 복귀",
                             "함께": ", ".join([p.cluster.id, *others]),
                             "설명": "각 거점 참가자가 한곳에 모인다. 장보기·요리 조를 미리 나눈다"})
            if wd == 6:
                rows.append({"날짜": d.date(), "요일": "일", "묶음": p.cluster.id, "모임": f"한라산 {trail['탐방로']} 코스",
                             "시작": "07:00", "장소": f"{trail['탐방로']} 탐방로 입구",
                             "이동": f"시즌 셔틀 {trail['거리_km']:.0f}km",
                             "함께": ", ".join([p.cluster.id, *others]),
                             "설명": ("탐방 예약 필요(사전 확인). " if trail["예약제"] else "")
                                     + "겨울 장비(아이젠·방한) 필수, 기상 악화 시 오름·올레 걷기로 대체"})
    df = pd.DataFrame(rows).sort_values(["날짜", "묶음", "시작"]).reset_index(drop=True)
    return df


def weekend_shuttle_cost(meetups: pd.DataFrame, a: Assumptions | None = None) -> dict[str, int]:
    """주말 추가 운행 비용(가정: 1회당 중형 1일 단가의 50%)."""
    a = a or Assumptions()
    if meetups.empty:
        return {}
    n = meetups[meetups["요일"].isin(["토", "일"])].groupby("묶음").size()
    return {k: int(v * a.bus_cost_per_day_mid * 0.5) for k, v in n.items()}


MISSIONS = [
    ("디자인", "농가 직거래 상세페이지·택배 상자 스티커", "실물 결과물 → 포트폴리오"),
    ("마케팅·영상", "수확기 숏폼 3편, 스마트스토어 상품 등록", "조회수·주문 수"),
    ("개발·데이터", "주문·출하 기록 구글시트, 단골 문자 발송 자동화", "실사용 도구"),
    ("교육·복지", "마을 어르신 스마트폰 교실 1회", "운영 기록"),
    ("요리·식품", "파치 귤로 만든 청·잼 시제품", "레시피·원가표"),
]


def season_card(p, a: Assumptions | None = None, cohort: int = 1) -> dict:
    """청년에게 보이는 시즌 소개. 숫자는 패키지 계산 결과를 그대로 쓴다."""
    a = a or Assumptions()
    b, e, s, c = p.basecamps[0], p.economics, p.shuttle, p.cluster
    avg_days = max(1, round(c.person_days / max(c.peak_daily, 1)))
    return {
        "이름": f"2026 서귀포 노지감귤 시즌 · {b['마을'].replace('마을', '')} {cohort}기",
        "기간": f"{c.start} ~ {c.end} ({c.days}일)",
        "모집": f"최대 {c.peak_daily}명 (농가 {len(c.farm_ids)}곳)",
        "숙소": f"{b['마을']} 숙소 {b['숙소수']}곳 · 2인 1실",
        "출근": f"매일 {s['차량'][0]['출발']} 셔틀 출발 · 편도 약 {s['차량'][0]['편도_분']}분",
        "실수령": f"하루 약 {e['청년']['실수령_일']:,}원 · {avg_days}일 근무 시 약 {e['청년']['실수령_일'] * avg_days / 10_000:,.0f}만 원 (가정값 기준)",
        "현실점검": [
            "수확은 하루 8~9시간 서서 하는 일이다. 첫 주에 손목·허리가 가장 힘들다",
            "비 오는 날은 작업이 없고 그날 일당도 없다(관행, 계약서로 확인)",
            "숙소는 민박마다 다르다. 사진과 난방·세탁 여부를 미리 확인한다",
            "보도에 따르면 성별 일당 차이가 있었다. 계약서의 일당을 확인한다",
            "근로계약서, 산재·상해보험, 점심 제공, 쉬는 날을 농협·센터를 통해 확인한다",
        ],
    }
