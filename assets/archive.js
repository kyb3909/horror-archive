/* Menus and manuscripts share the walking engine's history and scene transitions. */
(() => {
  const $ = id => document.getElementById(id), scenes = WORLD.scenes;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href = (s,p='',shelf='') => '?'+new URLSearchParams({s,...(p?{p}:{}),...(shelf?{shelf}:{})});
  const link = (s,label,p='',shelf='') => `<a data-route href="${esc(href(s,p,shelf))}">${esc(label)}</a>`;
  const postLink = p => link(p.place,p.title,p.id);
  const seriesPosts = p => POSTS.filter(q=>q.series===p.series).sort((a,b)=>a.part-b.part||a.id.localeCompare(b.id));
  const art = p => p.art;
  const uniquePosts = posts => posts.filter((p,i)=>!p.series||posts.findIndex(q=>q.series===p.series)===i);
  const recentLink = p => p.series ? link(seriesPosts(p)[0].place,p.series,seriesPosts(p)[0].id) : postLink(p);
  function seriesList(post,current=false){
    const entries=seriesPosts(post);
    return `<ol class="series-list">${Array.from({length:post.parts},(_,part)=>{
      const p=entries.find(p=>p.part===part), active=current&&p?.id===post.id;
      return `<li${active?' aria-current="page"':''}>${p?`<a data-route href="${esc(href(p.place,p.id))}"${active?' aria-current="page"':''}>${active?'<span aria-label="지금 읽는 회">🕯</span> ':''}${part}회 · ${esc(p.title)}</a>`:`<span class="series-pending">${part}회 · 준비 중</span>`}</li>`;
    }).join('')}</ol>`;
  }
  function seriesCard(p){
    const opening=seriesPosts(p).find(q=>q.part===0);
    return `<details class="post-card series-card"><summary>${opening&&art(opening)?`<img class="card-art" src="${esc(art(opening))}" alt="" loading="lazy" width="140" height="105">`:''}<span>${esc(p.series)}</span> <small>전 ${p.parts}회</small></summary>${seriesList(p)}</details>`;
  }
  const shelfCards = posts => uniquePosts(posts).sort((a,b)=>Number(!!b.series)-Number(!!a.series)).map(p=>p.series?seriesCard(p):card(p)).join('');
  function pagination(post,related,index){
    if(!post.series)return `${index>0?link(post.place,'앞 장 · '+related[index-1].title,related[index-1].id):'<span>첫 장입니다</span>'}${index<related.length-1?link(post.place,'다음 장 · '+related[index+1].title,related[index+1].id):'<span>마지막 장입니다</span>'}`;
    const neighbor=(part,label)=>{const p=related.find(p=>p.part===part);return p?link(p.place,label+' · '+p.title,p.id):`<span class="series-pending">${label} · ${part}회 준비 중</span>`;};
    return `${post.part>0?neighbor(post.part-1,'앞 회'):'<span>첫 회입니다</span>'}${post.part<post.parts-1?neighbor(post.part+1,'다음 회'):'<a href="#series-toc" data-series-toc>연재 끝 · 목차로</a>'}`;
  }
  const subjects = {gate:'공포 소식',myeongbu:'범죄 기록',sansin:'크립티드',lab:'SCP'};
  const mobile = () => matchMedia('(max-width:760px)').matches;
  const menu = $('main-menu');
  // Search comes first on phones without duplicating its state or controls.
  const searchWrap=$('post-search').closest('.search-wrap');
  const arrangeSearch=()=>{if(mobile())menu.insertBefore(searchWrap,$('place-menu'));else document.querySelector('.menu-tools').prepend(searchWrap);};
  arrangeSearch();window.addEventListener('resize',arrangeSearch);
  $('place-menu').innerHTML = [['지상',['gate','hall','myeongbu','sansin']],['지하',['cave','lab']]].map(([name,ids]) => `<div class="place-group"><span class="group-label">${name}</span>${ids.map(id => {
    const scene=scenes[id], posts=POSTS.filter(p=>p.place===id);
    return `<div class="place-item"><button class="place-toggle" data-place="${id}" aria-expanded="false" aria-controls="panel-${id}"><span>${scene.name}</span><small>${subjects[id]||'산사의 길'}</small></button><div class="place-panel" id="panel-${id}" hidden><p>${esc(scene.description)}</p>${link(id,scene.name+' 방문하기')}<h3>서가</h3>${scene.shelves.length ? scene.shelves.map(s=>link(id,`${s} (${posts.filter(p=>p.shelf===s).length})`,'',s)).join('') : '<p>기록실로 이어지는 길입니다.</p>'}<h3>최근 글</h3>${uniquePosts(posts).slice(0,3).map(recentLink).join('')||'<p>아직 비어 있는 서가</p>'}</div></div>`;
  }).join('')}</div>`).join('');
  const settings=$('haunt-settings'); $('haunt-button').after(settings); settings.prepend($('sound-button'));
  function closePanels(except) {
    document.querySelectorAll('.place-toggle,#haunt-button').forEach(b=>{
      if(b===except)return;
      b.setAttribute('aria-expanded','false'); $(b.getAttribute('aria-controls')).hidden=true;
    });
  }
  function openPanel(button) {
    closePanels(button);button.setAttribute('aria-expanded','true');$(button.getAttribute('aria-controls')).hidden=false;
  }
  document.querySelectorAll('.place-toggle').forEach(button=>{
    button.onclick=()=>{if(mobile()){const open=button.getAttribute('aria-expanded')==='true';closePanels();if(!open)openPanel(button);}else navigate(href(button.dataset.place));};
    button.onfocus=()=>{if(!mobile())openPanel(button);};
    button.parentElement.onmouseenter=()=>{if(!mobile())openPanel(button);};
    button.parentElement.onmouseleave=()=>{if(!mobile()&&!button.parentElement.contains(document.activeElement))closePanels();};
  });
  $('haunt-button').onclick=()=>{const open=!settings.hidden;closePanels();if(!open)openPanel($('haunt-button'));};
  $('haunt-close').onclick=()=>{closePanels();$('haunt-button').focus();};
  function toggleMenu(open) {
    menu.classList.toggle('is-open',open); $('menu-toggle').setAttribute('aria-expanded',String(open));document.body.classList.toggle('menu-open',open);
    if(open)$('menu-close').focus();
  }
  $('menu-toggle').onclick=()=>toggleMenu(!menu.classList.contains('is-open'));
  $('menu-close').onclick=()=>{toggleMenu(false);$('menu-toggle').focus();};
  function closeMenus(){closePanels();toggleMenu(false);$('search-results').hidden=true;$('post-search').setAttribute('aria-expanded','false');}
  async function navigate(destination) {
    const params=new URLSearchParams(destination), id=params.get('s');
    if(!scenes[id])return;
    closeMenus();
    // Suppress effects before the transition too, including an already running omen.
    window.Haunt.reading(!!params.get('p'));
    await window.Walk.travel(id,true,destination);
    const target=params.get('p')?$('reader'):params.get('shelf')?$('shelves'):$('scene-title');
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-series-toc]'))$('series-toc').open=true;
    // 출처 목록은 접혀 있다. 본문 각주 번호를 누르면 먼저 펼친 뒤 그 자료로 이동한다.
    const fn=event.target.closest('a[href^="#fn-"]');
    if(fn){const box=fn.closest('#reader')?.querySelector('details.sources');if(box)box.open=true;}
    const a=event.target.closest('a[data-route]');
    if(a&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(a.getAttribute('href'));}
    else if(!event.target.closest('.site-header'))closeMenus();
  });
  menu.addEventListener('focusout',()=>setTimeout(()=>{if(!menu.contains(document.activeElement))closePanels();},0));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const expanded=document.querySelector('.place-toggle[aria-expanded=true],#haunt-button[aria-expanded=true]');
      const wasMobile=menu.classList.contains('is-open');closeMenus();
      if(wasMobile)$('menu-toggle').focus();else if(expanded){expanded.focus();closePanels();}
    }
    if(e.target===$('post-search'))return;
    const item=e.target.closest('.place-item');
    if(item&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();
      if(['ArrowLeft','ArrowRight'].includes(e.key)){
        const buttons=[...document.querySelectorAll('.place-toggle')], i=buttons.indexOf(item.querySelector('button'));
        buttons[(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length].focus();
      }else{openPanel(item.querySelector('button'));const links=[...item.querySelectorAll('a')],i=links.indexOf(e.target);links[i<0 ? (e.key==='ArrowDown'?0:links.length-1) : (i+(e.key==='ArrowDown'?1:links.length-1))%links.length]?.focus();}
    }
    if(e.key==='Tab'&&mobile()&&menu.classList.contains('is-open')){
      const all=[...menu.querySelectorAll('a,button,input')].filter(el=>el.getClientRects().length), first=all[0],last=all.at(-1);
      if(e.shiftKey&&e.target===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&e.target===last){e.preventDefault();first.focus();}
    }
  });
  const search=$('post-search'), results=$('search-results'); let matches=[], selected=-1;
  search.oninput=()=>{
    const q=search.value.trim().toLocaleLowerCase();selected=-1;search.removeAttribute('aria-activedescendant');
    matches=q?POSTS.filter(p=>[p.title,p.dek,p.shelf,p.region,p.series].some(v=>String(v||'').toLocaleLowerCase().includes(q))):[];
    results.innerHTML=matches.map((p,i)=>`<a role="option" aria-selected="false" id="result-${i}" data-route href="${esc(href(p.place,p.id))}">${esc(p.series?`${p.series} ${p.part}회 · ${p.title}`:p.title)}<small>${esc(p.shelf)} · ${esc(p.region)}</small></a>`).join('')||(q?'<p role="status">검색 결과가 없습니다.</p>':'');
    results.hidden=!q;search.setAttribute('aria-expanded',String(!!q));closePanels();
  };
  search.onkeydown=e=>{
    if(['ArrowDown','ArrowUp'].includes(e.key)&&matches.length){e.preventDefault();results.hidden=false;search.setAttribute('aria-expanded','true');selected=selected<0 ? (e.key==='ArrowDown'?0:matches.length-1) : (selected+(e.key==='ArrowDown'?1:matches.length-1))%matches.length;results.querySelectorAll('a').forEach((a,i)=>a.setAttribute('aria-selected',String(i===selected)));search.setAttribute('aria-activedescendant',`result-${selected}`);$(`result-${selected}`).scrollIntoView({block:'nearest'});}
    if(e.key==='Enter'&&matches.length){e.preventDefault();const p=matches[Math.max(0,selected)];navigate(href(p.place,p.id));}
  };
  function card(p){return `<div class="post-card"><a class="card-art" data-route href="${esc(href(p.place,p.id))}" tabindex="-1" aria-hidden="true">${art(p)?`<img src="${esc(art(p))}" alt="" loading="lazy" width="1024" height="1536">`:''}</a>${postLink(p)}<p>${esc(p.dek)}</p><small>${esc(p.period)} · ${esc(p.region)} · ${esc(p.status)}</small></div>`;}
  // One observer per reader; route changes release every animation and listener.
  let clearMarginalia=()=>{};
  function decorateBook(post) {
    const body=$('reader').querySelector('.post-body');
    const first=body.querySelector('p');
    if(first){
      const walker=document.createTreeWalker(first,NodeFilter.SHOW_TEXT);
      let text;while((text=walker.nextNode())&&!text.textContent.trim()){}
      if(text){const at=text.textContent.search(/\S/u), letter=Array.from(text.textContent.slice(at))[0];
        const rest=text.splitText(at);rest.splitText(letter.length);
        const cap=document.createElement('span');cap.className='dropcap';cap.textContent=letter;rest.replaceWith(cap);}
    }
    let seed=2166136261;for(const c of post.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const names=['bird-hand','candle','centipede','eye-legs','hooded','key','long-hand','moth','pointing','snail-face','spiral','tailed-face'];
    for(let i=names.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[names[i],names[j]]=[names[j],names[i]];}
    const paragraphs=[...body.querySelectorAll(':scope > p')];
    const count=Math.min(8,Math.max(4,Math.ceil(paragraphs.length/4)));
    const nodes=[];
    for(let i=0;i<count;i++){
      const anchor=paragraphs[Math.min(paragraphs.length-1,Math.floor((i+.5)*paragraphs.length/count))];if(!anchor)continue;
      const el=document.createElement('span');el.className=`marginalia ${i%2?'on-right':'on-left'} ${i%2?'mobile-hide':''}`;
      el.setAttribute('aria-hidden','true');el.dataset.creature=names[i];
      el.style.setProperty('--tilt',`${Math.round(random()*16-8)}deg`);
      el.innerHTML=`<img src="assets/img/book/marg-${names[i]}.webp" alt="" loading="lazy" width="512" height="512">`;
      anchor.before(el);nodes.push(el);
    }
    const quiet=()=>window.Haunt?.gentle()||document.querySelector('[name=intensity]:checked')?.value==='off';
    const animations=new Set();
    function animate(el,frames,duration){if(quiet())return;const a=el.querySelector('img').animate(frames,{duration});animations.add(a);a.onfinish=()=>animations.delete(a);}
    const seen=new WeakSet(), outside=new WeakSet();
    const observer=new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries){const el=target.parentElement;
      if(isIntersecting){
        if(seen.has(el)&&outside.has(el)&&!quiet()&&Math.random()<.3){el.style.setProperty('--shift',`${Math.round(Math.random()*12-6)}px`);el.style.setProperty('--flip',Math.random()<.5?-1:1);}
        seen.add(el);outside.delete(el);
        if(el.dataset.creature==='eye-legs'&&Math.random()<.12)animate(el,[{scale:'1 1'},{scale:'1 .82'},{scale:'1 1'}],220);
      }else if(seen.has(el))outside.add(el);
    }},{threshold:0});nodes.forEach(el=>observer.observe(el.querySelector("img")));
    const centipede=nodes.find(el=>el.dataset.creature==='centipede');let last=-Infinity;
    const move=e=>{if(!centipede||quiet()||performance.now()-last<2500)return;const r=centipede.querySelector("img").getBoundingClientRect();
      if(e.clientX>r.left-35&&e.clientX<r.right+35&&e.clientY>r.top-35&&e.clientY<r.bottom+35){last=performance.now();animate(centipede,[{rotate:'0deg'},{rotate:'3deg'},{rotate:'-2deg'},{rotate:'0deg'}],550);}};
    body.addEventListener('pointermove',move);
    const stop=()=>{if(quiet()){animations.forEach(a=>a.cancel());animations.clear();nodes.forEach(el=>{el.style.removeProperty('--shift');el.style.removeProperty('--flip');});}};
    const reduced=matchMedia('(prefers-reduced-motion:reduce)');reduced.addEventListener('change',stop);$('haunt-settings').addEventListener('change',stop);
    clearMarginalia=()=>{observer.disconnect();animations.forEach(a=>a.cancel());body.removeEventListener('pointermove',move);reduced.removeEventListener('change',stop);$('haunt-settings').removeEventListener('change',stop);};
  }
  window.Archive={render(id){
    clearMarginalia();closeMenus();const scene=scenes[id], params=new URLSearchParams(location.search);
    const moved={'jack-the-ripper':'jack-the-ripper-00','hwaseong-serial-murders':'hwaseong-serial-murders-00','case8-retrial':'hwaseong-serial-murders-05'}[params.get('p')];
    if(id==='myeongbu'&&moved&&!POSTS.some(p=>p.id===params.get('p')&&p.place===id)&&POSTS.some(p=>p.id===moved&&p.place===id)){
      params.set('p',moved);history.replaceState(history.state,'','?'+params+location.hash);
    }
    const post=POSTS.find(p=>p.id===params.get('p')&&p.place===id), shelf=post?.shelf||(scene.shelves.includes(params.get('shelf'))?params.get('shelf'):'');
    window.Haunt.reading(!!post);document.body.classList.toggle('reading',!!post);
    document.querySelectorAll('.place-toggle').forEach(b=>{if(b.dataset.place===id)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');});
    const ancestors=[];for(let at=id;at;at=scenes[at].parent)ancestors.unshift(at);
    $('breadcrumbs').innerHTML=ancestors.map(at=>link(at,scenes[at].name)).concat(shelf?[link(id,shelf,'',shelf)]:[],post?[`<span aria-current="page">${esc(post.title)}</span>`]:[]).join('<span aria-hidden="true"> › </span>');
    const posts=POSTS.filter(p=>p.place===id);$('shelves').hidden=!!post||!scene.shelves.length;
    $('shelf-title').textContent=scene.name+'의 서가';
    $('shelf-tabs').innerHTML=['',...scene.shelves].map(s=>`<a data-route href="${esc(href(id,'',s))}" ${s===shelf?'aria-current="page"':''}>${esc(s||'전체')}</a>`).join('');
    $('post-list').innerHTML=(shelf?[shelf]:scene.shelves).map(s=>{const cards=uniquePosts(posts.filter(p=>p.shelf===s)), shown=shelf?cards:cards.slice(0,12);return `<section class="shelf"><h3>${esc(s)}</h3>${shelfCards(shown)||'<p class="empty">아직 비어 있는 서가</p>'}${cards.length>shown.length?`<p class="shelf-more">${link(id,`${s} 전체 ${cards.length}편 보기`,'',s)}</p>`:''}</section>`;}).join('');
    $('wayfinding').hidden=!!post||(!!scene.shelves.length&&id!=='gate');
    $('wayfinding').innerHTML='<h2>이 길 끝의 기록실</h2><p>법당의 옆문은 범죄 기록과 크립티드로, 지하 동굴의 쇠문은 SCP 기록으로 이어집니다.</p><div class="archive-shortcuts">'+Object.entries(subjects).map(([at,subject])=>link(at,scenes[at].name+' · '+subject)).join('')+'</div>';
    $('reader').hidden=!post;
    if(!post){$('reader').innerHTML=params.get('p')?'<p>글을 찾을 수 없습니다.</p>':'';if(params.get('p'))$('reader').hidden=false;return;}
    const related=post.series?seriesPosts(post):posts.filter(p=>p.shelf===post.shelf), index=related.indexOf(post);
    document.title=post.title+' · 공포 아카이브';
    if(post.html===undefined){
      $('reader').innerHTML='<p class="loading">글을 펼치는 중…</p>';
      fetch('assets/posts/'+encodeURIComponent(post.id)+'.json').then(r=>r.ok?r.json():Promise.reject(r.status))
        .then(body=>{Object.assign(post,body);if(new URLSearchParams(location.search).get('p')===post.id)window.Archive.render(id);})
        .catch(()=>{$('reader').innerHTML='<p>글을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>';});
      return;
    }
    $('reader').innerHTML=`<div class="book-spread"><div class="book-illustration">${art(post)?`<img src="${esc(art(post))}" alt="${esc(post.title)} — 채색 고서 삽화" width="1024" height="1536" fetchpriority="high">`:''}</div><header class="book-title"><img class="book-ribbon" src="assets/img/book/ribbon.webp" alt=""><p class="eyebrow">${esc(post.shelf)}${post.series?` <span class="series-badge">「${esc(post.series)} · ${post.part}회」</span>`:''}</p><h1>${esc(post.title)}</h1><p class="dek">${esc(post.dek)}</p><dl><div><dt>다루는 때</dt><dd>${esc(post.period)}</dd></div><div><dt>다루는 곳</dt><dd>${esc(post.region)}</dd></div><div><dt>발행일 · 상태</dt><dd>${esc(post.date)} · ${esc(post.status)}</dd></div></dl>${post.warning?`<p class="post-warning"><strong>주의</strong> ${esc(post.warning)}</p>`:''}${post.status==='자동 연재'?'<p class="post-warning post-ai"><strong>AI 작성</strong> 해외 매체의 원문 기사를 바탕으로 AI(Claude)가 쓰고, 다른 AI가 원문과 한 문장씩 대조해 검사한 글입니다. 원문은 글 끝 「확인한 자료」에 있습니다.</p>':''}</header></div><div class="manuscript"><div class="manuscript-content">${post.series?`<details class="series-toc" id="series-toc" open><summary>연재 목차 · ${esc(post.series)} <small>전 ${post.parts}회</small></summary>${seriesList(post,true)}</details>`:''}<div class="post-body">${post.html}</div><details class="sources"><summary>확인한 자료 ${post.sources.length}개</summary>${post.sources.map(s=>`<p id="fn-${s.number}" tabindex="-1"><a href="#ref-${s.number}" aria-label="본문 각주 ${s.number}로 돌아가기">[${s.number}]</a> ${s.html}</p>`).join('')||'<p>등록된 자료가 없습니다.</p>'}</details><section class="book-contents"><h2>이 서가의 다른 글</h2>${shelfCards(uniquePosts(posts.filter(p=>p.shelf===post.shelf&&p!==post&&(!post.series||p.series!==post.series))).slice(0,12))||'<p>아직 다른 글이 없습니다.</p>'}</section><nav class="post-pagination" aria-label="${post.series?'앞 회와 다음 회':'이전 글과 다음 글'}">${pagination(post,related,index)}</nav><p>${link(id,scene.name+'으로 돌아가기')}</p></div></div>`;
    decorateBook(post);
  }};
})();
