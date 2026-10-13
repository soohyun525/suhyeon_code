"""Generate the "accessory breast during pregnancy" short with Higgsfield's Seedance 2.0.

Usage:
    export HF_API_KEY_ID=...        # from https://console.higgsfield.ai
    export HF_API_KEY_SECRET=...
    python3 shorts/accessory-breast/generate.py

Writes short.mp4 next to this file. Standard library only.
"""

import json
import os
import sys
import time
import urllib.request
import uuid

ENDPOINT = "https://api.higgsfield.ai/bytedance/seedance-2.0/text-to-video"

PROMPT = """Vertical 9:16 Korean short-form video, warm natural lighting, realistic, 4 shots, same woman throughout.
Main character: Korean woman in her mid-20s, shoulder-length black hair, about 5 months pregnant with a visible baby bump, wearing a plain grey sleeveless top.

Shot 1 (0-3s): Bright home bathroom. She stands at the mirror, raises one arm and touches the side of her chest near the armpit over her top, then freezes. She mutters in Korean: "어…? 이거 뭐야?"
Shot 2 (3-7s): Close-up of her face, eyes wide with surprise and worry. She grabs her smartphone and types quickly. She says in Korean, anxious: "겨드랑이에 멍울이…? 혹시 큰 병이면 어떡해!"
Shot 3 (7-11s): Clean obstetrics clinic room. A friendly female Korean doctor in a white coat smiles and explains. Doctor says in Korean, calm and kind: "부유방이에요. 임신하면 호르몬 때문에 커질 수 있어요." The woman exhales in relief and gently strokes her belly.
Shot 4 (11-15s): Cozy living room sofa. She looks into the camera, laughing, and says cheerfully in Korean: "나만 몰랐어?! 임산부 여러분, 놀라지 말고 병원 먼저 가봐요!"

Tasteful, fully clothed, no nudity. Light, relatable, slightly comedic tone. Natural Korean speech with clear lip sync, soft background music."""

PAYLOAD = {
    "prompt": PROMPT,
    "duration": 15,
    "aspect_ratio": "9:16",
    "resolution": "1080p",
    "generate_audio": True,
}

TERMINAL = {"completed", "failed", "nsfw", "canceled"}


def request(method, url, auth, body=None, extra_headers=None):
    headers = {"Authorization": auth, "Content-Type": "application/json"}
    headers.update(extra_headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read() or b"{}")


def main():
    key_id = os.environ.get("HF_API_KEY_ID")
    key_secret = os.environ.get("HF_API_KEY_SECRET")
    if not key_id or not key_secret:
        sys.exit("HF_API_KEY_ID / HF_API_KEY_SECRET 환경변수를 설정해주세요.")
    auth = f"Key {key_id}:{key_secret}"

    job = request("POST", ENDPOINT, auth, PAYLOAD, {"Idempotency-Key": str(uuid.uuid4())})
    print("submitted:", job.get("request_id"))
    status_url = job["status_url"]

    while True:
        result = request("GET", status_url, auth)
        status = result.get("status")
        print("status:", status)
        if status in TERMINAL:
            break
        time.sleep(10)

    if status != "completed":
        sys.exit(f"생성 실패 ({status}): {json.dumps(result, ensure_ascii=False)}")

    video_url = result["video"]["url"]
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "short.mp4")
    urllib.request.urlretrieve(video_url, out)
    print("saved:", out)
    print("url:", video_url)


if __name__ == "__main__":
    main()
