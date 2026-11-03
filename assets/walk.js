/* 데이터는 world.js. 외부 라이브러리 없이 원본 좌표로 무대를 그린다. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scenes = WORLD.scenes;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = $('stage'), visitor = $('visitor'), art = $('scene-art');
  const dialog = $('mandala'), mapButton = $('map-button');
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url = id => `?s=${id}${debug ? '&debug=1' : ''}${new URLSearchParams(location.search).has('trap') ? '&trap='+encodeURIComponent(new URLSearchParams(location.search).get('trap')) : ''}`;
  const getId = () => Object.hasOwn(scenes, new URLSearchParams(location.search).get('s')) ? new URLSearchParams(location.search).get('s') : 'gate';
  let current, position, pendingExit = null, target = null, phase = 'idle', epoch = 0, toastTimer, renderedSearch;
  let visited = new Set();
  try { const saved = JSON.parse(localStorage.getItem('horror-archive.visited') || '[]'); if (Array.isArray(saved)) visited = new Set(saved.filter(id => Object.hasOwn(scenes,id))); } catch (_) { /* 저장 차단이어도 탐색 가능 */ }
  function place(el, rect) {
    ['x','y','w','h'].forEach((key,i) => el.style.setProperty(`--${key}`,rect[i]));
  }
  function setVisitor(point) {
    position = [...point];
    window.Haunt?.position(point);
    ['vx','vy','vh'].forEach((key,i) => visitor.style.setProperty(`--${key}`,point[i]));
  }
  function cancel() {
    epoch++;
    window.Haunt?.cancel();
    target = null; pendingExit = null; phase = 'idle';
    visitor.classList.remove('walking');
    stage.classList.remove('dark');
  }
  function announce(message) {
    clearTimeout(toastTimer); $('message').textContent = message;
    toastTimer = setTimeout(() => { $('message').textContent = ''; }, 3200);
  }
  function exitMarkup(exit, index, overlay) {
    const label = exit.locked || exit.label;
    return exit.locked
      ? `<button type="button" data-exit="${index}" class="${overlay ? 'exit at' : 'exit-button'}" aria-label="${esc(label)}"><span>${esc(label)}</span></button>`
      : `<a href="${url(exit.to)}" data-exit="${index}" class="${overlay ? 'exit at' : 'exit-button'}"><span>${esc(label)}</span></a>`;
  }
  function render(id, focus = false) {
    renderedSearch = location.search;
    current = id;
    const scene = scenes[id];
    visited.add(id);
    try { localStorage.setItem('horror-archive.visited', JSON.stringify([...visited])); } catch (_) {}
    document.title = `${scene.name} · 공포 아카이브`;
    $('scene-title').textContent = scene.name;
    $('scene-description').textContent = scene.description;
    art.hidden = true; stage.classList.add('placeholder');
    art.onload = () => { art.hidden = false; stage.classList.remove('placeholder'); };
    art.onerror = () => { art.hidden = true; stage.classList.add('placeholder'); };
    if (scene.image) art.src = `assets/img/${scene.image}`; else art.removeAttribute('src');
    $('exits').innerHTML = scene.exits.map((e,i) => exitMarkup(e,i,true)).join('');
    $('exits').querySelectorAll('[data-exit]').forEach((el,i) => place(el,scene.exits[i].rect));
    $('exit-buttons').innerHTML = scene.exits.map((e,i) => exitMarkup(e,i,false)).join('');
    const ancestors = []; for (let at = id; at; at = scenes[at].parent) ancestors.unshift(at);
    $('breadcrumbs').innerHTML = ancestors.map(at => at === id ? `<span aria-current="location">${scenes[at].name}</span>` : `<a data-travel="${at}" href="${url(at)}">${scenes[at].name}</a>`).join('<span aria-hidden="true"> › </span>');
    setVisitor(scene.arrival); visitor.classList.remove('face-left');
    if (debug) drawDebug(scene);
    updateMap();
    window.Haunt?.scene(id);
    window.Archive.render(id);
    if (focus) $('scene-title').focus({preventScroll:true});
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
  async function travel(id, push = true, destination = url(id)) {
    cancel(); const token = epoch; phase = 'transition';
    window.Haunt?.phase('transition');
    if (!reduced.matches && !window.Haunt?.gentle()) { stage.classList.add('dark'); await wait(400); }
    if (token !== epoch) return;
    if (push && destination !== location.search) history.pushState({s:id},'',destination);
    render(id,true);
    await window.Haunt?.jump();
    if (token !== epoch) return;
    // 새 장면을 검은 막 아래 그린 뒤 밝힌다.
    if (!reduced.matches) await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (token !== epoch) return;
    stage.classList.remove('dark'); phase = 'idle';
    window.Haunt?.phase('idle');
    announce(`${scenes[id].name}에 도착했습니다.`);
  }
  function segment(from,to,token) {
    const duration = Math.hypot(to[0]-from[0],to[1]-from[1]) / 230 * 1000;
    visitor.classList.toggle('face-left',to[0] < from[0]);
    return new Promise(resolve => {
      let start;
      function frame(now) {
        if (token !== epoch) return resolve(false);
        if (start === undefined) start = now;
        const t = reduced.matches ? 1 : Math.min(1,(now-start)/Math.max(duration,1));
        setVisitor(from.map((v,i) => v + (to[i]-v)*t));
        if (t < 1) requestAnimationFrame(frame); else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }
  async function arrive(exit) {
    visitor.classList.remove('walking'); phase = 'idle'; target = null;
    const token = epoch;
    pendingExit = exit.locked ? null : exit;
    if (exit.locked) { announce(exit.locked); await window.Haunt?.jump('locked'); }
    await window.Haunt?.walkEnd();
    if (!exit.locked && token === epoch) travel(exit.to);
  }
  async function choose(index) {
    const scene = scenes[current], exit = scene.exits[index];
    if (pendingExit === exit) { cancel(); travel(exit.to); return; }
    if (phase === 'transition') return;
    if (phase === 'walking') {
      if (target !== index) return;
      cancel(); setVisitor(exit.path.at(-1) || scene.arrival); arrive(exit); return;
    }
    if (exit.instant || reduced.matches) {
      if (exit.locked) setVisitor(exit.path.at(-1));
      arrive(exit); return;
    }
    phase = 'walking'; target = index;
    const token = ++epoch; visitor.classList.add('walking');
    window.Haunt?.walkStart(position);
    // 잠긴 문 앞에 머물렀다면 기존 길을 되짚어 도착 지점으로 돌아온다.
    const oldExit = scene.exits.find(e => e.path.length && e.path.at(-1).every((v,i) => Math.abs(v-position[i]) < 1));
    const route = oldExit ? [...oldExit.path.slice(0,-1).reverse(),...exit.path.slice(1)] : exit.path.slice(1);
    for (const point of route) if (!await segment([...position],point,token)) return;
    if (token === epoch) arrive(exit);
  }
  function plainClick(e) { return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey; }
  for (const container of [$('exits'),$('exit-buttons')]) container.addEventListener('click',e => {
    const el = e.target.closest('[data-exit]'); if (!el || !plainClick(e)) return;
    e.preventDefault(); choose(Number(el.dataset.exit));
  });
  document.addEventListener('click',e => {
    const a = e.target.closest('[data-travel]'); if (!a || !plainClick(e)) return;
    e.preventDefault(); if (dialog.open) dialog.close(); travel(a.dataset.travel);
  });
  window.addEventListener('popstate',() => { if (location.search === renderedSearch) return; if (dialog.open) dialog.close(); cancel(); render(getId(),true); });
  reduced.addEventListener('change',() => {
    if (reduced.matches && phase === 'walking') choose(target);
  });
  const nodes = {gate:[240,390],hall:[240,240],myeongbu:[90,240],sansin:[390,240],cave:[240,125],lab:[240,40]};
  function updateMap() {
    $('map-nodes').innerHTML = Object.entries(nodes).map(([id,[x,y]]) => {
      const state = id === current ? 'current' : visited.has(id) ? 'visited' : 'unvisited';
      return `<a href="${url(id)}" data-travel="${id}" class="${state}" tabindex="-1" aria-hidden="true"><g transform="translate(${x} ${y})"><circle class="halo" r="26"/><path class="flame" d="M0 -25 C-17 -9 -7 -3 0 -3 C12 -3 14 -14 0 -25Z"/><path class="wax" d="M-5 0H5V17H-5Z"/><text y="40" text-anchor="middle">${scenes[id].name}</text></g></a>`;
    }).join('');
    $('map-links').innerHTML = Object.keys(scenes).map(id => `<li><a data-travel="${id}" href="${url(id)}" ${id === current ? 'aria-current="location"' : ''}>${scenes[id].name}<small>${id === current ? '지금 있는 곳' : visited.has(id) ? '가 본 곳' : '아직 가 보지 않은 곳'}</small></a></li>`).join('');
  }
  mapButton.addEventListener('click',() => { updateMap(); dialog.showModal(); window.Haunt?.map(); $('map-close').focus(); });
  $('map-close').addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => mapButton.focus({preventScroll:true}));
  dialog.addEventListener('click',e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  function drawDebug(scene) {
    $('debug-paths').innerHTML = scene.exits.map((exit,i) => `<polyline points="${exit.path.map(p => p.slice(0,2).join(',')).join(' ')}"/><text x="${exit.rect[0]}" y="${Math.max(20,exit.rect[1])}">${i}: ${esc(exit.id)}</text>${exit.path.map(([x,y,h]) => `<circle cx="${x}" cy="${y}" r="6"/><path d="M${x},${y}v${-h}"/>`).join('')}`).join('') + `<circle class="arrival" cx="${scene.arrival[0]}" cy="${scene.arrival[1]}" r="16"/>`;
  }
  if (debug) {
    stage.classList.add('debug'); $('debug-coordinates').hidden = false;
    stage.addEventListener('click',e => { const r = stage.getBoundingClientRect(); $('debug-coordinates').textContent = `${current} · x ${Math.round((e.clientX-r.left)/r.width*1536)}, y ${Math.round((e.clientY-r.top)/r.height*1024)}`; });
  }
  // PNG를 만드는 다른 작업과 독립적이다. WebP가 없으면 PNG를 메모리에서 잘라
  // WebP로 바꾼다. 원본에는 쓰지 않는다. 이후 빌드하면 정적 WebP를 우선 사용한다.
  let visitorReady = false, probing = false;
  const loadImage = src => new Promise((resolve,reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src; });
  async function probeVisitor() {
    if (visitorReady || probing || document.hidden) return;
    probing = true;
    try {
      let im, src;
      try { im = await loadImage('assets/img/visitor.webp'); src = im.src; }
      catch (_) {
        im = await loadImage(`art/img/visitor.png?v=${Date.now()}`); src = im.src;
        try {
          const canvas = document.createElement('canvas'); canvas.width = im.width; canvas.height = im.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(im,0,0);
          const pixels = ctx.getImageData(0,0,im.width,im.height).data;
          let x0=im.width,y0=im.height,x1=-1,y1=-1;
          for (let y=0;y<im.height;y++) for (let x=0;x<im.width;x++) if (pixels[(y*im.width+x)*4+3]>8) { x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }
          if (x1 < 0) throw new Error('빈 방문자 그림');
          const crop = document.createElement('canvas'); crop.width=x1-x0+1; crop.height=y1-y0+1;
          crop.getContext('2d').drawImage(canvas,x0,y0,crop.width,crop.height,0,0,crop.width,crop.height);
          src=crop.toDataURL('image/webp'); im=await loadImage(src);
        } catch (_) { /* file://의 canvas 제한에서는 원본을 표시 */ }
      }
      visitor.style.setProperty('--va',`${im.width} / ${im.height}`);
      $('visitor-image').src=src; visitor.classList.add('has-image'); visitorReady=true;
    } catch (_) { /* 아직 그림이 없으면 CSS 실루엣 유지 */ }
    finally { probing=false; }
  }
  window.Walk = {travel};
  render(getId()); probeVisitor();
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cancel(); });
  let probeTimer;
  function scheduleProbe() {
    clearInterval(probeTimer);
    if (!document.hidden && !visitorReady) probeTimer=setInterval(probeVisitor,15000);
    if (document.hidden) { clearTimeout(toastTimer); $('message').textContent=''; }
    else probeVisitor();
  }
  scheduleProbe();
  document.addEventListener('visibilitychange',scheduleProbe);
})();
