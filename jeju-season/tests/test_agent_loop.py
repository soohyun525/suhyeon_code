"""API 키 없이 Agent 도구 루프를 검증한다: 가짜 클라이언트가 도구를 차례로 부르고 끝낸다."""
from types import SimpleNamespace as NS

from season import agent, data


class FakeMessages:
    def __init__(self, script):
        self.script, self.calls = list(script), []

    def create(self, **kw):
        self.calls.append(kw)
        return self.script.pop(0)


def _use(i, name, inp):
    return NS(type="tool_use", id=f"t{i}", name=name, input=inp)


def test_agent_runs_tool_chain_and_returns_text():
    script = [
        NS(stop_reason="tool_use", content=[_use(1, "cluster_requests", {"link_km": 3.5, "min_mean_daily": 12, "min_days": 10})]),
        NS(stop_reason="tool_use", content=[_use(2, "plan_shuttle", {"cluster_id": "S1", "basecamp_rank": 1})]),
        NS(stop_reason="tool_use", content=[_use(3, "check_economics", {"cluster_id": "S1"}),
                                            _use(4, "offseason_gap", {"emd": "남원읍", "sector": "숙박업"})]),
        NS(stop_reason="tool_use", content=[_use(5, "draft_proposals", {"cluster_id": "S1"})]),
        NS(stop_reason="tool_use", content=[_use(6, "plan_meetups", {})]),
        NS(stop_reason="end_turn", content=[NS(type="text", text="S1 패키지를 만들었습니다.")]),
    ]
    fake = NS(beta=NS(messages=FakeMessages(script)))
    state = agent.AgentState(requests=data.sample_requests())
    events = []
    text, msgs = agent.run_agent(state, [{"role": "user", "content": "패키지 만들어 줘"}],
                                 on_event=lambda k, p: events.append((k, p["name"])), client=fake)
    assert text == "S1 패키지를 만들었습니다."
    assert ("tool_result", "draft_proposals") in events
    assert ("tool_result", "plan_meetups") in events
    assert not [e for e in events if e[0] == "tool_error"]
    assert "S1" in state.economics
    # 병렬 도구 결과는 한 user 메시지에 함께 돌려준다
    assert len(msgs[6]["content"]) == 2
    kw = fake.beta.messages.calls[0]
    assert kw["model"] == agent.MODEL and kw["fallbacks"] == "default"


def test_agent_reports_tool_errors_to_model():
    script = [
        NS(stop_reason="tool_use", content=[_use(1, "check_economics", {"cluster_id": "S9"})]),
        NS(stop_reason="end_turn", content=[NS(type="text", text="먼저 묶겠습니다.")]),
    ]
    fake = NS(beta=NS(messages=FakeMessages(script)))
    _, msgs = agent.run_agent(agent.AgentState(requests=data.sample_requests()),
                              [{"role": "user", "content": "x"}], client=fake)
    result = msgs[2]["content"][0]
    assert result["is_error"] and "cluster_requests" in result["content"]
