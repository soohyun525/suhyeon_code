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
    ("mirror", "mom", "어…? 이거 뭐야?"),
    ("panic", "mom", "겨드랑이에 멍울이…? 혹시 큰 병이면 어떡해!"),
    ("clinic", "doc", "부유방이에요. 임신하면 호르몬 때문에 커질 수 있어요."),
    ("sofa", "mom", "나만 몰랐어?! 임산부 여러분, 놀라지 말고 병원 먼저 가봐요!"),
]
# Silence before / after each line inside its scene, seconds.
LEAD = {"mirror": 1.4, "panic": 0.5, "clinic": 0.6, "sofa": 0.5}
TAIL = {"mirror": 0.5, "panic": 0.6, "clinic": 1.6, "sofa": 0.4}
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
        filt = f"asetrate={SR}*0.9,aresample={SR},atempo=1.18"
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
        if scene == "sofa":
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
    # Surprise sting when she notices the lump, before her line.
    place(sfx, sfx_boing(), scenes[0]["start"] + 0.9)
    for sc in scenes[1:]:
        place(sfx, sfx_whoosh(), sc["start"] - 0.12)
    # Phone typing taps during the panic scene.
    for k in range(9):
        place(sfx, sfx_tap(), scenes[1]["start"] + 0.15 + k * 0.11)
    # Relief ding on the diagnosis.
    place(sfx, sfx_ding(), lines[2]["end"] + 0.1)

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

    mix = voice + sfx + bgm * duck * fade
    mix = mix[: int(total * SR)]
    mix = mix / max(1.0, np.abs(mix).max() / 0.95)
    write_wav(os.path.join(out_dir, "mix.wav"), mix)

    with open(os.path.join(out_dir, "timeline.json"), "w") as f:
        json.dump({"fps": FPS, "total": round(total, 3), "scenes": scenes, "lines": lines}, f, ensure_ascii=False)
    print(f"total {total:.2f}s", [(s['name'], s['start'], s['end']) for s in scenes])


if __name__ == "__main__":
    main()
