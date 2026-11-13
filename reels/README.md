# 언러닝클럽 릴스 제작 도구

HTML 장면을 Playwright로 프레임 단위로 찍고, 합성한 비트·효과음·TTS 음성과 합쳐 1080×1920 MP4를 만든다.

## 폴더

- `build/` — 1편(`reel.html`), 2편(`reel2.html` 카드형, `reel3.html` 캐릭터+TTS형)
- `build4/` — 3편(캐릭터+TTS형, 대사별 그림 카드와 폰 피드 훅). `img/`는 장면에 넣은 참고 이미지
- `tts/qwen/ref_*.wav` — 멤버 A·B·C와 내레이션의 기준 목소리(Qwen3-TTS VoiceDesign으로 생성). 이 파일로 같은 목소리를 계속 복제한다
- `tts/reel3`, `tts/reel4` — 2편, 3편의 대사별 원본 음성

## 준비

```bash
cd reels/build && npm install            # 글꼴(@fontsource)
ln -s ../build/node_modules ../build4/node_modules
pip install torch torchaudio transformers==4.57.3 accelerate==1.12.0 librosa soundfile onnxruntime einops numpy
pip install --no-deps qwen-tts           # sox 의존성은 빌드가 안 되므로 빈 sox.py 모듈을 site-packages에 둔다
```

모델은 Hugging Face(`huggingface.co`, `us.aws.cdn.hf.co`)에서 받는다. `HF_HUB_DISABLE_XET=1`을 켜야 한다.

## 새 편 만들기 (캐릭터+TTS형)

1. `build4/`를 복사하고 `reel3.html`의 `SC` 배열(장면·대사)과 훅·RULE 문구를 바꾼다.
2. `node render.js tl tl3.json` — 타임라인 추출 (`REEL=reel3.html`, `NODE_PATH`에 playwright)
3. `python3 qwen_synth.py` — 대사 음성 합성 (출력 폴더는 스크립트의 `D`)
4. 미니언즈풍: `ffmpeg -i in.wav -af "asetrate=44100*1.45,aresample=44100" out.wav`
5. `./build_variant.sh <음성 폴더> <출력.mp4>` — 음성 길이에 맞춰 타이밍·입 모양을 다시 잡고 렌더링·인코딩

완성 영상(mp4)과 프레임은 용량 때문에 저장소에 넣지 않는다.
