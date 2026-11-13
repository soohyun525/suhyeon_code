import json, subprocess, os, time, gc, numpy as np, wave, torch, soundfile as sf
from qwen_tts import Qwen3TTSModel
torch.manual_seed(7)
tl=json.load(open('tl3.json')); D='../tts/reel3'; R='../tts/qwen'
os.makedirs(D,exist_ok=True); os.makedirs(R,exist_ok=True)
REF={
 'a':("아 진짜요? 저는 그냥 손으로 적는 게 편하더라고요. 그래야 기억에도 잘 남고요.","A Korean woman in her early thirties. Warm, calm, slightly low-pitched voice. A friendly office worker chatting casually with close coworkers, gentle and a little amused, natural conversational pace."),
 'b':("아, 그거요? 저는 그냥 켜 놓고 해요. 끝나고 정리하면 되니까 너무 편하던데요.","A Korean man in his early thirties. Relaxed, laid-back software developer with a mid-pitched voice. Casual, matter-of-fact and slightly amused, natural conversational pace."),
 'c':("헐, 그게 진짜예요? 와, 나만 몰랐네! 아니 좀 알려주지 그랬어요!","A Korean woman in her late twenties. Bright, high-pitched, energetic and playful voice. Expressive, witty and a bit dramatic, speaking fairly fast like joking with close friends."),
 'n':("이것은 실제로 있었던 일입니다. 그리고 정확히, 이십이 분 뒤.","A Korean male narrator with a deep, low-pitched voice. Dry, deadpan movie-trailer style, deliberate, punchy and confident."),
}
t=time.time()
if not all(os.path.exists(f'{R}/ref_{k}.wav') for k in REF):
    vd=Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
    for k,(txt,ins) in REF.items():
        w,sr=vd.generate_voice_design(text=txt, language="Korean", instruct=ins)
        sf.write(f'{R}/ref_{k}.wav',w[0],sr); print('ref',k,round(len(w[0])/sr,2),round(time.time()-t),flush=True)
    del vd; gc.collect()
base=Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cpu", dtype=torch.float32)
print('base loaded',round(time.time()-t),flush=True)
P={k:base.create_voice_clone_prompt(ref_audio=f'{R}/ref_{k}.wav', ref_text=REF[k][0]) for k in REF}
only=os.environ.get('ONLY','').split(',') if os.environ.get('ONLY') else None
for l in tl['lines']:
    i=l['id']
    if only and i not in only: continue
    if not only and os.path.exists(f'{D}/{i}.wav'): continue
    w,sr=base.generate_voice_clone(text=l['say'], language="Korean", voice_clone_prompt=P[l['who']], non_streaming_mode=True)
    sf.write(f'{D}/{i}_raw.wav',w[0],sr)
    subprocess.run(['ffmpeg','-v','error','-y','-i',f'{D}/{i}_raw.wav','-af','silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse','-ac','1','-ar','44100',f'{D}/{i}.wav'],check=True)
    print(i,l['who'],round(len(w[0])/sr,2),round(time.time()-t),flush=True)
print('DONE',flush=True)
