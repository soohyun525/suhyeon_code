"""Claude 도구 호출 Agent. 키가 없으면 package.build_packages 가 같은 일을 규칙대로 한다.

Agent는 tools.py 의 계산 함수만 부른다. 숫자는 도구 결과에서만 가져오고, 자기가 만든 숫자를 쓰지 않게 한다.
"""
from __future__ import annotations

import json
import os
from collections.abc import Callable
from dataclasses import dataclass, field

import pandas as pd

from . import tools
from .package import SeasonPackage, write_proposals
from .tools import Assumptions

MODEL = os.environ.get("JEJU_SEASON_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("JEJU_SEASON_EFFORT", "medium")
MAX_STEPS = int(os.environ.get("JEJU_SEASON_MAX_STEPS", "16"))

SYSTEM = """당신은 '제주 시즌' 코디네이터 Agent입니다. 서귀포시 노지감귤 수확철에 농가들의 일손 요청을 모아
'숙소 + 통근 셔틀 + 일' 시즌 패키지로 묶고, 숙소·전세버스·농협(제주농업인력지원센터)에 보낼 제안을 준비합니다.

원칙
- 숫자는 반드시 도구 결과에서 가져옵니다. 도구가 주지 않은 수치를 만들지 않습니다.
- 가정값(일당, 숙박 단가, 버스 단가 등)으로 계산한 결과는 '가정'이라고 밝힙니다.
- 묶음이 성립하지 않으면 그렇다고 말하고, 도구가 준 조건(인원·날짜·거리)을 농가에 돌려줄 문장으로 정리합니다.
- 청년 실수령이 기준보다 낮으면 패키지를 권하지 말고 대안(분담 비율, 일당)을 제시합니다.
- 일자리 알선·근로계약·숙소 예약·차량 운행은 하지 않습니다. 확정은 농협·센터와 사람이 합니다.
- 추정 감귤밭 위치와 가상 농가 일정은 실제 데이터가 아니라고 필요할 때 밝힙니다.
- 답은 한국어로, 짧은 문단과 표 위주로 씁니다."""


@dataclass
class AgentState:
    requests: pd.DataFrame
    assumptions: Assumptions = field(default_factory=Assumptions)
    clusters: dict[str, tools.Cluster] = field(default_factory=dict)
    basecamps: dict[str, list[dict]] = field(default_factory=dict)
    shuttles: dict[str, dict] = field(default_factory=dict)
    economics: dict[str, dict] = field(default_factory=dict)


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {"name": name, "description": description, "strict": True,
            "input_schema": {"type": "object", "properties": properties, "required": required,
                             "additionalProperties": False}}


CID = {"cluster_id": {"type": "string", "description": "묶음 ID (예: S1)"}}
TOOLS = [
    _tool("list_requests", "현재 접수된 농가 일손 요청 목록(위치·기간·필요 인원)을 본다.", {}, []),
    _tool("cluster_requests", "가까우면서 일정이 겹치는 농가를 시즌 묶음으로 묶고 성립 여부·조건을 계산한다.",
          {"link_km": {"type": "number", "description": "농가끼리 이을 최대 직선거리 km (기본 3.5)"},
           "min_mean_daily": {"type": "integer", "description": "성립 최소 평균 하루 인원 (기본 12)"},
           "min_days": {"type": "integer", "description": "성립 최소 기간 일수 (기본 10)"}},
          ["link_km", "min_mean_daily", "min_days"]),
    _tool("find_basecamps", "묶음 중심 근처에서 숙소가 모인 거점 마을 후보 3곳을 점수와 함께 찾는다.", CID, ["cluster_id"]),
    _tool("offseason_gap", "읍면동의 업종별 카드 매출 월별 지수(최고달=100)와 수확철/여름 비율을 본다.",
          {"emd": {"type": "string", "description": "읍면동 이름 (예: 남원읍)"},
           "sector": {"type": "string", "enum": ["숙박업", "음식점업", "운송업", "소매업", "서비스업"]}},
          ["emd", "sector"]),
    _tool("plan_shuttle", "거점 후보(순위)에서 묶음 농가를 도는 아침 셔틀 노선·차량 수·출발 시각을 계산한다.",
          {**CID, "basecamp_rank": {"type": "integer", "description": "find_basecamps 결과 순위 (1부터)"}},
          ["cluster_id", "basecamp_rank"]),
    _tool("check_economics", "셔틀 계산 후, 청년 실수령·농가 추가부담·민박·버스 예상 매출을 가정값으로 계산한다.", CID, ["cluster_id"]),
    _tool("harvest_demand", "읍면동별 월별 수확 인력 규모를 생산량에서 추정한다 (하루 평균 명).",
          {"emd": {"type": "string", "description": "읍면동 이름. 전체는 '전체'"}}, ["emd"]),
    _tool("charter_candidates", "제주 전세버스 업체 후보(차량 대수, 서귀포 우선)를 본다.", {}, []),
    _tool("draft_proposals", "계산이 끝난 묶음의 숙소·전세버스·농협용 제안서 초안을 만든다.", CID, ["cluster_id"]),
]


def _run_tool(state: AgentState, name: str, args: dict):
    a = state.assumptions
    if name == "list_requests":
        r = state.requests.copy()
        r["시작일"], r["종료일"] = r["시작일"].astype(str), r["종료일"].astype(str)
        return r[["농가ID", "읍면동", "시작일", "종료일", "필요인원", "비고"]].to_dict("records")
    if name == "cluster_requests":
        cs = tools.cluster_requests(state.requests, link_km=args["link_km"],
                                    min_mean_daily=args["min_mean_daily"], min_days=args["min_days"])
        state.clusters = {c.id: c for c in cs}
        state.basecamps.clear(), state.shuttles.clear(), state.economics.clear()
        return [tools.to_jsonable(c) for c in cs]
    if name == "harvest_demand":
        d = tools.harvest_demand(a)
        if args["emd"] != "전체":
            d = d[d["읍면동"] == args["emd"]]
        return d.to_dict("records")
    if name == "charter_candidates":
        return tools.charter_candidates()
    if name == "offseason_gap":
        return tools.offseason_gap(args["emd"], args["sector"])

    cid = args["cluster_id"]
    if cid not in state.clusters:
        raise ValueError(f"묶음 {cid}가 없습니다. 먼저 cluster_requests를 호출하세요.")
    c = state.clusters[cid]
    if name == "find_basecamps":
        state.basecamps[cid] = tools.find_basecamps(c, a=a)
        return [{k: v for k, v in b.items() if k != "숙소목록"} | {"대표숙소": [s["name"] for s in b["숙소목록"][:5]]}
                for b in state.basecamps[cid]]
    if name == "plan_shuttle":
        bcs = state.basecamps.get(cid) or tools.find_basecamps(c, a=a)
        state.basecamps[cid] = bcs
        rank = args["basecamp_rank"]
        if not 1 <= rank <= len(bcs):
            raise ValueError(f"거점 순위는 1~{len(bcs)}")
        b = bcs[rank - 1]
        state.shuttles[cid] = tools.plan_shuttle((b["lat"], b["lon"]), state.requests, c, a) | {"거점마을": b["마을"]}
        return state.shuttles[cid]
    if name == "check_economics":
        if cid not in state.shuttles:
            raise ValueError("먼저 plan_shuttle을 호출하세요.")
        state.economics[cid] = tools.check_economics(c, state.shuttles[cid], a)
        return state.economics[cid]
    if name == "draft_proposals":
        if cid not in state.economics:
            raise ValueError("먼저 check_economics를 호출하세요.")
        bcs = state.basecamps[cid]
        chosen = next((b for b in bcs if b["마을"] == state.shuttles[cid].get("거점마을")), bcs[0])
        p = SeasonPackage(cluster=c, basecamps=[chosen], shuttle=state.shuttles[cid],
                          economics=state.economics[cid], gap=tools.offseason_gap(chosen["읍면동"]))
        return write_proposals(p, a)
    raise ValueError(f"알 수 없는 도구: {name}")


def run_agent(state: AgentState, messages: list[dict], on_event: Callable[[str, dict], None] | None = None,
              client=None) -> tuple[str, list[dict]]:
    """Claude 도구 호출 루프. messages 는 대화 기록(이어서 쓰려면 반환값을 다시 넘긴다)."""
    import anthropic

    client = client or anthropic.Anthropic()
    on_event = on_event or (lambda kind, payload: None)
    for _ in range(MAX_STEPS):
        resp = client.beta.messages.create(
            model=MODEL, max_tokens=16000, system=SYSTEM, tools=TOOLS, messages=messages,
            output_config={"effort": EFFORT},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        )
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason == "refusal":
            return "요청을 처리하지 못했습니다(안전 정책). 질문을 바꿔 다시 시도해 주세요.", messages
        if resp.stop_reason == "max_tokens":
            return "답이 너무 길어 중간에 끊겼습니다. 범위를 좁혀 다시 물어 주세요.", messages
        if resp.stop_reason == "pause_turn":
            continue
        uses = [b for b in resp.content if b.type == "tool_use"]
        if not uses:
            return "\n".join(b.text for b in resp.content if b.type == "text"), messages
        results = []
        for u in uses:
            on_event("tool_use", {"name": u.name, "input": u.input})
            try:
                out = tools.to_jsonable(_run_tool(state, u.name, dict(u.input)))
                results.append({"type": "tool_result", "tool_use_id": u.id,
                                "content": json.dumps(out, ensure_ascii=False, default=str)})
                on_event("tool_result", {"name": u.name, "output": out})
            except Exception as e:  # noqa: BLE001 - 오류를 모델에게 돌려줘 스스로 고치게 한다
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": f"오류: {e}", "is_error": True})
                on_event("tool_error", {"name": u.name, "error": str(e)})
        messages.append({"role": "user", "content": results})
    return "도구 호출 한도에 도달했습니다. 질문을 나눠 다시 시도해 주세요.", messages


def has_api_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
