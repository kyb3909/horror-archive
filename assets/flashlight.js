/* Lighting and visit-local traps, driven by the director's single RAF/active effect. */
window.createStageTraps = function ({stage, layer, gentle, level, busy, claim}) {
  const params = new URLSearchParams(location.search), forced = params.get('trap');
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const requirements = {lunge:['face_01','face_02','face_03'],peek:['peeker'],hand:['hand'],crawler:['crawler'],turn:['sitter-back','sitter-turned'],afterimage:['watcher']};
  const kinds=['lunge','peek','hand','eyes','crawler','turn','afterimage','candle','talisman','dud'];
  const loaded = new Set();
  for (const name of new Set(Object.values(requirements).flat())) {
    const image = new Image(); image.onload = () => loaded.add(name); image.src = `assets/img/ghosts/${name}.webp`;
  }
  const art = document.createElement('img'); art.className='scene-art lit-art'; art.alt=''; art.setAttribute('aria-hidden','true'); stage.prepend(art);
  const placeholder = document.createElement('div'); placeholder.className='lit-placeholder'; stage.prepend(placeholder);
  stage.classList.add('flashlight-stage');
  let scene, traps=[], candles=[], input=null, beam=null, release=0, touch=false, down=false, rect;
  let lighting={candle:1,beam:1};
  let last=0, lastPaint=0, nextTrap=0, lunges=0, visitor=[768,900,200];
  const observer=new ResizeObserver(()=>{rect=stage.getBoundingClientRect();}); observer.observe(stage);
  function pointer(e) {
    if(e.pointerType==='mouse') touch=false;
    if(e.pointerType!=='mouse' && !down) return;
    input={x:e.clientX,y:e.clientY}; release=Infinity;
  }
  stage.addEventListener('pointerdown',e=>{down=true; touch=e.pointerType!=='mouse'; rect=stage.getBoundingClientRect(); pointer(e); if(touch) stage.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',pointer);
  function up() { if(touch && down) release=performance.now()+3000; down=false; }
  stage.addEventListener('pointerup',up);
  stage.addEventListener('pointercancel',()=>{down=false;release=performance.now();});
  stage.addEventListener('pointerleave',()=>{if(!touch) release=performance.now();});
  stage.addEventListener('pointerenter',()=>{rect=stage.getBoundingClientRect();});
  window.addEventListener('scroll',()=>{rect=stage.getBoundingClientRect();},{passive:true});
  document.addEventListener('focusin',e=>{
    const exit=e.target.closest('[data-exit]');
    if(!exit || !scene) return;
    const r=scene.exits[Number(exit.dataset.exit)]?.rect;
    if(r) {input={point:[r[0]+r[2]/2,r[1]+r[3]/2]};release=Infinity;}
  });
  document.addEventListener('focusout',e=>{if(e.target.closest('[data-exit]')) release=performance.now();});
  function allowed(kind) {
    if(!kinds.includes(kind)) return false;
    if(level()==='off') return false;
    if(gentle() && !['eyes','candle','talisman','dud'].includes(kind)) return false;
    if(level()==='low' && !['eyes','candle','talisman','peek','afterimage','dud'].includes(kind)) return false;
    return !requirements[kind] || requirements[kind].every(n=>loaded.has(n));
  }
  function arm() {
    traps=(scene?.traps||[]).map(p=>({...p,armed:!!forced || Math.random()<(level()==='high'?.8:.65),kind:null,uses:0,repeat:Math.random()<.3,inside:false,dwell:0,left:true,turn:0}));
    lunges=0; nextTrap=0;
  }
  function gradient(x,y,r,alpha) {
    return `radial-gradient(circle ${r.toFixed(2)}px at ${(x/15.36).toFixed(2)}% ${(y/10.24).toFixed(2)}%,rgba(0,0,0,${alpha.toFixed(3)}) 0%,rgba(0,0,0,${(alpha*.8).toFixed(3)}) 28%,transparent 100%)`;
  }
  function paint(now) {
    rect ||= stage.getBoundingClientRect();
    const scale=rect.width/1536, mild=gentle() || level()==='off';
    if(input) {
      const p=input.point||[(input.x-rect.left)/scale,(input.y-rect.top)/scale];
      const strength=clamp(1-(now-release)/900,0,1);
      beam=strength>0 ? [p[0]+(mild?0:Math.sin(now*.009)*1.4),p[1]+(mild?0:Math.cos(now*.007)*1.2),strength] : null;
    } else beam=null;
    // Limit mask rasterization to 30Hz; pointer events only record the latest input.
    if(now-lastPaint<32) return; lastPaint=now;
    const masks=[];
    if(beam) masks.push(gradient(beam[0],beam[1],107.52*scale*beam[2],.9*beam[2]*lighting.beam));
    // 방문자 촛불: 원근에 맞춰 키(h)에 비례하는 넓은 빛. 안쪽 빛 + 바깥 은은한 빛, 불꽃처럼 반지름이 흔들린다.
    const [vx,vy,vh]=visitor, flame=mild?1:1+Math.sin(now*.013)*.045+Math.sin(now*.037)*.03;
    masks.push(gradient(vx+vh*.13,vy-vh*.5,vh*2.6*flame*scale*lighting.candle,(mild?.22:.3)*lighting.candle));
    masks.push(gradient(vx+vh*.13,vy-vh*.5,vh*1.25*flame*scale*lighting.candle,(mild?.6:.88*flame)*lighting.candle));
    candles.forEach((c,i)=>{
      const flicker=mild?1:.88+Math.sin(now*.007+i*2)*.12;
      masks.push(gradient(c.x,c.y,(c.flare?30:18)*scale,c.value*.42*flicker));
    });
    const mask=masks.join(',');
    stage.style.setProperty('--cast-light',mask+',linear-gradient(rgba(0,0,0,.035),rgba(0,0,0,.035))');
    stage.style.setProperty('--cast-beam',mask);
    for(const el of [art,placeholder]) {el.style.maskImage=mask;el.style.webkitMaskImage=mask;}
    stage.classList.toggle('soft-light',mild);
  }
  function element(kind,p) {
    const el=document.createElement('div'); el.className=`trap trap-${kind}`;
    el.style.left=`${p.x/15.36}%`;el.style.top=`${p.y/10.24}%`;
    el.style.setProperty('--side',p.x>768?-1:1);
    el.dataset.trap=kind;
    if(gentle()) el.classList.add('trap-soft');
    layer.append(el);return el;
  }
  function picture(el,name) { const im=new Image(); im.alt='';im.src=`assets/img/ghosts/${name}.webp`;el.append(im); }
  function trigger(p,kind,now) {
    if(!allowed(kind)) return false;
    if(kind==='lunge' && lunges>=(level()==='high'?5:3)) return false;
    const el=element(kind,p), nodes=[el];
    window.HauntAudio?.small(kind);
    const slow=gentle(), duration=slow?5000:({lunge:340,peek:300,hand:1250,eyes:3000,crawler:500,turn:Infinity,afterimage:500,candle:2000,talisman:2100,dud:1}[kind]);
    if(kind==='lunge') {lunges++;picture(el,pick(requirements.lunge));el.style.width=`${25+Math.random()*15}%`;}
    if(kind==='peek') picture(el,'peeker');
    if(kind==='hand' || kind==='crawler') picture(el,kind);
    if(kind==='turn') {p.turn++; if(p.turn<3) picture(el,p.turn===1?'sitter-back':'sitter-turned');}
    if(kind==='afterimage') picture(el,'watcher');
    if(kind==='talisman') el.innerHTML='<span aria-hidden="true">╳<br>┼<br>⋈</span>';
    const candle=kind==='candle' ? candles.reduce((best,c)=>!best||Math.hypot(c.x-p.x,c.y-p.y)<Math.hypot(best.x-p.x,best.y-p.y)?c:best,null) : null;
    const keep=kind==='candle' && !slow && Math.random()<.3;
    let angle=Math.atan2(p.y-(beam?.[1]||p.y-1),p.x-(beam?.[0]||p.x));
    const a={type:'trap',kind,start:now,duration,nodes,
      update(t) {
        const u=clamp(t/duration,0,1), fade=Math.sin(Math.PI*u);
        el.style.opacity=slow?fade*.45:1;
        if(kind==='lunge') {el.style.transform=`translate(-50%,-50%) scale(${.18+.82*Math.min(1,t/90)}) translate(${t>90?Math.sin(Math.floor(t/33)*17)*1.2:0}%,${t>90?Math.cos(Math.floor(t/33)*13)*1.2:0}%)`;el.style.opacity=1;}
        if(kind==='peek') {el.style.clipPath='inset(0 0 0 45%)';el.style.transform=`translate(calc(-50% + ${(p.x>768?-1:1)*Math.min(1,t/150)*65}%),-50%) scaleX(${p.x>768?-1:1})`;el.style.opacity=Math.max(0,1-t/150);}
        if(kind==='hand') {el.style.transform=`translate(-50%,${t<600?-50-25*Math.min(1,t/300):-75+65*(t-600)/650}%)`;el.style.opacity=Math.min(1,t/150,(duration-t)/250);}
        if(kind==='crawler') {el.style.transform=`translate(${ -50+(p.x>768?1:-1)*u*220}% ,${-50-u*80}%)`;el.style.opacity=1-u;}
        if(kind==='eyes') {
          if(beam) {
            const radius=130;
            let x,y;
            for(let i=0;i<16;i++) {
              x=beam[0]+Math.cos(angle)*radius;y=beam[1]+Math.sin(angle)*radius;
              if(x>22&&x<1514&&y>18&&y<1006) break;
              angle+=Math.PI/8;
            }
            el.style.left=`${x/15.36}%`;el.style.top=`${y/10.24}%`;
          }
          el.style.opacity=fade*(slow?.35:.7);
        }
        if(kind==='afterimage') el.style.opacity=(1-u)*.16;
        if(kind==='turn') {
          el.style.opacity=p.turn===3?0:.55*Math.min(1,t/180);
          if(p.turn===3 || !beam || Math.hypot(beam[0]-p.x,beam[1]-p.y)>75) a.duration=t;
        }
        if(candle) {candle.flare=!slow&&t<350;candle.value=slow?1-fade: t<350?1: t<1300?0:keep?0:(t-1300)/700;}
        if(kind==='talisman' && !slow) el.style.transform=`translate(-50%,${-180+u*200}%) rotate(${Math.sin(u*7)*12}deg)`;
      },
      cleanup() {if(candle) {candle.flare=false;candle.value=keep?0:1;} nextTrap=performance.now()+(level()==='high'?1500:2500);}
    };
    claim(a);p.uses++;p.left=false;p.dwell=0;
    if(kind==='turn') p.armed=p.turn<3;
    else p.armed=p.repeat && p.uses<2;
    p.previous=kind;p.kind=null;
    return true;
  }
  function tick(now,pos,phase) {
    visitor=pos;paint(now);
    const dt=Math.min(80,now-(last||now));last=now;
    const suspended=phase==='transition'||document.querySelector('dialog[open]')||level()==='off';
    if(suspended) {traps.forEach(p=>{p.dwell=0;p.ready=false;});return;}
    for(const p of traps) {
      const inside=!!beam && beam[2]>.4 && Math.hypot(beam[0]-p.x,beam[1]-p.y)<75*beam[2];
      const departed=p.inside&&!inside;
      if(!inside) {p.left=true;p.dwell=0;}
      if(!p.kind && p.armed) {
        const choices=(forced?[forced]:p.reactions).filter(k=>allowed(k)&& (p.turn>0?k==='turn':k!==p.previous) && (k!=='lunge'||lunges<(level()==='high'?5:3)));
        if(p.turn>0 && allowed('turn')) p.kind='turn'; else if(choices.length) p.kind=pick(choices);
      }
      if(inside && p.left) p.dwell+=dt;
      const close=p.walk && phase==='walking' && p.uses===0 && Math.hypot(pos[0]-p.x,pos[1]-p.y)<90;
      if(!suspended && !busy() && now>=nextTrap && p.armed && p.kind) {
        if(p.kind==='afterimage') {if(departed && p.ready) {trigger(p,p.kind,now);p.ready=false;} else if(p.dwell>=350) p.ready=true;}
        else if((p.dwell>=350 && p.left)||close) trigger(p,p.kind,now);
      }
      p.inside=inside;
    }
  }
  return {tick,
    lighting(candle=1,beam=1) {lighting={candle,beam};stage.style.setProperty("--candle-life",candle);},
    beam:()=>beam,
    scene(value) {
      scene=value;input=null;beam=null;down=false;last=0;lastPaint=0;
      art.hidden=true;art.onload=()=>{art.hidden=false;};art.onerror=()=>{art.hidden=true;};
      if(scene.image) art.src=`assets/img/${scene.image}`;else art.removeAttribute('src');
      candles=(scene.spots.candles||[]).map(([x,y])=>({x,y,value:1,flare:false}));arm();
      stage.querySelector('.trap-debug')?.remove();
      if(params.get('debug')==='1') {
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1536 1024');svg.setAttribute('aria-hidden','true');svg.classList.add('haunt-debug','trap-debug');
        svg.innerHTML=traps.map((p,i)=>`<g stroke="#b78aff"><circle cx="${p.x}" cy="${p.y}" r="35"/><text fill="#b78aff" x="${p.x}" y="${p.y-40}">T${i+1} ${p.label}</text></g>`).join('');stage.append(svg);
      }
    },
    reset() {
      candles.forEach(c=>{c.value=1;c.flare=false;});
      // Changing accessibility/intensity settings must not replenish this visit.
      traps.forEach(p=>{p.kind=null;p.dwell=0;p.ready=false;});
    },
    cancel() {input=null;beam=null;traps.forEach(p=>{p.dwell=0;p.ready=false;p.inside=false;});nextTrap=performance.now()+2500;},
    candles(value) {candles.forEach(c=>{c.value=value;});}
  };
};
