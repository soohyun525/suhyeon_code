import numpy as np, wave
import json,os,subprocess
TLJ=json.load(open('tl3.json'))
SR=44100; DUR=TLJ['duration']; N=int(SR*DUR); out=np.zeros(N)
rng=np.random.default_rng(7)
def add(sig,t,g=1.0):
    i=int(t*SR); j=min(N,i+len(sig)); out[i:j]+=sig[:j-i]*g
def env(n,a=0.003,d=0.2):
    t=np.arange(n)/SR; return np.minimum(t/a,1)*np.exp(-t/d)
def tone(f,dur,d=0.15,shape='sin'):
    n=int(dur*SR); t=np.arange(n)/SR
    w=np.sin(2*np.pi*f*t) if shape=='sin' else 2*np.abs(2*((f*t)%1)-1)-1
    return w*env(n,d=d)
def pop(f=520):
    n=int(.12*SR); t=np.arange(n)/SR; fr=f*(1+1.2*np.exp(-t/0.02))
    return np.sin(2*np.pi*np.cumsum(fr)/SR)*env(n,d=.035)
def kick():
    n=int(.3*SR); t=np.arange(n)/SR; fr=45+110*np.exp(-t/0.03)
    return np.sin(2*np.pi*np.cumsum(fr)/SR)*env(n,a=.001,d=.11)
def hat(d=.025):
    n=int(.08*SR); x=rng.standard_normal(n); x=np.diff(x,prepend=0); return x*env(n,a=.001,d=d)*.5
def snap():
    n=int(.15*SR); x=rng.standard_normal(n); x=np.diff(x,prepend=0)
    return x*env(n,a=.001,d=.03)*.6+tone(1900,.15,d=.012)*.4
def boom():
    n=int(1.4*SR); t=np.arange(n)/SR; fr=38+90*np.exp(-t/0.06)
    return np.sin(2*np.pi*np.cumsum(fr)/SR)*env(n,a=.001,d=.45)+rng.standard_normal(n)*env(n,a=.001,d=.05)*.3
def whoosh(dur=.3):
    n=int(dur*SR); x=rng.standard_normal(n); k=np.ones(40)/40; x=np.convolve(x,k,'same')*6
    return x*np.sin(np.pi*np.arange(n)/n)**2
def tick(): return tone(2400,.04,d=.006)*.6
# --- beat: 104 BPM, playful pluck riff ---
BPM=104; b=60/BPM
A2,C3,D3,E3,G3,A3,C4,D4,E4,G4,A4=110,130.8,146.8,164.8,196,220,261.6,293.7,329.6,392,440
def groove(t0,t1,riff,bass,drums=True,g=1.0):
    k=0; t=t0
    while t<t1-1e-6:
        s=k%16
        if drums:
            if s in(0,6,10): add(kick(),t,.8*g)
            if s in(4,12): add(snap(),t,.35*g)
            if s%2==0: add(hat(),t,.18*g)
            elif s in(3,11,15): add(hat(.012),t,.1*g)
        if riff[s]: add(tone(riff[s],.3,d=.09,shape='tri'),t,.22*g); add(tone(riff[s]*2,.2,d=.05),t,.07*g)
        if bass[s]: add(tone(bass[s],.4,d=.16,shape='tri')+tone(bass[s]/2,.4,d=.18),t,.3*g)
        t+=b/4; k+=1
happy=[A4,0,0,E4,0,G4,0,0,A4,0,C4,0,D4,0,E4,0]
hbass=[A2,0,0,A2,0,0,C3,0,D3,0,0,D3,0,0,E3,0]
tense=[E4,0,0,0,0,0,E4,0,0,0,0,0,D4,0,0,0]
tbass=[A2,0,0,0,0,0,0,0,A2,0,0,A2,0,0,0,0]
VDIR=os.environ.get('VDIR','../tts/reel3')
have_voice=os.path.isdir(VDIR) and any(f.endswith('.wav') for f in os.listdir(VDIR))
G=.45 if have_voice else 1.0          # duck the beat under voices
moods=['happy','tense','happy','reveal','happy','tense','happy']
ti=0
for s0,e0,typ in TLJ['scenes']:
    if typ=='hook': groove(s0+.5,e0,[0]*16,hbass,drums=False,g=G)
    elif typ=='talk':
        m=moods[ti%len(moods)]; ti+=1
        if m=='happy': groove(s0,e0,happy,hbass,g=G)
        elif m=='tense': groove(s0,e0,tense,tbass,g=.9*G)
        else:
            p=[t for k,t,*_ in TLJ['marks'] if k=='punch' and s0<=t<e0][0]
            groove(s0,p-.3,[0]*16,tbass,drums=False,g=.8*G)
    elif typ in('rule','join'): groove(s0,min(e0,DUR-.4),happy,hbass,g=G)
PG=.3 if have_voice else .55
for m in TLJ['marks']:
    k,t=m[0],m[1]
    if k=='slam': add(boom(),t,.5); add(whoosh(.15),max(0,t-.08),.3)
    elif k=='pop': add(pop({'a':560,'b':440,'c':380}.get(m[2] if len(m)>2 else '',700)),t,PG)
    elif k=='boom': add(boom(),t,.6); add(pop(900),t,.5)
    elif k=='sting': add(whoosh(.22),max(0,t-.12),.4); add(tone(880,.25,d=.08),t,.25); add(tone(1320,.25,d=.08),t+.07,.2)
    elif k=='punch':
        add(boom(),t,1.0); add(tone(98,1.4,d=.6,shape='tri'),t,.5); add(tone(104,1.4,d=.6,shape='tri'),t,.4)
        for d in(.2,.9,1.6): add(tone(1000,.18,d=.05),t+d,.3)
    elif k=='outro': add(whoosh(.3),t-.15,.5); add(tone(880,.6,d=.25),t,.3); add(tone(1109,.6,d=.25),t,.25); add(tone(1319,.8,d=.3),t,.25)
fo=int(.5*SR); out[-fo:]*=np.linspace(1,0,fo)
out=np.tanh(out*1.1); out=out/np.max(np.abs(out))*(.5 if have_voice else .89)
# voices: one wav per line id, placed at the line start
if have_voice:
    for l in TLJ['lines']:
        f=f"{VDIR}/{l['id']}.wav"
        if not os.path.exists(f): continue
        raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-f','s16le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
        v=np.frombuffer(raw,dtype='<i2').astype(float)/32768
        v=v/max(1e-6,np.max(np.abs(v)))*.85
        add(v,l['s'],1.0)
    out=np.clip(out,-1,1)
w=wave.open('audio3.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype('<i2').tobytes()); w.close()
print('voice' if have_voice else 'no voice', DUR)
