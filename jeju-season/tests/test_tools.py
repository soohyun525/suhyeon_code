import pandas as pd
import pytest

from season import data, tools
from season.geo import order_stops, split_by_angle, tour_length
from season.package import build_packages


def _req(rows):
    df = pd.DataFrame(rows, columns=["농가ID", "농가명", "lat", "lon", "시작일", "종료일", "필요인원"])
    df["시작일"], df["종료일"] = pd.to_datetime(df["시작일"]), pd.to_datetime(df["종료일"])
    return df


def test_processed_data_present():
    t = data.tangerine()
    assert "남원읍" in set(t["읍면동"])
    assert t["노지온주_면적_ha"].sum() > 5000
    assert len(data.orchards()) > 300
    assert data.lodging()["소규모"].sum() > 500


def test_cluster_links_close_overlapping_farms_only():
    r = _req([
        ("A", "a", 33.29, 126.69, "2026-12-01", "2026-12-20", 8),
        ("B", "b", 33.295, 126.70, "2026-12-05", "2026-12-25", 8),   # 가깝고 겹침 → A와 묶임
        ("C", "c", 33.24, 126.26, "2026-12-01", "2026-12-20", 8),    # 멀다
        ("D", "d", 33.291, 126.691, "2027-01-10", "2027-01-20", 8),  # 가깝지만 날짜 안 겹침
    ])
    cs = tools.cluster_requests(r, min_mean_daily=10, min_days=10)
    by_farm = {f: c.id for c in cs for f in c.farm_ids}
    assert by_farm["A"] == by_farm["B"]
    assert by_farm["C"] != by_farm["A"] and by_farm["D"] != by_farm["A"]
    ab = next(c for c in cs if "A" in c.farm_ids)
    assert ab.peak_daily == 16 and ab.viable
    assert ab.person_days == 8 * 20 + 8 * 21


def test_small_cluster_not_viable_with_suggestion():
    r = _req([("A", "a", 33.24, 126.26, "2026-12-01", "2026-12-05", 2)])
    (c,) = tools.cluster_requests(r)
    assert not c.viable and c.reasons and c.suggestions


def test_route_order_is_not_worse_than_input_order():
    start = (33.28, 126.70)
    pts = [(33.30, 126.66), (33.285, 126.71), (33.31, 126.69), (33.29, 126.68)]
    order = order_stops(start, pts)
    assert sorted(order) == list(range(4))
    assert tour_length(pts, order, start) <= tour_length(pts, list(range(4)), start) + 1e-9


def test_split_respects_capacity():
    pts = [(33.28 + i * 0.01, 126.70) for i in range(6)]
    groups = split_by_angle((33.28, 126.69), pts, [10] * 6, capacity=25)
    assert all(sum(10 for _ in g) <= 25 for g in groups)
    assert sorted(i for g in groups for i in g) == list(range(6))


def test_economics_flags_low_worker_pay():
    r = data.sample_requests()
    c = next(c for c in tools.cluster_requests(r) if c.viable)
    b = tools.find_basecamps(c)[0]
    sh = tools.plan_shuttle((b["lat"], b["lon"]), r, c)
    ok = tools.check_economics(c, sh)
    assert ok["성립"] and ok["청년"]["실수령_일"] == 100_000 - 12_500 - 10_000
    bad = tools.check_economics(c, sh, tools.Assumptions(wage_per_day=70_000))
    assert not bad["성립"] and "대안" in bad


def test_offseason_gap_shows_winter_dip():
    g = tools.offseason_gap("남원읍")
    assert g["available"] and g["수확철_여름대비_pct"] < 100


@pytest.mark.parametrize("emd", ["남원읍", "표선면"])
def test_harvest_demand_peaks_in_nov_dec(emd):
    d = tools.harvest_demand()
    d = d[d["읍면동"] == emd].set_index("월")["하루평균_인원"]
    assert d.idxmax() in (11, 12)


def test_sample_pipeline_end_to_end():
    ps = build_packages(data.sample_requests())
    statuses = [p.status for p in ps]
    assert "성립" in statuses and any(s.startswith("보류") for s in statuses)
    p = next(p for p in ps if p.status == "성립")
    assert set(p.proposals) == {"숙소", "전세버스", "농협·센터"}
    assert p.cluster.start in p.proposals["전세버스"]


def test_meetups_cover_season_and_join_packages():
    from season import meetups
    ps = build_packages(data.sample_requests())
    cal = meetups.plan_meetups(ps)
    live = [p for p in ps if p.status == "성립"]
    assert set(cal["묶음"]) == {p.cluster.id for p in live}
    for p in live:
        d = pd.to_datetime(cal[cal["묶음"] == p.cluster.id]["날짜"])
        assert d.min() >= pd.Timestamp(p.cluster.start) and d.max() <= pd.Timestamp(p.cluster.end)
    sat = cal[cal["요일"] == "토"]
    assert sat["장소"].nunique() == 1  # 여러 거점이 같은 곳에서 만난다
    assert (cal[cal["요일"] == "일"]["모임"].str.contains("한라산")).all()
    card = meetups.season_card(live[0])
    assert live[0].cluster.start in card["기간"]


def test_map_html_has_no_cdn_links():
    import re
    from season.mapview import build_map, render_offline
    r = data.sample_requests()
    html = render_offline(build_map(r, build_packages(r)))
    urls = re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"', html)
    assert urls and all(u.startswith("/app/static/vendor/") for u in urls)
    import pathlib
    vendor = pathlib.Path(data.ROOT, "static", "vendor")
    assert all((vendor / u.rsplit("/", 1)[1]).exists() for u in urls)
