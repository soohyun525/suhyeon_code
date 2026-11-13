# usage: python3 mkvoice.py <voice_dir>  -> writes voice3.js (durations + mouth envelopes) for member lines only
import sys, os, json, wave, numpy as np
D=sys.argv[1]; dur={}; env={}
for f in sorted(os.listdir(D)):
    if not f.endswith('.wav') or f.endswith('_raw.wav') or f.startswith('n'): continue
    i=f[:-4]; w=wave.open(f'{D}/{f}'); x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
    dur[i]=round(len(x)/w.getframerate(),3); n=w.getframerate()//30
    fr=[float(np.sqrt(np.mean(x[k:k+n]**2))) for k in range(0,len(x),n)]; m=max(fr) or 1
    env[i]=[round(min(1,(v/m)**.6),2) for v in fr]
open('voice3.js','w').write('window.VOICE='+json.dumps({'dur':dur,'env':env})+';')
print(len(dur),'lines',round(sum(dur.values()),1),'s')
