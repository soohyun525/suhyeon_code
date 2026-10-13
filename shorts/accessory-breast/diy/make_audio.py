"""Build voice lines (gTTS), synthesized music/SFX, the final mix, and timeline.json.

Usage: REQUESTS_CA_BUNDLE=... python3 make_audio.py <build_dir>
"""

import json
import os
import subprocess
import sys
import wave

import numpy as np
from gtts import gTTS

SR = 44100
FPS = 30

# (scene, speaker, text). Each scene gets exactly one line.
LINES = [
    ("girl", "girl", "나는 이슬만 먹고 사는 소녀였는데…"),
    ("mirror", "mom", "근데 겨드랑이에 이건 뭐야?!"),
    ("clinic", "doc", "부유방이에요. 젖줄이 겨드랑이까지 있어서, 임신하면 커지기도 해요."),
    ("realize", "mom", "젖줄…? 그럼 나… 포유류였어?!"),
    ("docu", "narr", "그렇게 소녀는, 포유류가 되었다."),
]
# Silence before / after each line inside its scene, seconds.
LEAD = {"girl": 0.5, "mirror": 1.3, "clinic": 0.5, "realize": 1.0, "docu": 0.9}
TAIL = {"girl": 0.3, "mirror": 0.4, "clinic": 1.1, "realize": 0.7, "docu": 0.6}
END_CARD = 2.6


def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def read_wav(path):
    with wave.open(path) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float32) / 32768.0


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def tts(text, speaker, out_dir, idx):
    mp3 = os.path.join(out_dir, f"line{idx}.mp3")
    wav = os.path.join(out_dir, f"line{idx}.wav")
    gTTS(text, lang="ko").save(mp3)
    if speaker == "doc":
        # Slightly lower, calmer voice for the doctor.
        filt = f"asetrate={SR}*0.9,aresample={SR},atempo=1.2"
    elif speaker == "narr":
        # Deep, slow nature-documentary narrator with a little room echo.
        filt = f"asetrate={SR}*0.78,aresample={SR},atempo=1.0,aecho=0.8:0.6:70:0.22"
    elif speaker == "girl":
        # Sweet, airy flashback voice.
        filt = f"asetrate={SR}*1.12,aresample={SR},atempo=1.08,aecho=0.8:0.5:40:0.2"
    else:
        # Slightly brighter and quicker for the young mom.
        filt = f"asetrate={SR}*1.04,aresample={SR},atempo=1.22"
    filt += ",silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.2"
    run("ffmpeg", "-y", "-i", mp3, "-af", filt, "-ac", "1", "-ar", str(SR), wav)
    return read_wav(wav)


def pluck(freq, dur, amp=0.25):
    """Karplus-Strong string pluck."""
    n = int(SR * dur)
    period = int(SR / freq)
    buf = np.random.uniform(-1, 1, period).astype(np.float32)
    out = np.zeros(n, dtype=np.float32)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out * amp


def music(total):
    """Light ukulele-ish loop: C - G - Am - F, 104 bpm, strummed eighths."""
    rng = np.random.default_rng(7)
    np.random.seed(7)
    beat = 60 / 104
    chords = [
        [261.63, 329.63, 392.00],  # C
        [196.00, 246.94, 293.66],  # G
        [220.00, 261.63, 329.63],  # Am
        [174.61, 220.00, 261.63],  # F
    ]
    cache = {}
    out = np.zeros(int(SR * (total + 2)), dtype=np.float32)
    t, bar = 0.0, 0
    pattern = [1.0, 0.0, 0.6, 0.7, 0.0, 0.6, 0.8, 0.5]  # eighth-note accents
    while t < total + 1:
        chord = chords[bar % 4]
        for k, acc in enumerate(pattern):
            if acc == 0:
                continue
            start = t + k * beat / 2
            for j, f in enumerate(chord):
                key = round(f, 2)
                if key not in cache:
                    cache[key] = pluck(f, 0.9)
                s = int((start + j * 0.012) * SR)
                seg = cache[key] * acc * (0.9 + 0.2 * rng.random())
                e = min(len(out), s + len(seg))
                if s < len(out):
                    out[s:e] += seg[: e - s]
        # Soft bass on the root
        root = chord[0] / 2
        s = int(t * SR)
        bass = pluck(root, beat * 2, 0.35)
        e = min(len(out), s + len(bass))
        out[s:e] += bass[: e - s]
        t += beat * 4
        bar += 1
    return out[: int(SR * total)] * 0.35


def sfx_boing():
    d = 0.45
    t = np.linspace(0, d, int(SR * d), False)
    f = 300 + 500 * t / d + 60 * np.sin(2 * np.pi * 14 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-3.5 * t) * 0.45).astype(np.float32)


def sfx_whoosh():
    d = 0.35
    n = int(SR * d)
    noise = np.random.default_rng(1).uniform(-1, 1, n).astype(np.float32)
    # Crude low-pass sweep via moving average with shrinking window.
    out = np.convolve(noise, np.ones(12) / 12, mode="same")
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return out * env * 0.5


def sfx_ding():
    d = 0.9
    t = np.linspace(0, d, int(SR * d), False)
    x = np.sin(2 * np.pi * 1318.5 * t) + 0.5 * np.sin(2 * np.pi * 1975.5 * t)
    return (x * np.exp(-4 * t) * 0.22).astype(np.float32)


def sfx_tap():
    d = 0.05
    t = np.linspace(0, d, int(SR * d), False)
    return (np.sin(2 * np.pi * 1800 * t) * np.exp(-90 * t) * 0.25).astype(np.float32)


def sfx_dun(gain=1.0, low=False):
    d = 0.9 if low else 0.32
    t = np.linspace(0, d, int(SR * d), False)
    f = 55 if low else 82
    x = np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 2 * t) + 0.3 * np.sin(2 * np.pi * f * 3 * t)
    x += np.random.default_rng(3).uniform(-1, 1, len(t)) * np.exp(-30 * t) * 0.6
    return (np.tanh(x * 1.5) * np.exp(-(2.5 if low else 7) * t) * 0.32 * gain).astype(np.float32)


def place(track, clip, at):
    s = int(at * SR)
    e = min(len(track), s + len(clip))
    if s < len(track):
        track[s:e] += clip[: e - s]


def envelope(x, fps=FPS):
    hop = SR // fps
    frames = int(np.ceil(len(x) / hop))
    env = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(frames)])
    env = env / (env.max() + 1e-9)
    env = np.clip((env - 0.08) / 0.6, 0, 1)
    return [round(float(v), 3) for v in env]


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)

    scenes, lines = [], []
    t = 0.0
    voices = []
    for idx, (scene, speaker, text) in enumerate(LINES):
        v = tts(text, speaker, out_dir, idx)
        start = t
        line_start = start + LEAD[scene]
        line_end = line_start + len(v) / SR
        end = line_end + TAIL[scene]
        if scene == "docu":
            end += END_CARD
        scenes.append({"name": scene, "start": round(start, 3), "end": round(end, 3)})
        lines.append({
            "scene": scene, "speaker": speaker, "text": text,
            "start": round(line_start, 3), "end": round(line_end, 3),
            "mouth": envelope(v),
        })
        voices.append((line_start, v))
        t = end
    total = t

    voice = np.zeros(int(SR * total) + SR, dtype=np.float32)
    for at, v in voices:
        place(voice, v * 0.95, at)

    sfx = np.zeros_like(voice)
    sc = {s["name"]: s for s in scenes}
    # Dreamy chimes for the flashback.
    for k in range(4):
        place(sfx, sfx_ding() * 0.7, sc["girl"]["start"] + 0.1 + k * 0.5)
    # Surprise sting when she notices the lump.
    place(sfx, sfx_boing(), sc["mirror"]["start"] + 0.9)
    for s_ in scenes[1:]:
        place(sfx, sfx_whoosh(), s_["start"] - 0.12)
    # "젖…줄?" record scratch-ish boing after the doctor.
    place(sfx, sfx_boing() * 0.8, lines[2]["end"] + 0.1)
    # dun · dun · DUN on the three zoom hits.
    for k, at in enumerate([0.0, 0.35, 0.7]):
        place(sfx, sfx_dun(1.0 + 0.5 * k, low=k == 2), sc["realize"]["start"] + at)

    bgm = music(total + 1)
    bgm = np.pad(bgm, (0, max(0, len(voice) - len(bgm))))[: len(voice)]
    # Duck music under speech.
    duck = np.ones_like(voice)
    for at, v in voices:
        s, e = int(at * SR), int((at + len(v) / SR) * SR)
        duck[s:e] = 0.45
    duck = np.convolve(duck, np.ones(4410) / 4410, mode="same")
    fade = np.ones_like(voice)
    fl = int(SR * 1.2)
    end_i = int(total * SR)
    fade[end_i - fl:end_i] = np.linspace(1, 0, fl)
    fade[end_i:] = 0

    r = sc["realize"]
    s0, s1 = int(r["start"] * SR), int(r["end"] * SR)
    gap = np.ones_like(voice)
    gap[s0:s1] = 0.0
    gap = np.convolve(gap, np.ones(2205) / 2205, mode="same")
    mix = voice + sfx + bgm * duck * fade * gap
    mix = mix[: int(total * SR)]
    mix = mix / max(1.0, np.abs(mix).max() / 0.95)
    write_wav(os.path.join(out_dir, "mix.wav"), mix)

    with open(os.path.join(out_dir, "timeline.json"), "w") as f:
        json.dump({"fps": FPS, "total": round(total, 3), "scenes": scenes, "lines": lines}, f, ensure_ascii=False)
    print(f"total {total:.2f}s", [(s['name'], s['start'], s['end']) for s in scenes])


if __name__ == "__main__":
    main()
