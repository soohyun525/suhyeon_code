"""Audio + timeline for the talk-to-camera version ("겨드랑이에 가슴이 생겼어요").

Usage: REQUESTS_CA_BUNDLE=... python3 monologue_audio.py <build_dir>
"""

import json
import os
import sys

import numpy as np

from make_audio import (FPS, SR, envelope, music, place, sfx_boing, sfx_ding, sfx_dun,
                        sfx_whoosh, tts, write_wav)

# (shot, subtitle text, spoken text or None, lead, tail)
LINES = [
    ("intro", "여러분, 제가 임신하고 나서 인간이 포유류라는 사실을 뼈저리게 깨달았거든요?", None, 0.3, 0.15),
    ("punch", "겨드랑이에 가슴이 생겼어요.", None, 0.15, 0.25),
    ("laugh", "ㅋㅋㅋㅋ 진짜예요.", "하하하하! 진짜예요.", 0.1, 0.15),
    ("shower", "어느 날 샤워하다가 보니까 겨드랑이가 볼록한 거예요.", None, 0.2, 0.15),
    ("fat", "처음엔 살이 찐 줄 알았죠.", None, 0.1, 0.15),
    ("squint", "근데 아무리 봐도 좀 이상한 거야.", None, 0.1, 0.2),
    ("clinic1", "병원에 가봤더니 부유방이래요.", None, 0.2, 0.1),
    ("clinic2", "원래 겨드랑이에도 유선 조직이 있을 수 있는데, 임신하면서 커진 거래요.", None, 0.1, 0.2),
    ("but", "아니 근데…", None, 0.2, 0.45),
    ("mammal", "포유류인 건 알겠는데", None, 0.05, 0.1),
    ("dog", "제가 무슨 강아지도 아니고", None, 0.1, 0.1),
    ("why", "젖이 왜 여기까지 있는 거예요?", None, 0.05, 0.2),
    ("lol", "ㅋㅋㅋㅋㅋㅋ", "하하하하하하!", 0.05, 0.2),
    ("feature", "진짜 임신하고 나니까 내 몸인데도 내가 모르는 기능이 계속 발견돼요.", None, 0.2, 0.2),
    ("mystic", "인간의 몸은 정말 신비롭네요.", None, 0.2, 0.3),
    ("deadpan", "근데 굳이 제 몸으로 실험하지는 않으셔도 됐을 것 같은데요.", None, 0.4, 0.5),
]
END_CARD = 2.4


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)

    scenes, lines, voices = [], [], []
    t = 0.0
    for idx, (shot, text, say, lead, tail) in enumerate(LINES):
        v = tts(say or text, "mom", out_dir, idx)
        line_start = t + lead
        line_end = line_start + len(v) / SR
        end = line_end + tail + (END_CARD if idx == len(LINES) - 1 else 0)
        scenes.append({"name": shot, "start": round(t, 3), "end": round(end, 3)})
        lines.append({"scene": shot, "speaker": "mom", "text": text,
                      "start": round(line_start, 3), "end": round(line_end, 3),
                      "mouth": envelope(v)})
        voices.append((line_start, v))
        t = end
    total = t
    sc = {s["name"]: s for s in scenes}
    ln = {l["scene"]: l for l in lines}

    n = int(SR * total) + SR
    voice = np.zeros(n, dtype=np.float32)
    for at, v in voices:
        place(voice, v * 0.95, at)

    sfx = np.zeros(n, dtype=np.float32)
    place(sfx, sfx_dun(1.3), sc["punch"]["start"])
    place(sfx, sfx_boing(), ln["shower"]["end"] - 0.3)
    for name in ("shower", "clinic1", "mammal", "feature", "mystic"):
        place(sfx, sfx_whoosh(), sc[name]["start"] - 0.1)
    place(sfx, sfx_dun(1.0), sc["but"]["start"])
    place(sfx, sfx_boing() * 0.9, sc["dog"]["start"] + 0.05)
    place(sfx, sfx_dun(1.5, low=True), sc["why"]["start"])
    for k in range(3):
        place(sfx, sfx_ding(), sc["feature"]["start"] + 0.5 + k * 1.0)
    for k in range(4):
        place(sfx, sfx_ding() * 0.6, sc["mystic"]["start"] + 0.1 + k * 0.35)

    bgm = music(total + 1)
    bgm = np.pad(bgm, (0, max(0, n - len(bgm))))[:n]
    duck = np.ones(n, dtype=np.float32)
    for at, v in voices:
        duck[int(at * SR):int((at + len(v) / SR) * SR)] = 0.45
    duck = np.convolve(duck, np.ones(4410) / 4410, mode="same")
    # Music cuts out for the two comedic beats.
    gap = np.ones(n, dtype=np.float32)
    for name in ("but", "deadpan"):
        s0 = int(sc[name]["start"] * SR)
        s1 = int((sc[name]["end"] - (END_CARD if name == "deadpan" else 0)) * SR)
        gap[s0:s1] = 0
    gap = np.convolve(gap, np.ones(2205) / 2205, mode="same")
    fade = np.ones(n, dtype=np.float32)
    end_i = int(total * SR)
    fade[end_i - SR:end_i] = np.linspace(1, 0, SR)
    fade[end_i:] = 0

    mix = (voice + sfx + bgm * duck * gap * fade)[:end_i]
    mix = mix / max(1.0, np.abs(mix).max() / 0.95)
    write_wav(os.path.join(out_dir, "mix.wav"), mix)
    with open(os.path.join(out_dir, "timeline.json"), "w") as f:
        json.dump({"fps": FPS, "total": round(total, 3), "scenes": scenes, "lines": lines}, f, ensure_ascii=False)
    print(f"total {total:.2f}s")
    for s in scenes:
        print(f"  {s['name']:8s} {s['start']:6.2f} – {s['end']:6.2f}")


if __name__ == "__main__":
    main()
