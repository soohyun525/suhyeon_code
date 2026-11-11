"""도구를 순서대로 엮어 '시즌 패키지'를 만들고, 상대별 제안서를 쓴다 (키 없이 동작하는 기본 경로)."""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .tools import (Assumptions, Cluster, charter_candidates, check_economics, cluster_requests,
                    find_basecamps, offseason_gap, plan_shuttle)


@dataclass
class SeasonPackage:
    cluster: Cluster
    basecamps: list[dict] = field(default_factory=list)
    shuttle: dict | None = None
    economics: dict | None = None
    gap: dict | None = None
    charters: list[dict] = field(default_factory=list)
    proposals: dict[str, str] = field(default_factory=dict)
    log: list[str] = field(default_factory=list)

    @property
    def status(self) -> str:
        if not self.cluster.viable:
            return "보류: 규모 부족"
        if not self.basecamps:
            return "보류: 거점 숙소 없음"
        if self.economics and not self.economics["성립"]:
            return "조건부: 수지 조정 필요"
        return "성립"


def build_packages(requests: pd.DataFrame, a: Assumptions | None = None, **cluster_kw) -> list[SeasonPackage]:
    a = a or Assumptions()
    out = []
    for c in cluster_requests(requests, **cluster_kw):
        p = SeasonPackage(cluster=c)
        p.log.append(f"{c.id}: 농가 {len(c.farm_ids)}곳, {c.start}~{c.end} ({c.days}일), 최대 {c.peak_daily}명/일, 평균 {c.mean_daily}명/일")
        if not c.viable:
            p.log.append("규모가 작아 숙소·셔틀 제안을 만들지 않음 → 농가에 조건 회신: " + " / ".join(c.reasons))
            out.append(p)
            continue
        p.basecamps = find_basecamps(c, a=a)
        if not p.basecamps:
            p.log.append("반경 안에 소규모 숙소가 없어 보류")
            out.append(p)
            continue
        best = p.basecamps[0]
        p.log.append(f"거점 1순위 {best['마을']} (숙소 {best['숙소수']}곳, 수용 {best['수용인원']}명, 점수 {best['점수']})")
        p.shuttle = plan_shuttle((best["lat"], best["lon"]), requests, c, a)
        p.log.append(f"셔틀 {p.shuttle['차량수']}대 ({p.shuttle['좌석']}인승), 1호차 {p.shuttle['차량'][0]['출발']} 출발")
        p.economics = check_economics(c, p.shuttle, a)
        p.log.append(f"청년 실수령 하루 {p.economics['청년']['실수령_일']:,}원, 농가 추가부담 1인1일 {p.economics['농가']['추가부담_1인1일']:,}원")
        p.gap = offseason_gap(best["읍면동"])
        p.charters = charter_candidates()
        p.proposals = write_proposals(p, a)
        out.append(p)
    return out


def _won(v: int | float) -> str:
    v = int(v)
    return f"{v / 10_000:,.0f}만 원" if v >= 100_000 else f"{v:,}원"


def write_proposals(p: SeasonPackage, a: Assumptions) -> dict[str, str]:
    c, b, s, e, g = p.cluster, p.basecamps[0], p.shuttle, p.economics, p.gap
    gap_line = ""
    if g and g.get("available"):
        gap_line = (f"{g['읍면동']} 숙박업 카드 매출은 수확철(11~2월) 평균이 여름(7~8월)의 {g['수확철_여름대비_pct']}% 수준입니다"
                    f" ({g['기간']}, 제주 카드 매출 공공데이터).")
    v1 = s["차량"][0]
    lodging = (
        f"[제주 시즌 · 숙소 참여 제안] {b['마을']} 일대 숙소 운영자께\n\n"
        f"{gap_line}\n"
        f"{c.start}부터 {c.end}까지 {c.days}일간, 인근 감귤 농가 {len(c.farm_ids)}곳에서 일할 청년이 하루 최대 {c.peak_daily}명 머뭅니다.\n"
        f"- 필요 객실: 최대 {e['민박']['최대객실']}실 ({a.persons_per_room}인 1실)\n"
        f"- 제안 단가: 1인 1박 {e['민박']['1인1박']:,}원 (장기·단체 투숙)\n"
        f"- 시즌 예상 매출(마을 전체): {_won(e['민박']['예상매출'])}\n"
        f"- 출퇴근: 매일 아침 {v1['출발']} 셔틀이 마을에서 출발합니다. 숙소까지의 이동은 걱정하지 않으셔도 됩니다.\n\n"
        f"참여 의사와 가능 객실 수를 알려 주시면 농협·센터와 함께 확정합니다."
    )
    bus = (
        f"[제주 시즌 · 통근 셔틀 운행 제안] 전세버스 사업자께\n\n"
        f"수확철 비수기에 평일 고정 운행을 제안드립니다.\n"
        f"- 기간: {c.start}~{c.end} ({c.days}일)\n"
        f"- 차량: {s['좌석']}인승 {s['차량수']}대\n"
        + "".join(f"- {v['차량']}: {v['출발']} {b['마을']} 출발, 농가 {len(v['경로'])}곳 경유, 하루 약 {v['하루_km']}km (출퇴근 왕복)\n" for v in s["차량"])
        + f"- 제안 단가: 1대 1일 {e['전세버스']['1일단가']:,}원, 시즌 예상 매출 {_won(e['전세버스']['예상매출'])}\n"
        f"- 주말: 같은 차량으로 밋업·한라산 탐방 셔틀 추가 운행 협의 가능\n\n"
        f"운행 계약과 승객 명단은 농협·센터를 통해 확정합니다."
    )
    nh = (
        f"[제주 시즌 · 모집 상품 정리] 농협·제주농업인력지원센터 담당자께\n\n"
        f"{', '.join(c.farm_ids)} 농가의 수확 일손 요청을 하나의 시즌으로 묶었습니다.\n"
        f"- 기간 {c.start}~{c.end} ({c.days}일), 하루 최대 {c.peak_daily}명, 연인원 {c.person_days}명\n"
        f"- 거점 숙소: {b['마을']} (숙소 {b['숙소수']}곳, 추정 수용 {b['수용인원']}명)\n"
        f"- 셔틀: {s['좌석']}인승 {s['차량수']}대, 오전 {v1['출발']} 출발\n"
        f"- 청년 실수령(추정): 하루 {e['청년']['실수령_일']:,}원 (일당 {a.wage_per_day:,}원 − 숙박 본인부담 {e['청년']['숙박본인부담_일']:,}원 − 식비 {a.worker_meal_per_day:,}원)\n"
        f"- 농가 추가부담(추정): 1인 1일 {e['농가']['추가부담_1인1일']:,}원 (숙박 분담 {int(a.farm_lodging_share * 100)}% + 셔틀)\n\n"
        f"모집 공고 초안\n"
        f"「2026 서귀포 노지감귤 시즌 · {b['마을']} 기수」 {c.start} 시작, {c.days}일. 숙소·통근 셔틀 제공, 저녁·주말 청년 밋업.\n"
        f"근로계약·보험·알선은 기관 절차로 진행합니다. 위 단가는 가정값이며 확정 전 조정이 필요합니다."
    )
    return {"숙소": lodging, "전세버스": bus, "농협·센터": nh}
