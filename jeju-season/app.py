"""제주 시즌 — 서귀포 노지감귤 일손을 '숙소 + 셔틀 + 일' 패키지로 묶는 Agent.

    streamlit run app.py
"""
from __future__ import annotations

import json

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from season import agent, data, meetups, tools
from season.mapview import build_map, render_offline
from season.package import build_packages
from season.tools import Assumptions

st.set_page_config(page_title="제주 시즌 · 감귤 일손 패키지", page_icon="🍊", layout="wide")

# ───────────────────────── 상태 ─────────────────────────
if "requests" not in st.session_state:
    st.session_state.requests = data.sample_requests()
if "chat" not in st.session_state:
    st.session_state.chat, st.session_state.chat_log = [], []

with st.sidebar:
    st.header("가정값")
    st.caption("출처가 없는 단가는 모두 가정입니다. 바꾸면 즉시 다시 계산합니다.")
    a = Assumptions(
        wage_per_day=st.number_input("일당 (원)", 60_000, 200_000, 100_000, 5_000,
                                     help="2026-11 보도 '일당 10만 원에도 사람이 없다'를 하한으로 사용"),
        lodging_per_person_night=st.number_input("숙박 1인 1박 (원)", 10_000, 80_000, 25_000, 1_000),
        farm_lodging_share=st.slider("숙박비 농가 분담", 0.0, 1.0, 0.5, 0.05),
        bus_cost_per_day_mid=st.number_input("중형 전세버스 1일 (원)", 150_000, 800_000, 350_000, 10_000),
        bus_cost_per_day_large=st.number_input("대형 전세버스 1일 (원)", 200_000, 1_000_000, 450_000, 10_000),
        worker_meal_per_day=st.number_input("청년 식비 1일 (원)", 0, 30_000, 10_000, 1_000),
        min_worker_net_per_day=st.number_input("청년 실수령 하한 1일 (원)", 30_000, 150_000, 60_000, 5_000),
        kg_per_person_day=st.number_input("수확 1인 1일 처리량 (kg)", 150, 800, 400, 50),
    )
    st.header("묶기 기준")
    link_km = st.slider("농가 연결 거리 (km)", 1.0, 8.0, 3.5, 0.5)
    min_daily = st.slider("성립 최소 평균 인원 (명/일)", 4, 40, 12)
    min_days = st.slider("성립 최소 기간 (일)", 3, 30, 10)

reqs = st.session_state.requests
packages = build_packages(reqs, a, link_km=link_km, min_mean_daily=min_daily, min_days=min_days)

st.title("🍊 제주 시즌")
st.markdown("**서귀포 노지감귤 농가의 일손 요청을 모아 '숙소 + 통근 셔틀 + 일' 패키지로 묶고, "
            "숙소·전세버스·농협에 보낼 제안서를 만듭니다.** 일자리 알선과 계약은 농협·제주농업인력지원센터가 맡습니다.")

c1, c2, c3, c4 = st.columns(4)
ok = [p for p in packages if p.status == "성립"]
c1.metric("접수 농가", f"{len(reqs)}곳")
c2.metric("시즌 묶음", f"{len(packages)}개", f"성립 {len(ok)}")
c3.metric("최대 인원 합계", f"{sum(p.cluster.peak_daily for p in ok)}명/일")
c4.metric("민박 예상 매출 합계", f"{sum(p.economics['민박']['예상매출'] for p in ok if p.economics) / 1e6:,.1f}백만 원")

tab_map, tab_req, tab_pkg, tab_youth, tab_agent, tab_data = st.tabs(
    ["지도", "농가 일정", "시즌 패키지", "청년 시즌", "Agent 대화", "데이터·근거"])

# ───────────────────────── 지도 ─────────────────────────
with tab_map:
    l, r = st.columns([1, 3])
    with l:
        focus_id = st.selectbox("보기", ["서귀포시 전체"] + [p.cluster.id + " 확대" for p in packages])
        show_stops = st.checkbox("버스정류소 표시", False)
        st.markdown(
            "- **색칠**: 행정동별 노지온주 재배면적 (2022)\n"
            "- **주황 점**: 노지감귤밭 추정 위치. 면적 15ha마다 점 1개를 버스정류소 0.2~1.8km 생활권에 배치한 근사이며 실제 필지가 아닙니다.\n"
            "- **초록 아이콘**: 실제 감귤 농가 (JDC 농가 기본정보)\n"
            "- **빨간 원**: 농가 일손 요청 (가상, 크기=필요 인원)\n"
            "- **파란 집**: 패키지 거점 숙소 마을, **선**: 아침 셔틀 경로와 정차 순서")
    with r:
        focus = next((p.cluster.centroid for p in packages if focus_id.startswith(p.cluster.id + " ")), None)
        components.html(render_offline(build_map(reqs, packages, show_stops=show_stops, focus=focus)), height=660)

# ───────────────────────── 농가 일정 ─────────────────────────
with tab_req:
    st.caption("농가가 올린 일손 일정입니다. 표에서 바로 고치거나 행을 추가할 수 있습니다. 기본값은 **가상 데이터**입니다.")
    edited = st.data_editor(
        reqs, num_rows="dynamic", width="stretch", key="req_editor",
        column_config={
            "시작일": st.column_config.DateColumn(), "종료일": st.column_config.DateColumn(),
            "필요인원": st.column_config.NumberColumn(min_value=1, max_value=30),
            "lat": st.column_config.NumberColumn(format="%.5f"), "lon": st.column_config.NumberColumn(format="%.5f"),
        })
    b1, b2 = st.columns(2)
    if b1.button("변경 적용", type="primary"):
        e = edited.dropna(subset=["lat", "lon", "시작일", "종료일", "필요인원"]).copy()
        e["시작일"], e["종료일"] = pd.to_datetime(e["시작일"]), pd.to_datetime(e["종료일"])
        e["농가ID"] = e["농가ID"].fillna(pd.Series([f"N{i}" for i in range(len(e))], index=e.index))
        st.session_state.requests = e.reset_index(drop=True)
        st.rerun()
    if b2.button("가상 데이터로 되돌리기"):
        st.session_state.requests = data.sample_requests()
        st.rerun()

# ───────────────────────── 시즌 패키지 ─────────────────────────
with tab_pkg:
    for p in packages:
        c = p.cluster
        badge = {"성립": "🟢", "조건부: 수지 조정 필요": "🟡"}.get(p.status, "⚪")
        with st.expander(f"{badge} {c.id} · {p.status} · 농가 {len(c.farm_ids)}곳 · {c.start}~{c.end} · 최대 {c.peak_daily}명/일",
                         expanded=p.status != "보류: 규모 부족"):
            st.markdown("**Agent 판단 기록**\n" + "\n".join(f"1. {x}" for x in p.log))
            if not c.viable:
                st.warning("농가에 돌려줄 조건\n\n" + "\n".join(f"- {s}" for s in c.suggestions))
                continue
            if not p.basecamps:
                continue
            st.subheader("거점 숙소 후보")
            st.dataframe(pd.DataFrame(p.basecamps).drop(columns=["숙소목록", "lat", "lon"]), hide_index=True,
                         width="stretch",
                         column_config={"점수": st.column_config.ProgressColumn(min_value=0, max_value=100, format="%.0f")})
            with st.popover("1순위 마을 숙소 목록"):
                st.dataframe(pd.DataFrame(p.basecamps[0]["숙소목록"]).drop(columns=["lat", "lon"]), hide_index=True)
            st.subheader("아침 셔틀")
            st.caption(p.shuttle["가정"] + ". 저녁은 역순. "
                       + (f"정류소 400m 안 농가(노선버스 후보, 시간표 미확인): {', '.join(p.shuttle['정류소400m_농가'])}"
                          if p.shuttle["정류소400m_농가"] else ""))
            for v in p.shuttle["차량"]:
                st.markdown(f"**{v['차량']}** {v['좌석']}인승 · {v['출발']} 출발 · 탑승 {v['탑승']}명 · 편도 {v['편도_km']}km/{v['편도_분']}분 · 하루 {v['하루_km']}km")
                st.dataframe(pd.DataFrame(v["경로"]).drop(columns=["lat", "lon"]), hide_index=True)
            st.subheader("수지 (가정값 기준)")
            e = p.economics
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("청년 실수령/일", f"{e['청년']['실수령_일']:,}원")
            m2.metric("농가 추가부담/1인1일", f"{e['농가']['추가부담_1인1일']:,}원", f"일당 대비 {e['농가']['추가부담_비율_pct']}%",
                      delta_color="off")
            m3.metric("민박 예상 매출", f"{e['민박']['예상매출'] / 1e6:,.1f}백만 원", f"최대 {e['민박']['최대객실']}실", delta_color="off")
            m4.metric("전세버스 예상 매출", f"{e['전세버스']['예상매출'] / 1e6:,.1f}백만 원", f"{e['전세버스']['차량수']}대 × {e['기간_일']}일",
                      delta_color="off")
            if "대안" in e:
                st.error(e["대안"])
            if p.gap and p.gap.get("available"):
                g = p.gap
                st.info(f"{g['읍면동']} 숙박업 카드 매출: 수확철(11~2월) 평균이 여름(7~8월)의 **{g['수확철_여름대비_pct']}%** "
                        f"({g['기간']}). 월별 지수(최고달=100): "
                        + " · ".join(f"{k}월 {v}" for k, v in sorted(g["월별지수"].items())))
            st.subheader("제안서")
            for t, (who, text) in zip(st.tabs(list(p.proposals)), p.proposals.items()):
                with t:
                    st.text_area(who, text, height=300, key=f"{c.id}-{who}")
                    st.download_button("내려받기 (.txt)", text, file_name=f"{c.id}_{who}_제안서.txt", key=f"dl-{c.id}-{who}")
            st.subheader("전세버스 업체 후보 (서귀포 우선)")
            st.dataframe(pd.DataFrame(p.charters), hide_index=True, width="stretch")

# ───────────────────────── 청년 시즌 ─────────────────────────
with tab_youth:
    live = [p for p in packages if p.status == "성립"]
    if not live:
        st.info("성립한 시즌이 없습니다. 농가 일정이나 묶기 기준을 바꿔 보세요.")
    else:
        st.caption("청년에게 공개되는 화면입니다. 숫자는 패키지 계산 결과(가정값 포함)를 그대로 씁니다. 신청은 농협·제주농업인력지원센터로 합니다.")
        cols = st.columns(len(live))
        for col, p in zip(cols, live):
            card = meetups.season_card(p, a, cohort=1)
            with col.container(border=True):
                st.subheader(card["이름"])
                for key in ["기간", "모집", "숙소", "출근", "실수령"]:
                    st.markdown(f"**{key}** · {card[key]}")
                with st.expander("가기 전에 알아 둘 것"):
                    st.markdown("\n".join(f"- {x}" for x in card["현실점검"]))
        st.subheader("저녁·주말 밋업 달력")
        st.caption("같은 농장이 아니어도 함께합니다. 평일은 거점에서 걸어서, 토·일은 시즌 셔틀을 추가 운행합니다(일요일 휴무 가정). "
                   "버스 시간표 데이터는 받지 못해 막차 대신 셔틀 복귀를 기본으로 했습니다.")
        cal = meetups.plan_meetups(packages, a)
        pick = st.multiselect("모임 종류", sorted(cal["모임"].unique()), default=sorted(cal["모임"].unique()))
        st.dataframe(cal[cal["모임"].isin(pick)], hide_index=True, width="stretch")
        cost = meetups.weekend_shuttle_cost(cal, a)
        st.markdown("**주말 셔틀 추가 비용(가정: 1회 = 중형 1일 단가의 50%)** · "
                    + " · ".join(f"{k} {v / 10_000:,.0f}만 원" for k, v in cost.items()))
        st.subheader("한 가지 미션 (선택)")
        st.caption("일손 외에 자기 전공으로 농가·마을에 남기는 결과물 하나. 시즌이 끝나면 경력 기록으로 정리합니다.")
        st.dataframe(pd.DataFrame(meetups.MISSIONS, columns=["분야", "미션 예시", "남는 것"]), hide_index=True, width="stretch")

# ───────────────────────── Agent 대화 ─────────────────────────
with tab_agent:
    if not agent.has_api_key():
        st.info("ANTHROPIC_API_KEY가 없어 대화형 Agent는 꺼져 있습니다. '시즌 패키지' 탭은 키 없이 같은 도구를 규칙대로 실행한 결과입니다. "
                "키를 `.env` 또는 환경변수로 넣으면 Claude가 같은 도구를 직접 골라 쓰며 대화합니다.")
    else:
        st.caption(f"모델 {agent.MODEL} · effort {agent.EFFORT}. Agent는 계산 도구만 부르고, 숫자는 도구 결과에서만 씁니다.")
        for role, text in st.session_state.chat_log:
            st.chat_message(role).markdown(text)
        q = st.chat_input("예: 12월 남원 쪽 묶음으로 패키지 만들고, 숙소 제안서를 써 줘")
        if q:
            st.chat_message("user").markdown(q)
            state = agent.AgentState(requests=st.session_state.requests, assumptions=a)
            st.session_state.chat.append({"role": "user", "content": q})
            with st.chat_message("assistant"):
                steps = st.status("도구 실행 중", expanded=False)

                def on_event(kind, payload, _s=steps):
                    if kind == "tool_use":
                        _s.write(f"🔧 {payload['name']} {json.dumps(payload['input'], ensure_ascii=False)}")
                    elif kind == "tool_error":
                        _s.write(f"⚠️ {payload['name']}: {payload['error']}")

                try:
                    answer, st.session_state.chat = agent.run_agent(state, st.session_state.chat, on_event)
                except Exception as ex:  # noqa: BLE001
                    answer = f"Agent 호출 실패: {ex}"
                steps.update(state="complete")
                st.markdown(answer)
            st.session_state.chat_log += [("user", q), ("assistant", answer)]

# ───────────────────────── 데이터·근거 ─────────────────────────
with tab_data:
    st.subheader("행정동별 노지온주 (서귀포시 감귤 생산 정보, 2022)")
    st.dataframe(data.tangerine(), hide_index=True, width="stretch")
    st.subheader("월별 수확 인력 규모 추정 (하루 평균 명)")
    st.caption(f"생산량 × 일반 수확 시기 비중 ÷ 1인 1일 {a.kg_per_person_day}kg ÷ 작업일(월의 70%). 생산량에서 거꾸로 낸 규모 추정입니다.")
    hd = tools.harvest_demand(a).pivot(index="읍면동", columns="월", values="하루평균_인원")[[10, 11, 12, 1, 2]]
    hd.columns = [f"{m}월" for m in hd.columns]
    st.dataframe(hd.sort_values("12월", ascending=False), width="stretch")
    st.subheader("숙박업 비수기 격차 (카드 매출 월별 지수, 최고달=100)")
    rows = [tools.offseason_gap(e) for e in data.tangerine()["읍면동"]]
    gaps = pd.DataFrame([{"읍면동": g["읍면동"], **{f"{k}월": v for k, v in sorted(g["월별지수"].items())},
                          "수확철/여름 %": g["수확철_여름대비_pct"]} for g in rows if g.get("available")])
    st.dataframe(gaps.sort_values("수확철/여름 %"), hide_index=True, width="stretch")
    st.subheader("사용한 데이터")
    st.markdown(open(data.ROOT / "docs" / "data-sources.md", encoding="utf-8").read())
