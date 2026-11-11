"""data/raw/ 의 공개 데이터를 서귀포시 기준 지도·분석용 파일로 정리해 data/processed/ 에 쓴다.

    python scripts/fetch_raw.py   # 원본 내려받기 (한 번)
    python scripts/build_data.py  # 가공

만드는 파일
- emd.geojson            서귀포시 행정동 경계 + 노지감귤(온주) 면적·농가수·생산량
- tangerine_emd.csv      행정동별 노지온주 품종(극조생·조생·보통)별 면적·생산량, 2012→2022 변화
- orchard_estimated.csv  노지감귤밭 추정 위치 (행정동 면적에 비례, 버스정류소 생활권 안에 배치) ※ 실제 필지 아님
- farms_jdc.csv          JDC 감귤 농가 실제 위치 (서귀포시)
- lodging.csv            영업중인 숙박업소 위치·객실수·업태 (마을숙박업소 + 안전인증민박)
- bus_stops.csv          서귀포시 버스정류소 위치
- bus_routes.csv         서귀포 시내·읍면지선 노선 운행 횟수
- card_monthly.csv       행정동 × 월 × 업종 대분류 카드 이용금액·매장수 (2017-01~2020-04)
- charter_bus.csv        전세버스 업체 (차량 대수, 소재 행정시)
"""
from __future__ import annotations

import json
import pathlib

import numpy as np
import pandas as pd
from shapely.geometry import Point, shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

# 행정동 → 법정동 (서귀포시 동지역). 읍·면은 이름이 같다.
# 카드 데이터가 법정동 기준이라 행정동으로 묶는 데 쓴다. 경계가 걸치는 동은 주된 쪽에 붙였다(초안).
LEGAL_TO_ADMIN = {
    "서귀동": "정방동",  # 서귀동은 정방·중앙·천지·송산동에 나뉘어 있다. 대표로 정방동에 합산.
    "보목동": "송산동", "토평동": "영천동", "상효동": "영천동",
    "하효동": "효돈동", "신효동": "효돈동",
    "동홍동": "동홍동", "서홍동": "서홍동", "호근동": "서홍동",
    "법환동": "대륜동", "서호동": "대륜동",
    "강정동": "대천동", "도순동": "대천동", "영남동": "대천동", "월평동": "대천동",
    "중문동": "중문동", "대포동": "중문동", "하원동": "중문동", "회수동": "중문동",
    "상예동": "예래동", "하예동": "예래동", "색달동": "예래동",
}
OPEN_FIELD = ["노지온주(극조생)", "노지온주(조생)", "노지온주(보통)"]
HA_PER_ESTIMATED_POINT = 15  # 추정 감귤밭 점 1개가 대표하는 면적(ha)


def read_csv(name: str, **kw) -> pd.DataFrame:
    for enc in ("utf-8-sig", "cp949"):
        try:
            return pd.read_csv(RAW / name, encoding=enc, **kw)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"인코딩을 알 수 없음: {name}")


def load_emd_polygons() -> dict[str, object]:
    gj = json.loads((RAW / "skorea_submunicipalities_geo_simple.json").read_text(encoding="utf-8"))
    return {
        f["properties"]["name"]: shape(f["geometry"])
        for f in gj["features"]
        if str(f["properties"]["code"]).startswith("3902")  # 서귀포시
    }


def build_tangerine() -> pd.DataFrame:
    df = read_csv("15048184.csv")
    df = df[df["구분"].isin(["농가수", "면적", "생산량"])]
    df["노지온주"] = df[OPEN_FIELD].sum(axis=1)
    latest = int(df["연도"].max())
    wide = df[df["연도"] == latest].pivot_table(index="읍면동", columns="구분", values=OPEN_FIELD + ["노지온주"], aggfunc="sum")
    wide.columns = [f"{v}_{k}" for v, k in wide.columns]
    base = df[df["연도"] == int(df["연도"].min())].pivot_table(index="읍면동", columns="구분", values="노지온주", aggfunc="sum")
    out = pd.DataFrame({
        "읍면동": wide.index,
        "기준연도": latest,
        "노지온주_면적_ha": wide["노지온주_면적"].round(1),
        "노지온주_농가수": wide["노지온주_농가수"].astype(int),
        "노지온주_생산량_t": wide["노지온주_생산량"].round(0),
        "극조생_면적_ha": wide["노지온주(극조생)_면적"],
        "조생_면적_ha": wide["노지온주(조생)_면적"],
        "보통_면적_ha": wide["노지온주(보통)_면적"],
        "극조생_생산량_t": wide["노지온주(극조생)_생산량"].round(0),
        "조생_생산량_t": wide["노지온주(조생)_생산량"].round(0),
        "보통_생산량_t": wide["노지온주(보통)_생산량"].round(0),
    }).reset_index(drop=True)
    out["면적변화_2012대비_pct"] = (
        (out["노지온주_면적_ha"].values / base.reindex(out["읍면동"])["면적"].values - 1) * 100
    ).round(1)
    return out.sort_values("노지온주_면적_ha", ascending=False)


def build_bus_stops(polys: dict) -> pd.DataFrame:
    stops = read_csv("15010850.csv").rename(columns={"정류소아이디": "id", "정류소명": "name", "경도": "lon", "위도": "lat"})
    names, prepared = list(polys), {k: prep(v) for k, v in polys.items()}
    emd = []
    for lon, lat in zip(stops["lon"], stops["lat"]):
        p = Point(lon, lat)
        emd.append(next((n for n in names if prepared[n].contains(p)), None))
    stops["읍면동"] = emd
    return stops.dropna(subset=["읍면동"])[["id", "name", "lat", "lon", "읍면동"]].drop_duplicates("id")


def build_orchards(polys: dict, tangerine: pd.DataFrame, stops: pd.DataFrame) -> pd.DataFrame:
    """행정동별 노지온주 면적을 15ha 단위 점으로 나눠, 버스정류소 0.2~1.8km 생활권 안에 무작위 배치.

    필지 단위 감귤밭 위치는 공개 파일로 받을 수 없어(팜맵 API는 인증키 필요) 쓰는 근사다.
    감귤밭은 해안~중산간 마을 주변에 모여 있고 마을에는 정류소가 있다는 점을 이용한다.
    """
    rng = np.random.default_rng(20261111)
    rows = []
    for _, t in tangerine.iterrows():
        name, area = t["읍면동"], float(t["노지온주_면적_ha"])
        if name not in polys or area <= 0:
            continue
        poly, pp = polys[name], prep(polys[name])
        local = stops[stops["읍면동"] == name][["lat", "lon"]].to_numpy()
        if len(local) == 0:
            continue
        n = max(1, round(area / HA_PER_ESTIMATED_POINT))
        minx, miny, maxx, maxy = poly.bounds
        placed, tries = 0, 0
        while placed < n and tries < n * 400:
            tries += 1
            lon, lat = rng.uniform(minx, maxx), rng.uniform(miny, maxy)
            if not pp.contains(Point(lon, lat)):
                continue
            d = haversine_km(lat, lon, local[:, 0], local[:, 1]).min()
            if 0.2 <= d <= 1.8:
                rows.append({"읍면동": name, "lat": round(lat, 6), "lon": round(lon, 6),
                             "대표면적_ha": round(area / n, 1), "구분": "추정"})
                placed += 1
    return pd.DataFrame(rows)


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * np.arcsin(np.sqrt(a))


def assign_emd(df: pd.DataFrame, polys: dict) -> pd.Series:
    names, prepared = list(polys), {k: prep(v) for k, v in polys.items()}
    return pd.Series([
        next((n for n in names if prepared[n].contains(Point(lon, lat))), None)
        for lat, lon in zip(df["lat"], df["lon"])
    ], index=df.index)


def build_lodging(polys: dict) -> pd.DataFrame:
    town = read_csv("15109351.csv")
    town = town[(town["시군구명"] == "서귀포시") & (town["상세영업상태명"].str.strip() == "영업중")]
    town = pd.DataFrame({
        "name": town["숙박업소명"], "업태": town["업태구분명"], "마을": town["마을명"],
        "lat": town["위도"], "lon": town["경도"], "객실수": town["객실수"].fillna(0).astype(int),
        "전화": town["숙박업소전화번호"], "주소": town["소재지도로명주소"], "출처": "제주관광공사 마을숙박업소",
    })
    safe = read_csv("15056410.csv")
    safe = pd.DataFrame({
        "name": safe["민박명"], "업태": "민박업(안전인증)", "마을": None, "lat": safe["위도"], "lon": safe["경도"],
        "객실수": 0, "전화": None, "주소": safe["소재지"], "출처": "서귀포시 안전인증지정민박",
    })
    safe = safe[~safe["name"].isin(town["name"])]
    out = pd.concat([town, safe], ignore_index=True).dropna(subset=["lat", "lon"])
    out["읍면동"] = assign_emd(out, polys)
    out = out.dropna(subset=["읍면동"])
    # 대형 호텔·콘도는 장기 단체 투숙 대상에서 뺀다 (비수기 소규모 숙소가 목적)
    out["소규모"] = (out["객실수"] <= 30) & ~out["업태"].isin(["호텔업", "휴양콘도운영업"])
    return out


def build_card() -> pd.DataFrame:
    usecols = ["년월", "시도명", "읍면동명", "업종명", "업종명 대분류", "이용금액", "매장수"]
    card = pd.read_csv(RAW / "15074691.csv", encoding="cp949", usecols=usecols)
    card = card[card["시도명"] == "서귀포시"].copy()
    card["행정동"] = card["읍면동명"].map(LEGAL_TO_ADMIN).fillna(card["읍면동명"])
    amount = card.groupby(["년월", "행정동", "업종명 대분류"], as_index=False)["이용금액"].sum()
    stores = (card.groupby(["년월", "행정동", "업종명 대분류", "업종명"])["매장수"].max()
              .groupby(level=[0, 1, 2]).sum().reset_index())
    out = amount.merge(stores, on=["년월", "행정동", "업종명 대분류"])
    return out.rename(columns={"행정동": "읍면동", "업종명 대분류": "업종대분류"})


def build_bus_routes() -> pd.DataFrame:
    city = read_csv("15051473.csv")
    rural = read_csv("15051472.csv")
    rural.insert(0, "구분", "읍면지선")
    cols = ["구분", "노선명", "운행구간", "거리(km)", "1일운행횟수(평일)", "배차간격(분)(평일)"]
    out = pd.concat([city[cols], rural[cols]], ignore_index=True)
    return out[out["운행구간"].astype(str).str.contains("서귀포|남원|표선|성산|안덕|대정|중문|위미|효돈|하례|신례|태흥|화순|모슬포")]


def build_charter() -> pd.DataFrame:
    df = read_csv("15056324.csv")
    df["행정시"] = np.where(df["주소"].str.contains("서귀포시"), "서귀포시", "제주시")
    df["총차량"] = df["차량대수(대형)"].fillna(0) + df["차량대수(중형)"].fillna(0)
    return df[["업체명", "전화번호", "주소", "행정시", "차량대수(대형)", "차량대수(중형)", "총차량"]]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    polys = load_emd_polygons()
    tangerine = build_tangerine()
    tangerine.to_csv(OUT / "tangerine_emd.csv", index=False)

    feats = []
    tmap = tangerine.set_index("읍면동")
    for name, poly in polys.items():
        props = {"읍면동": name}
        if name in tmap.index:
            r = tmap.loc[name]
            props.update({"면적_ha": float(r["노지온주_면적_ha"]), "농가수": int(r["노지온주_농가수"]),
                          "생산량_t": float(r["노지온주_생산량_t"])})
        feats.append({"type": "Feature", "properties": props, "geometry": poly.simplify(0.0008).__geo_interface__})
    (OUT / "emd.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False))

    stops = build_bus_stops(polys)
    stops.to_csv(OUT / "bus_stops.csv", index=False)
    build_orchards(polys, tangerine, stops).to_csv(OUT / "orchard_estimated.csv", index=False)

    jdc = read_csv("15097167.csv")
    jdc = jdc.rename(columns={"위도": "lat", "경도": "lon"})
    jdc["읍면동"] = assign_emd(jdc, polys)  # 주소의 시군구와 좌표가 어긋나는 행이 있어 좌표로 판정
    jdc = jdc.dropna(subset=["읍면동"])
    jdc[["농가명", "읍면동", "주소", "lat", "lon", "토지면적"]].to_csv(OUT / "farms_jdc.csv", index=False)

    build_lodging(polys).to_csv(OUT / "lodging.csv", index=False)
    build_bus_routes().to_csv(OUT / "bus_routes.csv", index=False)
    build_card().to_csv(OUT / "card_monthly.csv", index=False)
    build_charter().to_csv(OUT / "charter_bus.csv", index=False)
    union = unary_union(list(polys.values()))
    print("서귀포시 경계 bounds:", [round(v, 4) for v in union.bounds])
    for f in sorted(OUT.iterdir()):
        print(f"{f.name:24s} {f.stat().st_size:>10,} bytes")


if __name__ == "__main__":
    main()
