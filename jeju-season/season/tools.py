"""Agent 도구: 농가 일정 묶기 → 거점 숙소 → 셔틀 노선 → 수지 계산 → 제안서.

모든 수치 계산은 여기서 코드로 한다. LLM은 이 함수들을 골라 부르고 결과를 설명·작성만 한다.
가정값(일당, 숙박 단가, 버스 단가 등)은 Assumptions 에 모아 두고 화면에서 바꿀 수 있게 한다.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from . import data
from .geo import haversine_km, order_stops, road_km, split_by_angle


# ─────────────────────────────── 가정값 ───────────────────────────────
@dataclass
class Assumptions:
    """출처가 없는 값은 전부 가정이다. 화면에서 바꿀 수 있다."""
    wage_per_day: int = 100_000            # 일당. 2026-11 보도 "일당 10만원에도 사람이 없다" (하한으로 사용)
    lodging_per_person_night: int = 25_000  # 비수기 민박 장기 투숙 1인 1박 (가정, 2인 1실 5만원)
    persons_per_room: int = 2
    farm_lodging_share: float = 0.5        # 숙박비 중 농가 분담 비율 (가정)
    bus_cost_per_day_mid: int = 350_000    # 중형 전세버스 1일 (기사 포함, 출퇴근 왕복, 가정)
    bus_cost_per_day_large: int = 450_000  # 대형 1일 (가정)
    seats_mid: int = 25
    seats_large: int = 40
    worker_meal_per_day: int = 10_000      # 저녁 식비 본인 부담 (점심은 농가 제공 관행 가정)
    min_worker_net_per_day: int = 60_000   # 이보다 적게 남으면 청년에게 공개하지 않는다
    kg_per_person_day: int = 400           # 수확 1인 1일 처리량 (가정)
    work_start: str = "08:00"


# ──────────────────────────── 1. 일정 묶기 ────────────────────────────
@dataclass
class Cluster:
    id: str
    farm_ids: list[str]
    centroid: tuple[float, float]
    start: str
    end: str
    days: int
    peak_daily: int
    mean_daily: float
    person_days: int
    radius_km: float
    viable: bool
    reasons: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


def _overlap_days(a0, a1, b0, b1) -> int:
    return max(0, (min(a1, b1) - max(a0, b0)).days + 1)


def cluster_requests(requests: pd.DataFrame, link_km: float = 3.5, min_overlap_days: int = 3,
                     min_mean_daily: int = 12, min_days: int = 10) -> list[Cluster]:
    """가까운(직선 link_km 이내) 농가 중 일정이 min_overlap_days 이상 겹치는 것끼리 이어 묶는다.

    성립 조건: 시즌 기간 평균 하루 인원 min_mean_daily 명 이상, 기간 min_days 일 이상.
    (민박 몇 곳과 셔틀 1대가 움직일 최소 규모로 둔 가정값)
    """
    req = requests.reset_index(drop=True)
    n = len(req)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(n):
        for j in range(i + 1, n):
            d = float(haversine_km(req.lat[i], req.lon[i], req.lat[j], req.lon[j]))
            if d <= link_km and _overlap_days(req.시작일[i], req.종료일[i], req.시작일[j], req.종료일[j]) >= min_overlap_days:
                parent[find(i)] = find(j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    clusters = []
    for k, idx in enumerate(sorted(groups.values(), key=lambda g: -req.loc[g, "필요인원"].sum())):
        sub = req.loc[idx]
        days = pd.date_range(sub.시작일.min(), sub.종료일.max())
        daily = np.array([sub[(sub.시작일 <= d) & (sub.종료일 >= d)]["필요인원"].sum() for d in days])
        active = days[daily > 0]
        clat, clon = float(sub.lat.mean()), float(sub.lon.mean())
        radius = float(haversine_km(clat, clon, sub.lat.values, sub.lon.values).max())
        mean_daily = float(daily[daily > 0].mean())
        reasons, suggestions = [], []
        if mean_daily < min_mean_daily:
            reasons.append(f"평균 하루 {mean_daily:.1f}명으로 기준 {min_mean_daily}명에 못 미침")
            suggestions.append(f"하루 평균 {int(np.ceil(min_mean_daily - mean_daily))}명이 더 필요합니다. 반경 {link_km}km 안의 농가가 더 참여하거나, 가까운 다른 묶음과 날짜를 맞추면 성립합니다.")
        if len(active) < min_days:
            reasons.append(f"기간 {len(active)}일로 기준 {min_days}일보다 짧음")
            suggestions.append(f"기간을 {min_days - len(active)}일 이상 늘리면 숙소·셔틀 제안이 가능해집니다.")
        clusters.append(Cluster(
            id=f"S{k + 1}", farm_ids=sub["농가ID"].tolist(), centroid=(clat, clon),
            start=str(active.min().date()), end=str(active.max().date()), days=len(active),
            peak_daily=int(daily.max()), mean_daily=round(mean_daily, 1), person_days=int(daily.sum()),
            radius_km=round(radius, 1), viable=not reasons, reasons=reasons, suggestions=suggestions,
        ))
    _suggest_merges(clusters, req)
    return clusters


def _suggest_merges(clusters: list[Cluster], req: pd.DataFrame) -> None:
    """성립하지 않는 묶음에 가장 가까운 다른 묶음과의 거리와 날짜 차이를 알려 준다."""
    for c in clusters:
        if c.viable:
            continue
        others = [o for o in clusters if o.id != c.id]
        if not others:
            continue
        o = min(others, key=lambda o: road_km(c.centroid, o.centroid))
        dist = road_km(c.centroid, o.centroid)
        if dist > 15:
            c.suggestions.append(f"15km 안에 합칠 만한 다른 묶음이 없습니다 (가장 가까운 {o.id}까지 약 {dist:.0f}km). "
                                 "같은 마을 농가의 추가 참여가 필요합니다.")
            continue
        gap = (pd.Timestamp(o.start) - pd.Timestamp(c.end)).days
        shift = "" if gap <= 0 else f", 날짜를 {gap}일 옮기면 겹칩니다"
        c.suggestions.append(f"가장 가까운 묶음 {o.id}까지 도로 약 {dist:.1f}km{shift}. 같은 거점·셔틀을 함께 쓰는 방안을 검토하세요.")


# ─────────────────────────── 2. 거점 숙소 찾기 ───────────────────────────
def find_basecamps(cluster: Cluster, radius_km: float = 7.0, top: int = 3,
                   a: Assumptions | None = None) -> list[dict]:
    """묶음 중심에서 radius_km 안의 소규모 숙소를 마을 단위로 모아 점수를 매긴다.

    점수 = 수용 가능 인원(최대 인원 대비) · 거리 · 정류소 접근성 · 그 동네 저녁 상권(음식점 카드 매출).
    객실 수가 비어 있는 민박은 2실로 본다(가정).
    """
    a = a or Assumptions()
    lod = data.lodging()
    lod = lod[lod["소규모"]].copy()
    lod["dist_km"] = haversine_km(cluster.centroid[0], cluster.centroid[1], lod.lat.values, lod.lon.values)
    lod = lod[lod.dist_km <= radius_km]
    if lod.empty:
        return []
    lod["객실_추정"] = np.where(lod["객실수"] > 0, lod["객실수"], 2)
    lod["마을키"] = lod["마을"].fillna("")
    lod.loc[lod["마을키"] == "", "마을키"] = (lod["읍면동"] + " " + (lod.lat.round(2)).astype(str))

    stops = data.bus_stops()
    evening = evening_spend()
    need_people = cluster.peak_daily
    rows = []
    for key, g in lod.groupby("마을키"):
        center = (float(g.lat.mean()), float(g.lon.mean()))
        cap = int(g["객실_추정"].sum() * a.persons_per_room)
        near_stops = int((haversine_km(center[0], center[1], stops.lat.values, stops.lon.values) <= 0.5).sum())
        emd = g["읍면동"].mode().iloc[0]
        rows.append({
            "마을": key, "읍면동": emd, "lat": center[0], "lon": center[1],
            "숙소수": len(g), "객실": int(g["객실_추정"].sum()), "수용인원": cap,
            "중심거리_km": round(float(haversine_km(*cluster.centroid, *center)), 1),
            "정류소_500m": near_stops, "저녁상권_음식점매출_백만원": int(evening.get(emd, 0)),
            "숙소목록": g.sort_values("객실_추정", ascending=False)[["name", "업태", "객실수", "전화", "주소", "lat", "lon"]].head(12).to_dict("records"),
        })
    df = pd.DataFrame(rows)
    df["수용충족"] = (df["수용인원"] / max(need_people, 1)).clip(upper=1.0)
    df["점수"] = (
        45 * df["수용충족"]
        + 25 * (1 - df["중심거리_km"] / radius_km)
        + 15 * (df["정류소_500m"].clip(upper=6) / 6)
        + 15 * (df["저녁상권_음식점매출_백만원"] / max(df["저녁상권_음식점매출_백만원"].max(), 1))
    ).round(1)
    out = df.sort_values("점수", ascending=False).head(top).to_dict("records")
    for r in out:
        r["판단"] = ("필요 인원을 한 마을에서 수용" if r["수용인원"] >= need_people
                    else f"최대 {need_people}명 중 {r['수용인원']}명 수용. 이웃 마을 숙소를 함께 써야 함")
    return out


def evening_spend() -> dict[str, int]:
    """읍면동별 저녁 상권 규모 = 음식점업 카드 이용금액(백만 원, 2019-12).

    원자료의 '매장수' 열은 읍면동 규모에 비해 지나치게 커서(예: 남원읍 한식 3,014곳) 쓰지 않는다.
    """
    c = data.card_monthly()
    c = c[(c["업종대분류"] == "음식점업") & (c["년월"] == "2019-12")]
    return (c.set_index("읍면동")["이용금액"] / 1e6).round(0).astype(int).to_dict()


# ─────────────────────────── 3. 비수기 격차 ───────────────────────────
def offseason_gap(emd: str, sector: str = "숙박업") -> dict:
    """카드 이용금액으로 본 월별 매출 지수 (2017~2019 평균, 최고 달 = 100)."""
    c = data.card_monthly()
    c = c[(c["읍면동"] == emd) & (c["업종대분류"] == sector) & (c["년월"] < "2020-01")].copy()
    if c.empty:
        return {"읍면동": emd, "업종": sector, "available": False}
    c["월"] = c["년월"].str[5:7].astype(int)
    m = c.groupby("월")["이용금액"].mean()
    idx = (m / m.max() * 100).round(0)
    harvest = [11, 12, 1, 2]
    return {
        "읍면동": emd, "업종": sector, "available": True, "기간": "2017-01~2019-12 평균",
        "월별지수": {int(k): int(v) for k, v in idx.items()},
        "최고달": int(idx.idxmax()), "수확철평균지수": int(idx.reindex(harvest).mean()),
        "여름평균지수": int(idx.reindex([7, 8]).mean()),
        "수확철_여름대비_pct": int(round(m.reindex(harvest).mean() / m.reindex([7, 8]).mean() * 100)),
    }


# ─────────────────────────── 4. 셔틀 노선 ───────────────────────────
def plan_shuttle(base: tuple[float, float], requests: pd.DataFrame, cluster: Cluster,
                 a: Assumptions | None = None) -> dict:
    """거점에서 묶음의 농가를 도는 아침 노선. 최대 인원 기준으로 차량 수·좌석을 정한다.

    도로거리 = 직선 × 1.35, 평균 30km/h, 농가당 정차 2분 (가정). 저녁은 같은 노선의 역순.
    정류소 400m 이내 농가는 '노선버스 가능 후보'로 표시하되, 시간표는 확인하지 않았다.
    """
    a = a or Assumptions()
    sub = requests[requests["농가ID"].isin(cluster.farm_ids)].reset_index(drop=True)
    pts = list(zip(sub.lat, sub.lon))
    loads = sub["필요인원"].astype(int).tolist()
    total = sum(loads)
    seats = a.seats_mid if total <= a.seats_mid * 2 else a.seats_large
    groups = split_by_angle(base, pts, loads, seats)
    stops = data.bus_stops()
    vehicles = []
    h, m = map(int, a.work_start.split(":"))
    for gi, g in enumerate(groups):
        gp = [pts[i] for i in g]
        order = order_stops(base, gp)
        seq = [g[i] for i in order]
        legs, cur, km = [], base, 0.0
        for i in seq:
            d = road_km(cur, pts[i])
            km += d
            legs.append({"농가ID": sub.loc[i, "농가ID"], "농가명": sub.loc[i, "농가명"], "인원": loads[i],
                         "누적_km": round(km, 1), "lat": pts[i][0], "lon": pts[i][1]})
            cur = pts[i]
        back = road_km(cur, base)
        minutes = km / 30 * 60 + 2 * len(seq)
        dep = h * 60 + m - minutes - 5
        for leg in legs:
            arrive = dep + leg["누적_km"] / 30 * 60 + 2 * (legs.index(leg))
            leg["도착"] = f"{int(arrive // 60):02d}:{int(arrive % 60):02d}"
        vehicles.append({
            "차량": f"{gi + 1}호차", "좌석": seats, "탑승": sum(loads[i] for i in seq),
            "출발": f"{int(dep // 60):02d}:{int(dep % 60):02d}", "편도_km": round(km, 1),
            "하루_km": round((km + back) * 2, 1), "편도_분": int(round(minutes)), "경로": legs,
        })
    near_bus = []
    for i, (lat, lon) in enumerate(pts):
        d = float(haversine_km(lat, lon, stops.lat.values, stops.lon.values).min())
        if d <= 0.4:
            near_bus.append(sub.loc[i, "농가명"])
    return {"거점": base, "차량": vehicles, "차량수": len(vehicles), "좌석": seats,
            "정류소400m_농가": near_bus, "가정": "도로거리=직선×1.35, 30km/h, 정차 2분"}


# ─────────────────────────── 5. 수지 계산 ───────────────────────────
def check_economics(cluster: Cluster, shuttle: dict, a: Assumptions | None = None) -> dict:
    a = a or Assumptions()
    days, pd_ = cluster.days, cluster.person_days
    bus_day = a.bus_cost_per_day_mid if shuttle["좌석"] <= a.seats_mid else a.bus_cost_per_day_large
    bus_total = bus_day * shuttle["차량수"] * days
    lodging_total = a.lodging_per_person_night * pd_
    rooms_peak = int(np.ceil(cluster.peak_daily / a.persons_per_room))

    worker_lodging_day = a.lodging_per_person_night * (1 - a.farm_lodging_share)
    worker_net_day = a.wage_per_day - worker_lodging_day - a.worker_meal_per_day
    farm_extra_day = a.lodging_per_person_night * a.farm_lodging_share + bus_total / max(pd_, 1)
    viable = worker_net_day >= a.min_worker_net_per_day
    out = {
        "기간_일": days, "연인원": pd_, "최대인원": cluster.peak_daily,
        "청년": {"일당": a.wage_per_day, "숙박본인부담_일": int(worker_lodging_day), "식비_일": a.worker_meal_per_day,
                 "실수령_일": int(worker_net_day), "실수령_시즌": int(worker_net_day * pd_ / max(cluster.peak_daily, 1))},
        "농가": {"추가부담_1인1일": int(farm_extra_day),
                 "총비용_1인1일": int(a.wage_per_day + farm_extra_day),
                 "추가부담_비율_pct": round(farm_extra_day / a.wage_per_day * 100, 1)},
        "민박": {"최대객실": rooms_peak, "예상매출": int(lodging_total), "1인1박": a.lodging_per_person_night},
        "전세버스": {"차량수": shuttle["차량수"], "1일단가": bus_day, "운행일": days, "예상매출": int(bus_total),
                    "총주행_km": round(sum(v["하루_km"] for v in shuttle["차량"]) * days, 0)},
        "성립": viable,
    }
    if not viable:
        gap = a.min_worker_net_per_day - worker_net_day
        share_needed = min(1.0, a.farm_lodging_share + gap / a.lodging_per_person_night)
        out["대안"] = (f"청년 실수령이 하루 {int(worker_net_day):,}원으로 기준 {a.min_worker_net_per_day:,}원보다 적습니다. "
                      f"농가의 숙박 분담을 {share_needed * 100:.0f}%로 올리거나 일당을 {int(gap):,}원 올리면 성립합니다.")
    return out


# ─────────────────────────── 6. 수확 수요 추정 ───────────────────────────
HARVEST_WINDOWS = {  # 일반적인 노지온주 수확 시기 (월: 비중) — 일반 재배력 기준 가정
    "극조생": {10: 0.6, 11: 0.4},
    "조생": {11: 0.45, 12: 0.55},
    "보통": {12: 0.3, 1: 0.5, 2: 0.2},
}
DAYS_IN_MONTH = {10: 31, 11: 30, 12: 31, 1: 31, 2: 28}


def harvest_demand(a: Assumptions | None = None) -> pd.DataFrame:
    """읍면동별 월별 수확 인력 수요(하루 평균 명) = 품종별 생산량 × 수확 시기 비중 ÷ 1인 1일 처리량 ÷ 작업일수.

    작업일수는 달의 70%로 본다(비·주말, 가정). 실제 수요가 아니라 생산량에서 거꾸로 계산한 규모 추정이다.
    """
    a = a or Assumptions()
    t = data.tangerine()
    rows = []
    for _, r in t.iterrows():
        for var, window in HARVEST_WINDOWS.items():
            tons = float(r[f"{var}_생산량_t"])
            for month, share in window.items():
                work_days = DAYS_IN_MONTH[month] * 0.7
                rows.append({"읍면동": r["읍면동"], "월": month,
                             "하루평균_인원": tons * share * 1000 / a.kg_per_person_day / work_days})
    df = pd.DataFrame(rows).groupby(["읍면동", "월"], as_index=False)["하루평균_인원"].sum()
    df["하루평균_인원"] = df["하루평균_인원"].round(0).astype(int)
    return df


# ─────────────────────────── 7. 전세버스 후보 ───────────────────────────
def charter_candidates(min_mid: int = 1, prefer_city: str = "서귀포시") -> list[dict]:
    c = data.charter_bus()
    c = c[c["차량대수(중형)"] + c["차량대수(대형)"] >= min_mid]
    c = c.assign(우선=(c["행정시"] == prefer_city).astype(int)).sort_values(["우선", "총차량"], ascending=False)
    return c.drop(columns="우선").head(8).to_dict("records")


def to_jsonable(obj):
    if isinstance(obj, Cluster):
        return asdict(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    return obj
