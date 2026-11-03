/* All audio is synthesized locally after a trusted gesture. */
window.HauntAudio = (() => {
  let ctx, master, bed, compressor, noise, enabled=true, quiet=false, muted=false, scene='gate';
  const sources=new Set(), ambient=new Set(), clips=new Map(); let created=0, epoch=0;
  try { enabled=JSON.parse(localStorage.getItem('haunt.sound') ?? 'true'); } catch (_) {}
  const ready=()=>ctx?.state==='running' && enabled && !muted && !document.hidden;
  function source(type,freq,duration,volume,delay=0,endFreq=freq,target=master) {
    if(!ready()) return;
    const t=ctx.currentTime+delay, gain=ctx.createGain(); let s,filter;
    if(type==='noise') {s=ctx.createBufferSource();s.buffer=noise;s.loop=true;filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.7;s.connect(filter).connect(gain);}
    else {s=ctx.createOscillator();s.type=type;s.frequency.setValueAtTime(freq,t);s.frequency.exponentialRampToValueAtTime(endFreq,t+duration);s.connect(gain);}
    gain.connect(target);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    sources.add(s);created++;s.onended=()=>{sources.delete(s);s.disconnect();filter?.disconnect();gain.disconnect();};s.start(t);s.stop(t+duration+.02);
  }
  function stopEffects(){epoch++;for(const s of sources) {try{s.stop();}catch(_) {}} sources.clear(); if(bed) bed.gain.setTargetAtTime(quiet?.018:.07,ctx.currentTime,.1);}
  function background(){
    if(!ctx) return;
    for(const s of ambient) {s.stop();s.disconnect();} ambient.clear();
    // 낮은 웅웅거림(저주파)은 운영자가 거슬린다고 해서 뺐다. 배경은 장면마다 음색만 다른 옅은 바람 소리뿐.
    const air={gate:620,hall:520,cave:430,myeongbu:480,sansin:700,lab:560}[scene]||560;
    const wind=ctx.createBufferSource(), filter=ctx.createBiquadFilter();wind.buffer=noise;wind.loop=true;filter.type='bandpass';filter.frequency.value=air;filter.Q.value=.6;wind.connect(filter).connect(bed);wind.onended=()=>filter.disconnect();wind.start();ambient.add(wind);created++;
  }
  function sync(){if(master)master.gain.setTargetAtTime(enabled&&!muted&&!document.hidden?.16:0,ctx.currentTime,.015);if(bed)bed.gain.setTargetAtTime(quiet?.018:.07,ctx.currentTime,.15);}
  async function unlock(e){
    if(e && !e.isTrusted) return;
    if(e?.key==='Escape' || !enabled || document.hidden) return;
    muted=false;
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();master=ctx.createGain();compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-24;compressor.knee.value=18;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.2;master.connect(compressor).connect(ctx.destination);bed=ctx.createGain();bed.connect(master);noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;background();}
    sync();try{await ctx.resume();}catch(_) {}
  }
  document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',()=>{stopEffects();if(document.hidden)ctx?.suspend().catch(()=>{});else if(ctx)unlock();});
  const api={
    async clip(id){
      if(quiet||!ready()||!window.HAUNT_CLIPS?.[id])return;
      stopEffects();const token=epoch;
      try {
        let buffer=clips.get(id);
        if(!buffer){const bytes=Uint8Array.from(atob(window.HAUNT_CLIPS[id]),c=>c.charCodeAt(0));buffer=await ctx.decodeAudioData(bytes.buffer);clips.set(id,buffer);}
        if(token!==epoch||quiet||!ready())return;
        const s=ctx.createBufferSource(),gain=ctx.createGain();s.buffer=buffer;gain.gain.value=.8;s.connect(gain).connect(master);sources.add(s);created++;s.onended=()=>{sources.delete(s);s.disconnect();gain.disconnect();};s.start();
      } catch(error) { console.warn('Embedded clip could not be decoded',id,error.name); }
    },
    configure(value,id){quiet=value;if(id&&id!==scene){scene=id;background();}sync();},
    omen(seconds){if(quiet||!ready())return;bed.gain.setTargetAtTime(.3,ctx.currentTime,seconds/2);for(let t=0;t<seconds;){source('sine',82,.1,.18,t,60);source('sine',76,.08,.12,t+.15,56);t+=.68-.35*(t/seconds);}},
    impact(){if(quiet)return;stopEffects();source('noise',2100,1.2,.65);source('sine',115,1.2,.65,0,28);for(const f of [713,947,1229])source('sawtooth',f,1.2,.075,0,f*.65);},
    ring(){if(!quiet)source('sine',3400,3,.055);},
    small(kind){if(quiet)return;if(kind==='lunge'){source('noise',850,.22,.3);source('sine',100,.26,.4,0,30);}if(['peek','crawler'].includes(kind))source('noise',1500,.22,.16);if(kind==='hand')source('sawtooth',93,.6,.08,0,52);if(kind==='candle')source('noise',2800,.3,.1);},
    stop:stopEffects,
    silence(){muted=true;stopEffects();sync();},
    status:()=>({state:ctx?.state||'locked',created,active:sources.size,enabled,quiet}),
  };
  const button=document.getElementById('sound-button');
  const label=()=>{button.textContent=enabled?'소리 끄기':'소리 켜기';button.setAttribute('aria-pressed',String(enabled));};
  button.onclick=()=>{enabled=!enabled;try{localStorage.setItem('haunt.sound',JSON.stringify(enabled));}catch(_){}if(enabled)unlock();else stopEffects();sync();label();};label();return api;
})();
