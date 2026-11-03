/* 원본 좌표를 사용하는 연출 감독. 모든 연출 시간은 단일 RAF에서 관리한다. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), stage = $('stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const read = (store,key,fallback) => { try { return JSON.parse(store.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
  const save = (store,key,value) => { try { store.setItem(key,JSON.stringify(value)); } catch (_) {} };
  const settings = read(localStorage,'haunt.settings',{});
  let level = ['off','low','medium','high'].includes(settings.level) ? settings.level : 'medium';
  let soft = settings.soft === true;
  let noBugs = settings.noBugs ?? soft;
  const saved = read(sessionStorage,'haunt.session',{});
  const session = {start:Date.now(),moves:0,jumps:0,shadow:false,map:false,seen:[],steps:{},...saved};
  if (!Array.isArray(session.seen)) session.seen = [];
  if (!session.steps || typeof session.steps !== 'object') session.steps = {};
  session.visits ||= {}; session.visions ||= {}; session.castSteps ||= {};
  const persist = () => save(sessionStorage,'haunt.session',session);
  let reading = false;
  const gentle = () => soft || reduced.matches;
  const random = (a,b) => a + Math.random()*(b-a);
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const layer = document.createElement('div'); layer.className = 'haunt-layer'; layer.setAttribute('aria-hidden','true'); stage.append(layer);
  const shadow = document.createElement('div'); shadow.className = 'visitor-shadow'; layer.append(shadow);
  let sceneId, spots = {}, pos = [0,0,200], gaze = null, phase = 'idle', active = null;
  let recent = [], route = [], walked = false, printsUsed = false, permanent = [], raf = 0, next = 0, cooldown = 0;
  const params = new URLSearchParams(location.search), debugType = params.get('haunt');
  const cast=window.HAUNT_CAST, manifest=window.HAUNT_ART;
  const bugs=window.createStageBugs(stage);
  const castLayer=document.createElement('div');castLayer.className='cast-layer';layer.append(castLayer);
  let bugBudget=0, bugNext=0, visionSince=0, visionSpot=-1, castDebugDone=false;
  const delivered=cast.creatures.filter(d=>manifest.creatures.includes(d.id));
  // Resolve delivered vision filenames by catalog aliases; unknown new names remain disabled.
  const visions=manifest.visions.flatMap(id=>{const d=cast.visions.find(v=>v.id===id||v.aliases.some(a=>id.toLowerCase().includes(a)));return d?[{...d,id,path:`assets/img/visions/${id}.webp`}]:[];});
  const traps = window.createStageTraps({stage,layer,gentle,level:()=>level,busy:()=>!!active,claim:a=>{active=a;layer.dataset.effect=`trap-${a.kind}`;}});
  let debugDue = performance.now()+2000, debugDone = !debugType;
  function at(el,x,y,w,h) { Object.assign(el.style,{left:`${x/15.36}%`,top:`${y/10.24}%`,width:`${w/15.36}%`,height:`${h/10.24}%`}); }
  function ghost(kind,x,y,h) {
    const el = document.createElement('div'); el.className = 'haunt-ghost'; at(el,x,y,h*.48,h);
    el.innerHTML = '<span class="ghost-fallback"></span>';
    const im = new Image(); im.alt = ''; im.onload = () => { el.classList.add('loaded'); }; im.src = `assets/img/ghosts/${kind}.webp`; el.append(im); layer.append(el); return el;
  }
  function node(cls) { const el = document.createElement('div'); el.className = cls; layer.append(el); return el; }
  function plan() { next = performance.now()+6000+random(7000,18000)*(level==='high'?.7:1); }
  function finish() {
    const hadEffect=!!active;
    if (active) { active.cleanup?.(); active.nodes.forEach(n=>n.remove()); active.resolve?.(); active=null; delete layer.dataset.effect; }
    if (hadEffect) cooldown=performance.now()+6000;
    plan(); updateShadow();
  }
  function cancel() { finish(); bugs.clear(); visionSince=0; traps.cancel(); phase='idle'; route=[]; walked=false; }
  function allowed(type,force=false) {
    if (reading || (!force&&level==='off')) return false;
    if (gentle()) return ['eyes','candles','creature','vision','bug'].includes(type);
    if (force) return true;
    if (['eyes','candles','pass','creature','anim','vision','bug'].includes(type)) return true;
    return level!=='low' && (type!=='map' || level==='high');
  }
  function available(type) {
    if(type==='creature')return delivered.some(d=>d.places.includes(sceneId));
    if(type==='anim')return cast.anims.some(d=>d.places.includes(sceneId)&&!(d.behavior==='rush'&&(gentle()||level==='low')));
    if(type==='bug')return !noBugs&&bugBudget>0;
    if(type==='map') return true; // ?? ??? ??? ???.
    if (['pass','watch','eyes','candles'].includes(type)) return !!spots[type]?.length;
    // 임시 무대는 눈/촛불만. 그림자는 방문자 기본 장식으로만 남는다.
    return !!WORLD.scenes[sceneId]?.image;
  }
  function start(type,force=false) {
    if(type==='jump') return beginJump(force,'scene');
    if(['creature','anim','vision'].includes(type))return startCast(type,null,force);
    if(type==='bug')return startBug(null,force);
    if (document.hidden || active || !allowed(type,force) || (!force && performance.now()<cooldown)) return false;
    if (!available(type) && !(force && ['footprints','shadow','jump','map'].includes(type))) return false;
    const a = {type,start:performance.now(),nodes:[],duration:0}; active=a;
    recent=[...recent.slice(-1),type]; layer.dataset.effect=type;
    if (type==='pass') {
      const p=pick(spots.pass), reverse=Math.random()<.5; a.from=reverse?p.to:p.from; a.to=reverse?p.from:p.to; a.h=p.h;
      a.nodes=[ghost('walker',...a.from,p.h)]; a.nodes[0].style.setProperty('--flip',a.to[0]<a.from[0]?-1:1);
      a.opacity=random(.35,.6); a.duration=random(1200,2000);
    } else if (type==='watch') {
      a.step=Math.max(0,Math.min(spots.watch.length-1,Number(session.steps[sceneId])||0)); a.point=spots.watch[a.step];
      a.nodes=[ghost('watcher',...a.point)]; a.duration=15000;
    } else if (type==='eyes') {
      const [x,y]=pick(spots.eyes); const el=node('haunt-eyes'); at(el,x,y,18,4); a.nodes=[el]; a.duration=gentle()?6000:1400;
    } else if (type==='candles') {
      const el=node('haunt-candles'); at(el,...pick(spots.candles)); a.nodes=[el]; a.duration=gentle()?7500:2700; a.keep=!gentle() && Math.random()<.2; a.cleanup=()=>traps.candles(a.keep?0:1);
    } else if (type==='footprints') {
      if (printsUsed && !force) { active=null; return false; }
      printsUsed=true;
      const path=route.length>1?route:[[pos[0]-90,pos[1]+40,pos[2]],[pos[0]-60,pos[1]+25,pos[2]],[pos[0]-30,pos[1]+10,pos[2]]];
      a.nodes=path.slice(0,-1).filter((_,i)=>i%2===0).slice(-12).map((p,i)=>{
        const el=node('haunt-print'); at(el,p[0]+(i%2?9:-9),p[1],p[2]*.09,p[2]*.035);
        el.innerHTML='<svg viewBox="0 0 30 12"><ellipse cx="15" cy="6" rx="14" ry="5" fill="#010303"/></svg>'; return el;
      }); a.duration=6000+Math.max(0,a.nodes.length-1)*180;
    } else if (type==='shadow') {
      if (session.shadow && !force) { active=null; return false; }
      session.shadow=true; persist(); a.point=[...pos]; a.duration=1500;
    } else if (type==='map') {
      session.map=true; persist(); $('mandala').close();
      const black=node('haunt-map-black'); const g=ghost('watcher',768,920,790); g.classList.add('map-watcher'); a.nodes=[black,g]; a.duration=2000;
      document.querySelectorAll('[data-unknown-candle]').forEach(n=>n.remove());
    } else { active=null; return false; }
    return true;
  }
  function startBug(id,force=false) {
    if(reading||noBugs||(!force&&(level==='off'||bugBudget<=0||bugs.busy())))return false;
    const candidates=cast.bugs.filter(d=>d.places.includes(sceneId)&&!d.id.startsWith('centipede-')).map(d=>d.id);
    if(cast.bugs[0].places.includes(sceneId))candidates.push('centipede');
    const result=bugs.start(id||pick(candidates),pos,sceneId,gentle(),gaze);
    if(result){bugBudget=Math.max(0,bugBudget-1);bugNext=performance.now()+22000;plan();}return result;
  }
  function startCast(type,id,force=false) {
    if(!sceneId||reading||document.hidden||!allowed(type,force)||(!force&&(active||performance.now()<cooldown)))return false;
    const source=type==='creature'?delivered:type==='anim'?cast.anims:visions;
    let choices=source.filter(d=>(force||d.places.includes(sceneId))&&d.id!==session.lastCast);
    const d=id?source.find(d=>d.id===id):pick(choices.length?choices:source.filter(d=>d.places.includes(sceneId)));
    if(!d||(d.behavior==='rush'&&(gentle()||(!force&&level==='low'))))return false;
    if(type==='anim'&&gentle())return false;
    finish();bugs.clear();
    const scene=WORLD.scenes[sceneId], places=spots.watch||[[1250,650,180]];
    const step=type==='creature'?Math.min(places.length-1,d.id==='backwards-bride'?(session.visits[sceneId]||1)-1:session.castSteps[d.id]||0):0;
    let point=[...places[step]];
    if(type==='anim')point=[...(scene.castSpots[d.behavior==='rush'?'pass':d.behavior]||scene.castSpots.corner)];
    if(d.id==='water-ghost')point=[...scene.castSpots.hole];
    if(d.id==='jeoseungsaja')point=[...places[0]];
    if(d.id==='wax-mourner'&&sceneId==='hall')point=[410,690,150];
    if(d.id==='jar-head')point=[300,780,145];
    const h=type==='creature'?d.height*(point[2]/180):point[2];point[2]=h;
    const el=new Image();el.alt='';el.className=type==='vision'?'cast-vision':'cast-sprite';el.dataset.cast=d.id;
    const a={type,data:d,force,start:performance.now(),duration:gentle()?6000:d.duration,nodes:[el],point,base:[...point],step,origin:[...pos],lit:0,last:performance.now()};
    a.ratio=.7;el.onload=()=>{a.ratio=el.naturalWidth/el.naturalHeight;if(type!=='vision')at(el,point[0],point[1],h*a.ratio,h);};
    el.onerror=()=>{if(active===a)finish();};
    el.src=d.path+(type==='anim'?`?t=${Date.now()}`:'');
    if(type==='vision') {
      a.duration=gentle()?3600:random(900,1300);session.visions[sceneId]=true;persist();
      el.classList.toggle('soft-vision',gentle()); layer.append(el);sound.ring();
    } else {castLayer.append(el);at(el,point[0],point[1],h*(type==='anim'&&['walker','crawler'].includes(d.id)?884/480:.7),h);}
    // This polygon excludes the sacred rectangle regardless of sprite growth/translation.
    if(scene.sacredRect) {
      const [x,y,w,h]=scene.sacredRect,poly=`polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${x/15.36}% ${y/10.24}%,${x/15.36}% ${(y+h)/10.24}%,${(x+w)/15.36}% ${(y+h)/10.24}%,${(x+w)/15.36}% ${y/10.24}%,${x/15.36}% ${y/10.24}%)`;
      castLayer.style.clipPath=poly;if(type==='vision')el.style.clipPath=poly;
    } else castLayer.style.clipPath='';
    active=a;layer.dataset.effect=type;session.lastCast=d.id;persist();return true;
  }
  function updateCast(a,t,now) {
    const el=a.nodes[0],d=a.data,dt=Math.min(80,now-a.last);a.last=now;
    if(a.type==='vision') {
      // Two dim pulses across the whole exposure, no white frame or rapid flashing.
      const u=t/a.duration;el.style.opacity=gentle()?Math.sin(Math.PI*Math.min(1,u))*.6:(.38+.2*Math.sin(Math.PI*4*u))*Math.min(1,u*8,(1-u)*8);return;
    }
    if(a.type==='anim') {
      el.style.opacity=.85*Math.min(1,t/450,(a.duration-t)/450);
      if(d.id==='crawler'&&sceneId==='cave'){el.style.transform='scaleY(-1)';el.style.transformOrigin='center center';}
      return;
    }
    const [x,y,h]=a.point;
    const dist=gaze?Math.hypot(gaze[0]-x,gaze[1]-(y-h*.55)):Infinity;
    const lit=dist<75*(gaze?.[2]||0);
    if(lit)a.lit+=dt;else a.lit=0;
    let scale=1,angle=0;
    if(d.behavior==='grow'&&!gentle()&&(a.force||['medium','high'].includes(level))) {
      scale=1+a.lit/900;
      if(a.lit>2000) {
        if(!a.dark){a.dark=node('cast-dark');a.nodes.push(a.dark);a.duration=Math.min(a.duration,t+1000);}
        a.dark.style.opacity=Math.min(.97,(a.lit-2000)/600);
      }
    } else if(lit&&!a.flee) {a.flee=now;}
    if(d.behavior==='follow'&&!gentle()) {
      // Follow the visitor's displacement slowly, preserving the initial offset.
      a.point[0]+=(a.base[0]+pos[0]-a.origin[0]-a.point[0])*dt/1600;
      a.point[1]+=(a.base[1]+pos[1]-a.origin[1]-a.point[1])*dt/1600;
    }
    if(d.behavior==='tilt') {if(dist>220)a.turned=true;if(a.turned)angle=5;}
    if(d.behavior==='spiral'&&!gentle()&&dist<170)scale=1+Math.min(.35,t/22000);
    if(['gaze','eye'].includes(d.behavior)&&gaze)angle=Math.max(-3,Math.min(3,(gaze[0]-x)/100));
    const fade=a.flee?Math.max(0,1-(now-a.flee)/(gentle()?900:d.behavior==='sink'?400:65)):Math.min(1,t/(gentle()?1800:1600),(a.duration-t)/1200);
    el.style.opacity=.72*fade;
    el.style.filter=['reveal','wick'].includes(d.behavior)?`brightness(${.45+.55*Math.min(1,t/4500)})`:'';
    at(el,a.point[0],a.point[1]+(a.flee&&d.behavior==='sink'?(now-a.flee)*.06:0),h*a.ratio,h);
    el.style.transform=`scale(${scale}) rotate(${angle}deg)`;
    if(a.flee&&fade===0){session.castSteps[d.id]=Math.max(0,a.step-1);persist();finish();}
    else if(t>=a.duration){session.castSteps[d.id]=Math.min((spots.watch?.length||3)-1,a.step+1);persist();}
  }
  function castCandidates(now) {
    if(!sceneId)return;
    if(!castDebugDone&&now>=debugDue) {
      castDebugDone=true;
      for(const [key,type] of [['creature','creature'],['anim','anim'],['vision','vision'],['bug','bug'],['jump','jump']])if(params.has(key)) {
        if(type==='jump')beginJump(true,'debug');else if(type==='bug')startBug(params.get(key),true);else startCast(type,params.get(key),true);
        break;
      }
    }
    if(active||phase!=='idle'||level==='off'||!$('haunt-settings').hidden||$('mandala').open){visionSince=0;return;}
    if(!session.visions[sceneId]&&visions.some(d=>d.places.includes(sceneId))) {
      const index=(WORLD.scenes[sceneId].visions||[]).findIndex(p=>gaze&&Math.hypot(p[0]-gaze[0],p[1]-gaze[1])<65*gaze[2]);
      if(index<0){visionSince=0;visionSpot=-1;}else if(index!==visionSpot||!visionSince){visionSpot=index;visionSince=now;}else if(now-visionSince>1500){startCast('vision');visionSince=0;}
    }
    if(!active&&bugBudget>0&&now>bugNext&&!bugs.busy())startBug();
  }
  function updateShadow() {
    const p=active?.type==='shadow'?active.point:pos;
    at(shadow,p[0],p[1],p[2]*.7,p[2]*.13);
  }
  function scared() {
    if (active?.type!=='watch' || active.flee) return;
    const [x,y,h]=active.point;
    if ((gaze && Math.hypot(gaze[0]-x,gaze[1]-(y-h*.55))<107.52*gaze[2]) || Math.hypot(pos[0]-x,pos[1]-y)<Math.max(105,h*.8)) {
      session.steps[sceneId]=Math.max(0,active.step-1); persist(); active.flee=performance.now(); active.fleeOpacity=Number(active.nodes[0].style.opacity)||0;
    }
  }
  function weighted(types) {
    const weights={eyes:2,candles:2,creature:6,anim:5,bug:2};
    const eligible=types.filter(t=>available(t)&&allowed(t));
    // ? ???? ???/?? ??? ??? ??? ??? ????.
    const excluded=recent.slice(-Math.min(2,Math.max(1,eligible.length-1)));
    const choices=eligible.filter(t=>!excluded.includes(t));
    const bag=choices.flatMap(t=>Array(weights[t]||1).fill(t)); return bag.length?pick(bag):null;
  }
  function tick(now) {
    raf=0; if (document.hidden) return;
    const visionTarget=!session.visions[sceneId]&&visions.some(d=>d.places.includes(sceneId))&&(WORLD.scenes[sceneId]?.visions||[]).some(p=>gaze&&Math.hypot(p[0]-gaze[0],p[1]-gaze[1])<80*gaze[2]);
    traps.tick(now,pos,reading||visionTarget ? 'transition' : phase); gaze=traps.beam();
    if (reading) { raf=requestAnimationFrame(tick); return; }
    bugs.tick(now,gaze,pos);
    castCandidates(now);
    if(!visionTarget&&!visionSince)candidates(now);
    if (!debugDone && now>=debugDue && sceneId) { debugDone=true; start(debugType,true); }
    if (active) {
      const a=active,t=now-a.start,u=t/a.duration,el=a.nodes[0];
      if (a.type==='trap') a.update(t);
      if (['creature','anim','vision'].includes(a.type)) updateCast(a,t,now);
      if (a.type==='pass') { at(el,a.from[0]+(a.to[0]-a.from[0])*u,a.from[1]+(a.to[1]-a.from[1])*u,a.h*.48,a.h); el.style.opacity=a.opacity*Math.min(1,u*8,(1-u)*8); }
      if (a.type==='watch') {
        scared();
        el.style.opacity=a.flee ? a.fleeOpacity*Math.max(0,1-(now-a.flee)/60) : .5*Math.min(1,t/3000,(15000-t)/3000);
        if (a.flee && now-a.flee>=60) { finish(); }
        else if (t>=15000) { session.steps[sceneId]=Math.min(spots.watch.length-1,a.step+1); persist(); }
      }
      if (a.type==='eyes') el.style.opacity=gentle()?Math.sin(Math.PI*Math.min(1,u))*.45:(u>.43&&u<.57?0:Math.sin(Math.PI*Math.min(1,u))*.7);
      if (a.type==='candles') {
        const fade=gentle()?2500:600,hold=gentle()?2500:1500;
        el.style.opacity=.92*(t<fade?t/fade:t<fade+hold?1:a.keep?1:Math.max(0,1-(t-fade-hold)/fade));
        traps.candles(1-Number(el.style.opacity));
        if (t>=a.duration && a.keep) { permanent.push(el); a.nodes=[]; }
      }
      if (a.type==='footprints') a.nodes.forEach((n,i)=> { n.style.opacity=t<i*180?0:Math.max(0,1-(t-i*180)/6000)*.7; });
      if (a.type==='shadow') { if (t>1000) a.point=a.point.map((v,i)=>v+(pos[i]-v)*Math.min(1,(t-1000)/500)); updateShadow(); }
      if (a.type==='jump') updateJump(a,now);
      if (a.type==='map') { a.nodes[0].style.opacity=Math.min(1,t/400,(2000-t)/400); a.nodes[1].style.opacity=t<400||t>1600?0:.65; }
      if (active===a && t>=a.duration) finish();
    } else if (sceneId && phase==='idle' && now>=next && !$('mandala').open && !$('haunt-settings').open) {
      const type=weighted(['eyes','candles','creature','anim','bug']); if (type) start(type); else plan();
    }
    raf=requestAnimationFrame(tick);
  }
  function resume() { if (!raf && !document.hidden) raf=requestAnimationFrame(tick); }
  function phaseTo(value) { phase=value; if(value!=='idle')stillSince=performance.now(); }
  let entered=performance.now(), stillSince=entered, trapSince=0, trapUsed=false;
  let lastAttempt=0;
  const sound=window.HauntAudio;
  const jumpImages=cast.jumps.filter(d=>d.behavior==='clip'||manifest.jumps.includes(d.id)).map(d=>d.id);
  const cache=new Map();
  async function probe(name) {
    for(const src of [cast.jumps.find(d=>d.id===name).path]) {
      const im=new Image(); im.alt='';
      if(await new Promise(resolve=>{im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src=src;})) {cache.set(name,im);return;}
    }
  }
  jumpImages.forEach(probe);
  const fallbacks=[1,2,3].map(n=>{const im=new Image();im.src=`assets/img/ghosts/face_0${n}.webp`;return im;});
  function eligible() {
    return !reading && level!=='off' && !gentle() && !document.hidden &&
      !document.querySelector('dialog[open]') && Date.now()-lastAttempt>10000 &&
      Date.now()-(session.lastJump||0)>=(level==='high'?30000:45000) &&
      (level==='low'||session.jumps<(level==='high'?5:3));
  }
  function beginJump(force=false,reason='scene') {
    // Debug bypasses scheduling, never accessibility preferences.
    if(reading||(!force&&level==='off')||gentle()||document.hidden||document.querySelector('dialog[open]')||(!force&&!eligible())) return false;
    finish(); bugs.clear(); traps.reset(); lastAttempt=Date.now();
    const fake=(!force&&level==='low')||(force?params.get('fake')==='1':Math.random()<.3);
    const omen=force&&params.has('jump')?0:random(1500,3000), a={type:'jump',start:performance.now(),nodes:[],duration:omen+(fake?0:4000),omen,fake,beat:'omen',focus:document.activeElement,scroll:[scrollX,scrollY]};
    active=a;layer.dataset.effect='jump';stage.dataset.jumpPhase='omen';
    const requested=params.get('jump')||params.get('img');
    const preferred=cast.jumps.filter(d=>d.places.includes(sceneId)).map(d=>d.id);
    let choices=preferred.filter(n=>cache.has(n)&&n!==session.lastImage);
    if(!choices.length) choices=jumpImages.filter(n=>cache.has(n)&&n!==session.lastImage);
    const name=jumpImages.includes(requested)&&cache.has(requested)?requested:pick(choices);
    const fallback=pick(fallbacks.filter((_,i)=>`face_${i}`!==session.lastImage));
    a.image=(name?cache.get(name):fallback).cloneNode();a.image.alt='';a.imageName=name||`face_${fallbacks.indexOf(fallback)}`;
    a.clip=cast.jumps.find(d=>d.id===name&&d.behavior==='clip');
    // Retry missing artwork each attempt so a concurrently delivered PNG is picked up.
    jumpImages.filter(n=>!cache.has(n)).forEach(probe);
    const cover=document.createElement('div');cover.className='jump-viewport';cover.setAttribute('aria-hidden','true');cover.hidden=true;
    cover.append(a.image);document.body.append(cover);a.cover=cover;a.nodes.push(cover);
    a.candles=(spots.candles||[]).map(p=>({p,d:Math.hypot(p[0]-pos[0],p[1]-pos[1])})).sort((a,b)=>a.d-b.d).map(({p})=>{const el=node('haunt-candles');at(el,...p);a.nodes.push(el);return el;});
    a.cleanup=()=>{document.documentElement.classList.remove('jump-covering');if(!a.fake&&a.beat!=='omen'){session.lastJump=Date.now();persist();}traps.lighting();traps.candles(1);sound.stop();delete stage.dataset.jumpPhase;if(a.focus?.isConnected)a.focus.focus({preventScroll:true});window.scrollTo(...a.scroll);stillSince=performance.now();};
    sound.omen(omen/1000);return true;
  }
  function updateJump(a,now) {
    const t=now-a.start;
    if(t<a.omen) {
      const u=t/a.omen, flutter=(Math.sin(t*.043)+Math.sin(t*.071))*.07;
      traps.lighting(Math.max(.4,1-.6*u+flutter),Math.max(.12,.65-.45*u+flutter));
      traps.candles(1-u);
      a.candles.forEach((n,i)=>n.style.opacity=u>(i+1)/(a.candles.length+1)?1:0);
      return;
    }
    if(a.fake) return;
    if(a.beat==='omen') {
      a.beat='impact';a.beatStart=now;a.duration=Infinity;
      session.jumps++;session.lastJump=Date.now();session.lastImage=a.imageName;persist();
      document.documentElement.classList.add('jump-covering');a.cover.hidden=false;a.cover.dataset.phase='impact';stage.dataset.jumpPhase='impact';
      a.cover.classList.add('flash');setTimeout(()=>a.cover.classList.remove('flash'),50);
      if(a.clip){a.image.src=a.clip.path+`?t=${Date.now()}`;sound.clip(a.imageName);}else sound.impact();
    }
    const elapsed=now-a.beatStart;
    if(a.beat==='impact') {
      if(elapsed>=(a.clip?.duration||600)) {a.beat='blackout';a.beatStart=now;a.cover.dataset.phase='blackout';stage.dataset.jumpPhase='blackout';}
      else if(!a.clip) {if(!a.shakeAt||now-a.shakeAt>=1000/30){a.shakeAt=now;a.dx=random(-2,2);a.dy=random(-2,2);}a.image.style.transform=`translate(${a.dx}%,${a.dy}%) scale(${1+.15*Math.max(0,1-elapsed/100)})`;}
    } else if(a.beat==='blackout'&&elapsed>=400) {
      a.beat='aftermath';a.beatStart=now;a.cover.hidden=true;document.documentElement.classList.remove('jump-covering');stage.dataset.jumpPhase='aftermath';traps.lighting(0,.22);sound.ring();
      a.candles.forEach(n=>n.style.opacity=0);traps.candles(1);
    } else if(a.beat==='aftermath'&&elapsed>=3000) {sound.small('candle');a.beat='relight';a.beatStart=now;stage.dataset.jumpPhase='relight';}
    else if(a.beat==='relight') {traps.lighting(Math.min(1,elapsed/300),.22+.78*Math.min(1,elapsed/300));if(elapsed>=300)finish();}
  }
  function jump(reason='transition') {
    if(!eligible() || (reason==='transition'&&session.jumps===0&&session.moves<3&&Date.now()-session.start<60000)) return Promise.resolve();
    if(!beginJump(false,reason)) return Promise.resolve();
    return new Promise(resolve=>{active.resolve=resolve;});
  }
  function candidates(now) {
    if(!sceneId||phase!=='idle'||active?.type==='jump'||!eligible())return;
    const trap=WORLD.scenes[sceneId].bigTrap;
    const inside=trap&&gaze&&gaze[2]>.4&&Math.hypot(gaze[0]-trap.x,gaze[1]-trap.y)<70*gaze[2];
    if(!inside)trapSince=0;else if(!trapSince)trapSince=now;
    if(!trapUsed&&trapSince&&now-trapSince>=1000){trapUsed=true;beginJump(false,trap.kind);}
    else if((session.jumps===0&&(session.moves>=3||Date.now()-session.start>=60000))||now-stillSince>=40000)beginJump();
  }
  function map() {
    finish(); traps.cancel();
    document.querySelectorAll('[data-unknown-candle]').forEach(n=>n.remove());
    if (!allowed('map') || session.map || session.seen.length<4) return;
    const svg=document.querySelector('.mandala-art');
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.dataset.unknownCandle=''; g.setAttribute('class','current');
    g.innerHTML='<g transform="translate(370 350)"><circle class="halo" r="20"/><path class="flame" d="M0 -25C-17 -9 -7 -3 0 -3C12 -3 14 -14 0 -25Z"/><path class="wax" d="M-5 0H5V17H-5Z"/></g>'; svg.append(g);
    const b=document.createElement('button'); b.type='button'; b.dataset.unknownCandle=''; b.className='unknown-candle'; b.textContent='이름 없는 촛불'; $('map-links').after(b);
    const enter=()=> { finish(); cooldown=0; start('map'); }; b.onclick=enter; g.addEventListener('click',enter);
  }
  function drawSpots() {
    stage.querySelector('.haunt-debug:not(.trap-debug)')?.remove(); if(params.get('debug')!=='1') return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 1536 1024'); svg.classList.add('haunt-debug'); svg.setAttribute('aria-hidden','true');
    const colors={pass:'#80e0ff',watch:'#ff80be',eyes:'#96ff7c',candles:'#ffd45b'};
    svg.innerHTML=Object.entries(spots).map(([kind,entries])=>entries.map((p,i)=>{
      const shape=kind==='pass'?`<path d="M${p.from.join(' ')}L${p.to.join(' ')}m0 0v-${p.h}"/>`:kind==='candles'?`<rect x="${p[0]}" y="${p[1]}" width="${p[2]}" height="${p[3]}"/>`:`<circle cx="${p[0]}" cy="${p[1]}" r="9"/>${kind==='watch'?`<path d="M${p[0]} ${p[1]}v-${p[2]}"/>`:''}`;
      const xy=kind==='pass'?p.from:p; return `<g stroke="${colors[kind]}">${shape}<text x="${xy[0]}" y="${xy[1]-15}" fill="${colors[kind]}">${kind} ${i+1}</text></g>`;
    }).join('')).join(''); stage.append(svg);
  }
  window.Haunt={gentle,cancel,jump,map,phase:phaseTo,
    reading(value) { reading=value; cancel(); sound.stop(); plan(); },
    scene(id) {
      finish(); bugs.clear(); permanent.forEach(n=>n.remove()); permanent=[];
      if(sceneId && sceneId!==id) session.moves++;
      entered=performance.now();stillSince=entered;trapSince=0;trapUsed=false;
      sceneId=id; sound.configure(gentle()||level==='off',id); spots=WORLD.scenes[id].spots; if(!session.seen.includes(id)) session.seen.push(id); persist();
      session.visits[id]=(session.visits[id]||0)+1;persist();visionSince=0;visionSpot=-1;
      bugBudget=Math.random()<(['cave','sansin','hall'].includes(id)?.8:.45)?1+Math.floor(Math.random()*2):0;bugNext=performance.now()+random(8000,18000);
      printsUsed=false; route=[]; walked=false; phase='idle'; gaze=null; traps.scene(WORLD.scenes[id]); drawSpots(); plan(); resume();
    },
    position(p) { if(Math.hypot(p[0]-pos[0],p[1]-pos[1])>1)stillSince=performance.now(); pos=[...p]; if(phase==='walking' && (!route.length || Math.hypot(p[0]-route.at(-1)[0],p[1]-route.at(-1)[1])>25)) route.push([...p]); updateShadow(); scared(); },
    walkStart(p) {
      if(active?.type==='footprints') finish();
      phase='walking'; walked=true; route=[[...p]];
      if(Math.random()<.15) { const type=weighted(['pass','eyes']); if(type) start(type); }
      else if (!session.shadow && !recent.includes('shadow') && Math.random()<.2) start('shadow');
    },
    walkEnd() { phase='idle'; const started=walked && !printsUsed && !recent.includes('footprints') && start('footprints'); walked=false; plan(); return started ? new Promise(resolve=> { active.resolve=resolve; }) : Promise.resolve(); }
  };
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) { cancelAnimationFrame(raf); raf=0; finish(); bugs.clear(); } else { debugDue=performance.now()+2000; plan(); resume(); } });
  document.addEventListener('keydown',e=> { if(e.key==='Escape') { finish(); bugs.clear(); sound.silence(); } });
  document.addEventListener('keydown',e=>{if(active?.type==='jump'&&['impact','blackout'].includes(active.beat)&&e.key!=='Escape'){e.preventDefault();e.stopImmediatePropagation();}},true);
  function applySettings() {
    finish(); bugs.clear(); traps.reset(); permanent.forEach(n=>n.remove()); permanent=[]; map();
    document.body.classList.toggle('gentle-haunt',gentle());
    document.querySelector(`[name=intensity][value=${level}]`).checked=true; $('haunt-gentle').checked=soft;
    $('haunt-no-bugs').checked=noBugs;
    save(localStorage,'haunt.settings',{level,soft,noBugs}); sound.configure(gentle()||level==='off');
  }
  $('haunt-settings').addEventListener('change',()=>{ level=document.querySelector('[name=intensity]:checked').value; soft=$('haunt-gentle').checked; noBugs=$('haunt-no-bugs').checked; applySettings(); });
  reduced.addEventListener('change',applySettings);
  if(!read(localStorage,'haunt.notice',false)) $('haunt-notice').hidden=false;
  $('notice-close').onclick=()=> { $('haunt-notice').hidden=true; save(localStorage,'haunt.notice',true); };
  function fit() { const top=document.querySelector('.site-header').getBoundingClientRect().height+document.querySelector('.journey').getBoundingClientRect().height+$('haunt-notice').getBoundingClientRect().height; stage.style.setProperty('--stage-fit',`${Math.max(1,(innerHeight-top)*1.5)}px`); }
  const observer=new ResizeObserver(fit); ['.site-header','.journey','#haunt-notice'].forEach(s=>observer.observe(document.querySelector(s))); window.addEventListener('resize',fit);
  applySettings(); fit(); resume();
})();
