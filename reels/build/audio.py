import numpy as np, wave
SR=44100; DUR=44.4; N=int(SR*DUR); out=np.zeros(N)
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
T=dict(s1=0,s2=3.4,s3=7.8,s3b=11.6,s3c=18.6,s4=23.4,s5=27.6,s6=33.2,s7=37.0,s8=41.4,end=44.4)
groove(.5,T['s2'],[0]*16,hbass,drums=False)
groove(T['s2'],T['s3'],happy,hbass)
groove(T['s3'],T['s3b'],tense,tbass,g=.9)
groove(T['s3b'],T['s3c'],[0]*16,tbass,g=.8)            # 추측 타임: drums+bass only
groove(T['s3c'],T['s4'],tense,tbass,g=.95)
groove(T['s4'],T['s5'],happy,hbass)
groove(T['s5'],T['s5']+3.0,[0]*16,hbass,drums=False,g=.8)
groove(T['s6'],T['s7'],tense,tbass,g=.9)
groove(T['s7'],T['end']-.4,happy,hbass)
def pops(base,lst):
    for t,f in lst: add(pop(f),base+t,.55)
def sting(t): add(whoosh(.22),t-.12,.4); add(tone(880,.25,d=.08),t,.25); add(tone(1320,.25,d=.08),t+.07,.2)
# s1
add(pop(700),.05,.5); add(pop(820),.1,.4)
for t in(.5,.8,1.1): add(boom(),t,.5); add(whoosh(.15),t-.08,.3)
add(pop(700),2.0,.6)
for k in('s2','s3','s3b','s3c','s4','s5','s6'): sting(T[k]+.02)
pops(T['s2'],[(.2,520),(1.0,620),(1.8,520),(2.7,820)])
pops(T['s3'],[(.3,440),(1.1,400),(1.9,360),(2.5,700)])
pops(T['s3b'],[(.25,820),(.7,500),(1.6,560),(2.5,640),(3.2,420),(4.2,380)])
for t in(1.3,2.2): add(whoosh(.25),T['s3b']+t,.45)
add(boom(),T['s3b']+5.2,.75); add(tone(98,1.2,d=.5,shape='tri'),T['s3b']+5.2,.35)
pops(T['s3c'],[(.3,440),(1.1,400),(1.9,360),(2.8,320),(3.4,700)])
pops(T['s4'],[(.3,820),(.6,600),(2.0,620),(2.7,520),(3.3,820)]); add(boom(),T['s4']+1.2,.45)
b5=T['s5']; add(pop(600),b5+.2,.55)
for t in np.arange(b5+.5,b5+2.9,.07): add(tick(),t,.22)
add(tone(1047,.5,d=.2),b5+3.1,.35); add(tone(1319,.5,d=.2),b5+3.2,.35); add(tone(1568,.7,d=.3),b5+3.3,.35)
add(boom(),b5+4.1,1.0); add(tone(98,1.4,d=.6,shape='tri'),b5+4.1,.5); add(tone(104,1.4,d=.6,shape='tri'),b5+4.1,.4)
for i,t in enumerate(np.arange(b5+4.7,b5+5.4,.09)): add(pop(500+40*(i%2)),t,.3)
b6=T['s6']; add(pop(460),b6+.3,.55); add(whoosh(.2),b6+1.0,.5); add(pop(240),b6+1.1,.9); add(tone(1800,.1,d=.02),b6+1.12,.3); add(pop(700),b6+2.0,.5)
b7=T['s7']; add(boom(),b7+.02,.6)
for t in(.9,1.2,1.5): add(pop(560),b7+t,.4)
add(pop(820),b7+2.3,.55)
b8=T['s8']; add(whoosh(.3),b8-.15,.5); add(tone(880,.6,d=.25),b8,.3); add(tone(1109,.6,d=.25),b8,.25); add(tone(1319,.8,d=.3),b8,.25)
# master
fo=int(.5*SR); out[-fo:]*=np.linspace(1,0,fo)
out=np.tanh(out*1.1); out=out/np.max(np.abs(out))*.89
w=wave.open('audio.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype('<i2').tobytes()); w.close()
