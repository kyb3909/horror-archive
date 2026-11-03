/* One canvas, driven by the director. Sprite attachment coordinates retain PNG padding. */
window.createStageBugs = function(stage) {
  const canvas=document.createElement('canvas'); canvas.className='bug-layer'; canvas.width=1536; canvas.height=1024; canvas.setAttribute('aria-hidden','true'); stage.append(canvas);
  const ctx=canvas.getContext('2d'), images=new Map();
  for(const item of HAUNT_CAST.bugs) { if(!HAUNT_ART.bugs.includes(item.id))continue; const im=new Image();im.src=item.path;images.set(item.id,im); }
  let swarm=null, visible=true, last=0;
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(stage);
  const light=(x,y,beam,p)=>Math.max(beam?Math.max(0,1-Math.hypot(x-beam[0],y-beam[1])/(108*beam[2])):0,Math.max(0,1-Math.hypot(x-p[0]-p[2]*.13,y-p[1]+p[2]*.5)/(p[2]*1.25))*.85);
  function sprite(id,x,y,size,angle,brightness,flip=1) {
    const im=images.get(id);if(!im?.complete||!im.naturalWidth)return;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);ctx.scale(flip,1);ctx.filter=`brightness(${.12+.88*brightness})`;ctx.drawImage(im,-size/2,-size/2,size,size);ctx.restore();
  }
  function clear(){swarm=null;ctx.clearRect(0,0,1536,1024);delete canvas.dataset.bug;}
  function start(kind,p,scene,soft=false,beam=null) {
    if(!['centipede','cockroach','spider','moth'].includes(kind))return false;
    clear(); const x=beam?beam[0]+100:Math.max(180,Math.min(1200,p[0]-150)),y=Math.max(730,Math.min(920,p[1]-50));
    swarm={kind,x,y,scene,soft,time:0,distance:0,history:[],count:18+Math.floor(Math.random()*7),flee:false,parts:Array.from({length:3+Math.floor(Math.random()*6)},()=>({x:x+Math.random()*80,y:y+Math.random()*40,a:Math.random()*Math.PI*2})),scale:Math.max(.6,p[2]/215)};
    last=performance.now();canvas.dataset.bug=kind;return true;
  }
  function tick(now,beam,p) {
    if(!swarm||!visible||document.hidden){last=now;return;}
    if(now-last<32)return;
    const dt=Math.min(.05,(now-last)/1000);last=now;const s=swarm;s.time+=dt;
    if(s.time>20){clear();return;}
    ctx.clearRect(0,0,1536,1024);ctx.save();
    const r=WORLD.scenes[s.scene].sacredRect;
    if(r){ctx.beginPath();ctx.rect(0,0,1536,1024);ctx.rect(...r);ctx.clip('evenodd');}
    const slow=s.soft?.3:1;
    if(s.kind==='centipede') {
      const size=54*s.scale, spacing=size*370/1024;
      if(!s.history.length)for(let i=s.count+6;i>=0;i--)s.history.push({x:s.x-i*spacing,y:s.y,d:-i*spacing});
      const head=s.history.at(-1);if(light(head.x,head.y,beam,p)>.22)s.flee=true;
      const speed=(s.flee?190:60)*slow, advance=speed*dt;s.distance+=advance;
      const x=s.x+s.distance,y=s.y+Math.sin(s.distance/90)*35;
      s.history.push({x,y,d:s.distance});
      while(s.history.length>2&&s.history[1].d<s.distance-(s.count+5)*spacing)s.history.shift();
      const sample=d=>{for(let i=s.history.length-1;i>0;i--){const a=s.history[i-1],b=s.history[i];if(a.d<=d){const u=Math.min(1,(d-a.d)/(b.d-a.d||1));return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,a:Math.atan2(b.y-a.y,b.x-a.x)};}}return {...s.history[0],a:0};};
      // Tail first; the front plate covers the attachment seam behind it.
      for(let i=s.count+1;i>=0;i--){const q=sample(s.distance-i*spacing);const id=i===0?'centipede-head':i>s.count?'centipede-tail':'centipede-segment';sprite(id,q.x,q.y,size*(i===0?.7:1),q.a+(s.soft?0:Math.sin(s.time*14-i)*.035),light(q.x,q.y,beam,p),i%2?-1:1);}
      if(x-(s.count+3)*spacing>1600)clear();
    } else if(s.kind==='cockroach') {
      for(const b of s.parts){const l=light(b.x,b.y,beam,p);if(l>.1){const origin=beam||[p[0],p[1]-p[2]*.5];b.a=Math.atan2(b.y-origin[1],b.x-origin[0]);}b.x+=Math.cos(b.a)*(l>.1?220:65)*dt*slow;b.y+=Math.sin(b.a)*(l>.1?220:65)*dt*slow;sprite('cockroach',b.x,b.y,45*s.scale,b.a,l);}
      if(s.parts.every(b=>b.x< -70||b.x>1606||b.y< -70||b.y>1094))clear();
    } else if(s.kind==='spider') {
      const y=s.drop??100;if(light(s.x,y,beam,p)>.2)s.flee=true;
      s.drop=y+(s.flee?-360:45)*dt*slow;ctx.strokeStyle='#aaa6';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(s.x,0);ctx.lineTo(s.x,s.drop);ctx.stroke();sprite('spider',s.x,s.drop,65*s.scale,Math.PI/2,light(s.x,s.drop,beam,p));if(s.drop< -70)clear();
    } else {
      const t=s.time*slow,x=p[0]+p[2]*.13+Math.sin(t*3.7)*80+Math.sin(t*7.1)*13,y=p[1]-p[2]*.5+Math.cos(t*2.3)*42;
      sprite('moth',x,y,65*s.scale,Math.sin(t*4)*.7,light(x,y,beam,p));
    }
    ctx.restore();
  }
  return {start,tick,clear,busy:()=>!!swarm};
};
