"""folium 지도: 행정동별 노지감귤 면적, 추정 감귤밭, 실제 농가(JDC), 농가 요청, 숙소, 거점·셔틀 경로."""
from __future__ import annotations

import os
import re

import folium
import pandas as pd
from folium.plugins import MarkerCluster

from . import data

VENDOR_URL = "/app/static/vendor/"  # Streamlit 정적 파일 (.streamlit/config.toml: enableStaticServing)
CDN = re.compile(r'(src|href)="https://(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|code\.jquery\.com|netdna\.bootstrapcdn\.com)/(?:[^"]*/)?([^/"]+)"')


def tiles_setting() -> str | None:
    """JEJU_SEASON_TILES=none 이면 배경 타일 없이 그린다 (인터넷이 없는 분석 PC용)."""
    v = os.environ.get("JEJU_SEASON_TILES", "OpenStreetMap")
    return None if v.lower() == "none" else v


def render_offline(m: folium.Map) -> str:
    """folium이 CDN에서 불러오는 Leaflet 등을 static/vendor 의 로컬 사본으로 바꿔 HTML로 만든다."""
    html = m.get_root().render()
    html = re.sub(r'<link[^>]+bootstrap-glyphicons\.css"[^>]*>', "", html)
    return CDN.sub(lambda mt: f'{mt.group(1)}="{VENDOR_URL}{mt.group(2)}"', html)


PALETTE = ["#d9480f", "#1971c2", "#2f9e44", "#9c36b5", "#e67700", "#0c8599"]


def build_map(requests: pd.DataFrame, packages: list | None = None, show_stops: bool = False,
              show_lodging: bool = True, focus: tuple[float, float] | None = None) -> folium.Map:
    m = folium.Map(location=focus or (33.30, 126.56), zoom_start=13 if focus else 10, tiles=tiles_setting(),
                   control_scale=True)
    if focus is None:
        m.fit_bounds([[33.20, 126.17], [33.45, 126.94]])

    gj = data.emd_geojson()
    folium.Choropleth(
        geo_data=gj, data=pd.DataFrame([f["properties"] for f in gj["features"]]),
        columns=["읍면동", "면적_ha"], key_on="feature.properties.읍면동",
        fill_color="YlOrBr", fill_opacity=0.45, line_opacity=0.6, nan_fill_opacity=0.05,
        legend_name="노지온주 재배면적 (ha, 2022, 서귀포시 감귤 생산 정보)", name="행정동별 노지감귤 면적",
    ).add_to(m)
    folium.GeoJson(gj, name="행정동 이름", style_function=lambda f: {"fillOpacity": 0, "weight": 0},
                   tooltip=folium.GeoJsonTooltip(fields=["읍면동", "면적_ha", "농가수", "생산량_t"],
                                                 aliases=["읍면동", "노지온주 면적(ha)", "농가수", "생산량(t)"])).add_to(m)

    orch = folium.FeatureGroup(name="노지감귤밭 추정 위치 (점 1개≈15ha, 실제 필지 아님)", show=True)
    for r in data.orchards().itertuples():
        folium.CircleMarker((r.lat, r.lon), radius=3, color="#f08c00", weight=0, fill=True, fill_opacity=0.55,
                            tooltip=f"{r.읍면동} 추정 감귤밭 (≈{r.대표면적_ha}ha)").add_to(orch)
    orch.add_to(m)

    jdc = folium.FeatureGroup(name="감귤 농가 실제 위치 (JDC 농가 기본정보)", show=True)
    for r in data.farms_jdc().itertuples():
        folium.Marker((r.lat, r.lon), icon=folium.Icon(color="green", icon="leaf", prefix="fa"),
                      tooltip=f"{r.농가명} · {r.읍면동}(좌표 기준) · {r.토지면적}㎡").add_to(jdc)
    jdc.add_to(m)

    req = folium.FeatureGroup(name="농가 일손 요청 (가상)", show=True)
    for r in requests.itertuples():
        folium.CircleMarker((r.lat, r.lon), radius=4 + int(r.필요인원) * 1.5, color="#c92a2a", weight=2,
                            fill=True, fill_opacity=0.8,
                            tooltip=f"{r.농가ID} {r.농가명} · {pd.Timestamp(r.시작일):%m/%d}~{pd.Timestamp(r.종료일):%m/%d} · {r.필요인원}명").add_to(req)
    req.add_to(m)

    if show_lodging:
        lod = data.lodging()
        lod = lod[lod["소규모"]]
        mc = MarkerCluster(name="소규모 숙소 (마을숙박업소·안전인증민박)", show=False)
        for r in lod.itertuples():
            folium.CircleMarker((r.lat, r.lon), radius=3, color="#1864ab", fill=True, fill_opacity=0.8,
                                tooltip=f"{r.name} · {r.업태} · 객실 {r.객실수}").add_to(mc)
        mc.add_to(m)

    if show_stops:
        st = folium.FeatureGroup(name="버스정류소", show=True)
        for r in data.bus_stops().itertuples():
            folium.CircleMarker((r.lat, r.lon), radius=1.5, color="#495057", weight=0, fill=True,
                                fill_opacity=0.6, tooltip=r.name).add_to(st)
        st.add_to(m)

    for i, p in enumerate(packages or []):
        color = PALETTE[i % len(PALETTE)]
        g = folium.FeatureGroup(name=f"{p.cluster.id} 시즌 패키지 · {p.status}", show=True)
        folium.Circle(p.cluster.centroid, radius=max(p.cluster.radius_km, 0.8) * 1000, color=color,
                      weight=2, fill=False, dash_array="6 6",
                      tooltip=f"{p.cluster.id} · 농가 {len(p.cluster.farm_ids)}곳 · 최대 {p.cluster.peak_daily}명/일").add_to(g)
        if p.basecamps:
            b = p.basecamps[0]
            folium.Marker((b["lat"], b["lon"]), icon=folium.Icon(color="blue", icon="house", prefix="fa"),
                          tooltip=f"거점 {b['마을']} · 숙소 {b['숙소수']}곳 · 수용 {b['수용인원']}명").add_to(g)
            for s in b["숙소목록"]:
                folium.CircleMarker((s["lat"], s["lon"]), radius=4, color=color, fill=True, fill_opacity=1,
                                    tooltip=f"{s['name']} · 객실 {s['객실수']}").add_to(g)
        if p.shuttle:
            for v in p.shuttle["차량"]:
                path = [p.shuttle["거점"], *[(leg["lat"], leg["lon"]) for leg in v["경로"]]]
                folium.PolyLine(path, color=color, weight=4, opacity=0.85,
                                tooltip=f"{p.cluster.id} {v['차량']} {v['출발']} 출발 · 편도 {v['편도_km']}km").add_to(g)
                for k, leg in enumerate(v["경로"], 1):
                    folium.Marker((leg["lat"], leg["lon"]), icon=folium.DivIcon(
                        html=f'<div style="font:600 11px sans-serif;color:#fff;background:{color};border-radius:9px;'
                             f'width:18px;height:18px;line-height:18px;text-align:center">{k}</div>'),
                        tooltip=f"{k}. {leg['농가명']} {leg['도착']} 도착 · {leg['인원']}명").add_to(g)
        g.add_to(m)

    folium.LayerControl(collapsed=True).add_to(m)
    return m
