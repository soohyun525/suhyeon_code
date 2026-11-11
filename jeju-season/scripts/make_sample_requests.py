"""가상 농가 일손 요청을 만든다 (data/sample/farm_requests.csv). 실제 농가가 아니다.

농가 위치는 추정 감귤밭 점(orchard_estimated.csv)에서 뽑는다.
남원읍 위미·신례 일대에 큰 묶음, 표선면에 중간 묶음, 대정읍에 작은(성립 안 되는) 묶음이 생기도록 배치한다.
"""
from __future__ import annotations

import pathlib

import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
rng = np.random.default_rng(7)

orch = pd.read_csv(ROOT / "data" / "processed" / "orchard_estimated.csv")

PLAN = [  # (읍면동, 중심 lat, lon, 농가 수, 시작 범위, 기간 범위, 인원 범위)
    ("남원읍", 33.290, 126.690, 12, ("2026-12-01", "2026-12-06"), (14, 22), (2, 5)),
    ("표선면", 33.330, 126.810, 7, ("2026-12-08", "2026-12-12"), (12, 18), (2, 4)),
    ("대정읍", 33.240, 126.260, 3, ("2026-11-24", "2026-11-28"), (5, 8), (1, 3)),
]
rows, n = [], 0
for emd, clat, clon, k, (s0, s1), (d0, d1), (p0, p1) in PLAN:
    cand = orch[orch["읍면동"] == emd].copy()
    cand["d"] = np.hypot(cand.lat - clat, (cand.lon - clon) * 0.84)
    pick = cand.nsmallest(k, "d")
    starts = pd.date_range(s0, s1)
    for _, r in pick.iterrows():
        n += 1
        start = starts[rng.integers(len(starts))]
        rows.append({
            "농가ID": f"F{n:02d}", "농가명": f"{emd[:2]} 가상농가 {n:02d}", "읍면동": emd,
            "lat": round(r.lat + rng.normal(0, 0.002), 6), "lon": round(r.lon + rng.normal(0, 0.002), 6),
            "작물": "노지온주", "작업": "수확",
            "시작일": start.date(), "종료일": (start + pd.Timedelta(days=int(rng.integers(d0, d1 + 1)) - 1)).date(),
            "필요인원": int(rng.integers(p0, p1 + 1)), "비고": "가상 데이터",
        })
out = ROOT / "data" / "sample" / "farm_requests.csv"
out.parent.mkdir(parents=True, exist_ok=True)
pd.DataFrame(rows).to_csv(out, index=False)
print(out, len(rows))
