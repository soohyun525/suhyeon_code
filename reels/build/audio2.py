import numpy as np, wave
SR=44100; DUR=47.4; N=int(SR*DUR); out=np.zeros(N)
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
T=dict(s1=0,s2=3.6,s4=8.4,s5=13.0,s6=17.4,s7=23.2,s8=28.4,s9=33.6,s10=39.8,s11=44.4,end=47.4)
groove(.5,T['s2'],[0]*16,hbass,drums=False)
groove(T['s2'],T['s4'],happy,hbass)
groove(T['s4'],T['s5'],tense,tbass,g=.9)
groove(T['s5'],T['s6'],happy,hbass)
groove(T['s6'],T['s6']+3.0,[0]*16,tbass,drums=False,g=.8)
groove(T['s7'],T['s8'],happy,hbass)
groove(T['s8'],T['s9'],tense,tbass,g=.9)
groove(T['s9'],T['s10'],[0]*16,hbass,g=.9)
groove(T['s10'],T['end']-.4,happy,hbass)
def pops(base,lst):
    for t,f in lst: add(pop(f),base+t,.55)
def sting(t): add(whoosh(.22),t-.12,.4); add(tone(880,.25,d=.08),t,.25); add(tone(1320,.25,d=.08),t+.07,.2)
add(pop(700),.05,.5); add(pop(820),.1,.4)
for t in(.5,.8,1.1): add(boom(),t,.5); add(whoosh(.15),t-.08,.3)
add(pop(700),2.0,.6)
for k in('s2','s4','s5','s6','s7','s8','s9'): sting(T[k]+.02)
pops(T['s2'],[(.3,460),(1.5,820),(2.2,560),(3.3,820)])
pops(T['s4'],[(.3,440),(1.3,520),(2.2,380),(3.1,700)])
pops(T['s5'],[(.3,520),(1.1,440),(1.9,620),(2.6,480)])
b=T['s6']; pops(b,[(.3,420),(1.7,400),(2.4,560)])
add(boom(),b+3.2,1.0); add(tone(98,1.4,d=.6,shape='tri'),b+3.2,.5); add(tone(104,1.4,d=.6,shape='tri'),b+3.2,.4)
for t in(3.4,4.1,4.8): add(tone(1000,.18,d=.05),b+t,.3)                     # REC beep
for i,t in enumerate(np.arange(b+3.9,b+4.6,.09)): add(pop(500+40*(i%2)),t,.3)
b=T['s7']; pops(b,[(.3,420),(2.4,420),(3.4,360)]); add(boom(),b+1.4,.7); add(pop(900),b+1.4,.6)
pops(T['s8'],[(.3,520),(1.4,400),(2.4,360),(3.3,330)])
pops(T['s9'],[(.3,420),(1.1,560),(2.0,380),(2.9,420),(3.9,360)])
b=T['s10']; add(boom(),b+.02,.6)
for t in(.9,1.3): add(pop(560),b+t,.45)
add(pop(820),b+2.3,.55)
b=T['s11']; add(whoosh(.3),b-.15,.5); add(tone(880,.6,d=.25),b,.3); add(tone(1109,.6,d=.25),b,.25); add(tone(1319,.8,d=.3),b,.25)
# master
fo=int(.5*SR); out[-fo:]*=np.linspace(1,0,fo)
out=np.tanh(out*1.1); out=out/np.max(np.abs(out))*.89
w=wave.open('audio2.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype('<i2').tobytes()); w.close()
