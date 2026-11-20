/* Moteur Quiz Live : grand écran (présentateur) + téléphones (joueurs), reliés en direct par PeerJS.
   Le contenu vient de QUIZ (quizzes/<id>/quiz.json) et l'habillage de THEME (themes/<nom>.json). */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const app=$('#app');
const W=Object.assign({},THEME.words,QUIZ.words||{});
const SRV='quizlive-'+QUIZ.id+'-';
const KEY='ql-'+QUIZ.id+'-';
const OPTS=window.PEER_OPTS||{debug:1,config:{iceServers:[
 {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},
 {urls:'stun:stun.cloudflare.com:3478'},
 {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'}]}};
function watchPc(c,cb){const seen=new Set();let hooked=false;const t=setInterval(()=>{const pc=c.peerConnection;if(!pc)return;
 if(!hooked){hooked=true;pc.addEventListener('icecandidate',e=>{if(e.candidate&&e.candidate.type)seen.add(e.candidate.type)})}
 cb(`ice ${pc.iceConnectionState} · conn ${pc.connectionState||'?'} · local ${[...seen].join('+')||'aucun'}`);
 if(c.open||pc.connectionState==='closed'){clearInterval(t)}},500);return t}

/* ---------- CONTENU ---------- */
const Q=QUIZ.questions,R=n=>QUIZ.rounds[n-1];
const NR=QUIZ.rounds.length;
const LIM=q=>(q.time||R(q.round).time||QUIZ.time||20)*1000;
const COLS=['#e21b3c','#1368ce','#d89e00','#26890c'];
const SW=q=>Object.assign({},QUIZ.swipe||{},R(q.round).swipe||{},q.swipe||{});
const ask=q=>q.ask||(q.type==='swipe'?(SW(q).ask||'Gauche ou droite ?'):q.type==='number'?'Quel est le bon chiffre ?':q.type==='order'?'Remettez dans l’ordre':q.type==='cloud'?'Un mot pour le dire ?':q.type==='poll'?'Et vous ?':'Quelle est la bonne réponse ?');
const drawArt=(k,args)=>ART[k]?ART[k](...(args||[])):'';
const iconOf=d=>d.icon==='bin'?bin(d.color):d.icon==='flag'?flagSvg(d.color):d.icon&&ART[d.icon]?ART[d.icon]():'';
function optsOf(q){
 if(q.type==='icons')return q.options.map(k=>{const d=QUIZ.icons[k];return{v:k,label:d.label,sub:d.sub,icon:iconOf(d)}});
 if(q.type==='swipe'){const s=SW(q);return['left','right'].map(v=>({v,label:s[v].label,icon:iconOf(s[v]),stamp:s[v].stamp,color:s[v].color}))}
 return (q.options||[]).map((o,i)=>({v:String(i),label:o}));
}
const NOPTS=t=>t==='poll'||t==='cloud';
const fmtNum=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:2,useGrouping:Math.abs(n)>=10000});
const unitOf=q=>q.unit?(/^[%°]/.test(q.unit)?' ':' ')+q.unit:'';
function shuffleFor(i,n){const a=[...Array(n).keys()];let x=(i+1)*9301+49297;for(let k=n-1;k>0;k--){x=(x*9301+49297)%233280;const j=Math.floor(x/233280*(k+1));[a[k],a[j]]=[a[j],a[k]]}if(a.every((v,k)=>v===k))a.push(a.shift());return a}
const goodLabel=q=>q.type==='number'?fmtNum(q.answer)+unitOf(q):q.type==='order'?q.items.join(' → '):NOPTS(q.type)?'':optsOf(q).find(o=>o.v===String(q.answer)).label;
function validAns(q,v){
 if(q.type==='number'){const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null}
 if(q.type==='cloud'){const w=String(v||'').replace(/\s+/g,' ').trim().slice(0,25);return w||null}
 if(q.type==='order'){if(!Array.isArray(v)||v.length!==q.items.length)return null;const s=[...v].map(Number).sort((a,b)=>a-b);return s.every((x,k)=>x===k)?v.map(Number):null}
 const sv=String(v);return optsOf(q).some(o=>o.v===sv)?sv:null;
}
function gainOf(q,a,lim){
 if(!a||NOPTS(q.type))return 0;const m=q.double?2:1,sp=1-.5*Math.min(a.ms,lim)/lim;
 if(q.type==='number'){const tol=q.tolerance||.5,err=Math.abs(a.v-q.answer)/Math.max(Math.abs(q.answer),1e-9);return Math.round(1000*Math.max(0,1-err/tol))*m}
 if(q.type==='order'){const c=a.v.filter((x,k)=>x===k).length,n=q.items.length;return(c===n?Math.round(1000*sp):Math.round(600*c/n))*m}
 return a.v===String(q.answer)?Math.round(1000*sp)*m:0;
}
function cloudHtml(words){const c={};words.forEach(w=>{const k=w.toLowerCase();c[k]=c[k]||{w,n:0};c[k].n++});const l=Object.values(c).sort((a,b)=>b.n-a.n).slice(0,40);if(!l.length)return '<p class="hint">Les mots apparaîtront ici…</p>';const mx=l[0].n;const cols=['#ffcf33','#ff8fab','#7cc4ff','#8be0a4','#c9a7ff','#ffb347'];return l.map((x,k)=>`<span style="font-size:${Math.round(18+38*x.n/mx)}px;color:${cols[k%6]}">${esc(x.w)}</span>`).join(' ')}
const artOf=q=>drawArt(q.art,q.artArgs);
const AVS=(QUIZ.avatars||[]).filter(k=>ART[k]);
const AVC=['#ffcf33','#ff8fab','#7cc4ff','#8be0a4','#c9a7ff','#ffb347'];
const avOk=a=>a&&AVS.includes(a.k)&&Number.isInteger(a.c)&&a.c>=0&&a.c<AVC.length?{k:a.k,c:a.c}:{k:AVS[0],c:0};
const avatar=(a,cls='')=>{a=avOk(a);return `<span class="av ${cls}" style="background:${AVC[a.c]}">${drawArt(a.k)}</span>`};
const logo=`<div class="logo">${drawArt(QUIZ.logoArt||THEME.logoArt)}${esc(QUIZ.title)}</div>`;
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
function qrSvg(text){const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:8,margin:2,scalable:true})}
function hasPeer(){if(typeof Peer==='function')return true;app.innerHTML=`<section class="center">${logo}<h2>Connexion impossible</h2><p>Le module de connexion n’a pas pu se charger. Vérifiez la connexion internet puis rechargez la page.</p></section>`;return false}
const good=()=>drawArt(THEME.goodArt),bad=()=>drawArt(THEME.badArt);

/* ---------- PLEIN ÉCRAN & CLAVIER ---------- */
const fsOk=()=>!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function toggleFS(){try{const d=document,e=d.documentElement;if(isFs())(d.exitFullscreen||d.webkitExitFullscreen).call(d);else{const r=(e.requestFullscreen||e.webkitRequestFullscreen).call(e);if(r&&r.catch)r.catch(()=>{})}}catch(x){}}
const FSI='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fsBtn=()=>fsOk()?`<button class="fsb" data-fs title="Plein écran (touche F)" aria-label="Plein écran">${FSI}<span>Plein écran</span></button>`:'';
document.addEventListener('click',e=>{if(e.target.closest('[data-fs]'))toggleFS()});
document.addEventListener('keydown',e=>{
 if(e.target.closest&&e.target.closest('input,textarea'))return;
 if(!H.peer)return;
 if(e.key==='f'||e.key==='F'){e.preventDefault();toggleFS();return}
 if([' ','Enter','ArrowRight','PageDown'].includes(e.key)){
  const b=['#go','#nx','#rv'].map(x=>$(x)).find(x=>x&&!x.disabled);
  if(b){e.preventDefault();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();b.click()}
 }
});
let wake=null;async function keepAwake(){try{if('wakeLock' in navigator&&!wake){wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null})}}catch(x){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&P.nick)keepAwake()});

/* ---------- ACCUEIL ---------- */
function home(){
 const g=(QUIZ.gallery||AVS.slice(0,6)).map((k,i)=>`<div style="--r:${[-4,3,-2,5,-3,2][i%6]}deg">${drawArt(k)}</div>`).join('');
 app.innerHTML=`<section class="hero"><div><h1>${QUIZ.titleHtml||esc(QUIZ.title)}</h1><p>${esc(QUIZ.tagline||'')} Le grand écran présente, les téléphones répondent, le classement tombe en direct.</p>
 <div class="btns"><button class="big" id="host">Je présente sur le grand écran</button></div>
 <form class="joinbox" id="jf"><label for="cd">Je joue : code de la partie</label><div class="row2"><input id="cd" inputmode="numeric" maxlength="4" placeholder="1234" autocomplete="off"><button class="big alt">Rejoindre</button></div></form></div>
 <div class="gallery">${g}</div></section>`;
 $('#host').onclick=hostInit;
 $('#jf').onsubmit=e=>{e.preventDefault();const c=$('#cd').value.replace(/\D/g,'');if(c.length===4)joinForm(c)};
}

/* ---------- PRÉSENTATEUR ---------- */
const H={peer:null,code:'',players:new Map(),phase:'lobby',i:0,t0:0,deadline:0,tick:null};
function hostInit(){
 if(!hasPeer())return;
 H.code=String(Math.floor(1000+Math.random()*9000));
 app.innerHTML=`<section class="center">${logo}<h2>Création de la partie…</h2></section>`;
 const peer=new Peer(SRV+H.code,OPTS);H.peer=peer;
 peer.on('open',()=>{lobby();clearInterval(H.sync);H.sync=setInterval(()=>{if(H.phase!=='lobby')H.players.forEach(p=>send(p,{...stateFor(p),sync:1}))},2500)});
 peer.on('connection',c=>{c.on('data',d=>hostData(c,d));c.on('close',()=>{const p=H.players.get(c.pid);if(p&&p.conn===c)p.conn=null;if(H.phase==='lobby')lobby();else hostCount()})});
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}});
 peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();hostInit()}else if(e.type==='network'||e.type==='server-error'||e.type==='socket-error'){toast('Connexion au serveur perdue, nouvelle tentative…');setTimeout(()=>{try{peer.reconnect()}catch(x){}},2000)}});
}
function hostData(c,d){
 if(!d||typeof d!=='object')return;
 if(d.t==='join'){
  if(d.v!==VER){try{c.send({t:'reload',v:VER})}catch(x){}return}
  const pid=String(d.pid||'').slice(0,40);if(!pid)return;
  const nick=String(d.nick||'').replace(/\s+/g,' ').trim().slice(0,20)||'Anonyme';
  let p=H.players.get(pid);
  if(!p){p={pid,nick,score:0,ans:{},res:null,prev:0};H.players.set(pid,p)}
  p.nick=nick;p.av=avOk(d.av);p.conn=c;c.pid=pid;send(p,stateFor(p));
  if(H.phase==='lobby')lobby();else hostCount();return;
 }
 if(d.t==='ans'){
  const p=H.players.get(c.pid);if(!p||H.phase!=='q'||d.i!==H.i||p.ans[H.i])return;
  const q=Q[H.i],v=validAns(q,d.v);if(v===null)return;
  p.ans[H.i]={v,ms:Date.now()-H.t0};send(p,{t:'got',i:H.i});hostCount();live();
  const on=[...H.players.values()].filter(x=>x.conn&&x.conn.open),qi=H.i;
  if(on.length&&on.every(x=>x.ans[H.i]))setTimeout(()=>{if(H.phase==='q'&&H.i===qi)reveal()},600);
 }
}
function live(){const q=Q[H.i];if(H.phase!=='q')return;const as=[...H.players.values()].map(p=>p.ans[H.i]).filter(Boolean);
 if(q.type==='poll'){const tot=as.length;document.querySelectorAll('.opt').forEach(e=>{const n=as.filter(a=>a.v===e.dataset.v).length;e.querySelector('.bar i').style.width=(tot?n/tot*100:0)+'%';e.querySelector('.nb').textContent=n})}
 if(q.type==='cloud'){const c=$('#cloud');if(c)c.innerHTML=cloudHtml(as.map(a=>a.v))}
 if(q.type==='number'){const b=$('#bn');if(b)b.textContent=as.length?as.length+' estimation'+(as.length>1?'s':''):'?'}}
function send(p,m){try{if(p.conn&&p.conn.open)p.conn.send(m)}catch(e){}}
function bc(fn){H.players.forEach(p=>send(p,fn(p)))}
function ranked(){return [...H.players.values()].sort((a,b)=>b.score-a.score)}
function stateFor(p){
 const q=Q[H.i];
 if(H.phase==='lobby')return{t:'lobby'};
 if(H.phase==='inter')return{t:'inter',m:q.round};
 if(H.phase==='q')return{t:'q',i:H.i,rem:Math.max(0,H.deadline-Date.now()),done:!!p.ans[H.i]};
 if(H.phase==='end')return{t:'end',...endRes(p)};
 return p.res&&p.res.i===H.i?p.res:{t:'wait'};
}
function online(){return [...H.players.values()].filter(p=>p.conn&&p.conn.open).length}
function hostCount(){const e=$('#cnt');if(!e)return;if(H.phase==='q'){const n=[...H.players.values()].filter(p=>p.ans[H.i]).length;e.textContent=`${n} / ${online()} réponses`}else e.textContent=`${online()} joueurs connectés`}
function hostHead(){return `<div class="top">${logo}<span class="keys">Espace ou → pour avancer</span><span class="pill" id="cnt"></span><span class="pill">Code ${H.code}</span>${fsBtn()}</div>`}
function lobby(){
 H.phase='lobby';
 const url=location.origin+location.pathname+'?p='+H.code;
 const ps=[...H.players.values()];
 app.innerHTML=`<div class="lobtop">${fsBtn()}</div><section class="lobby"><div class="lq">${logo}<h1>Scannez pour jouer</h1>${QUIZ.rulesNote?`<p class="rules">${esc(QUIZ.rulesNote)}</p>`:''}<div class="qr">${qrSvg(url)}</div><p class="url">ou allez sur <b>${esc(location.host+location.pathname)}</b><br>code <b class="code">${H.code}</b></p><p class="net"><b>Coupez le wifi</b> et jouez en 4G ou 5G avant de scanner.</p></div>
 <div class="lp"><div class="lh"><h2>${ps.length?ps.length+' joueur'+(ps.length>1?'s':'')+' dans la salle':'En attente des joueurs…'}</h2><button class="big" id="go" ${ps.length?'':'disabled'}>Lancer la partie</button></div><p class="hint small">Version ${VER}. Astuce : Espace, Entrée ou → font avancer le jeu (une télécommande de présentation marche aussi). F pour le plein écran.</p>
 <div class="chips">${ps.map(p=>`<span class="nick${p.conn&&p.conn.open?'':' off'}">${avatar(p.av)}${esc(p.nick)}</span>`).join('')||'<p class="hint">Les pseudos apparaîtront ici dès que les téléphones se connectent.</p>'}</div></div></section>`;
 const go=$('#go');if(go)go.onclick=()=>{H.i=0;step()};
}
function step(){if(H.i>=Q.length)return finish();const q=Q[H.i];if(H.i===0||Q[H.i-1].round!==q.round)inter();else question()}
function inter(){
 H.phase='inter';const q=Q[H.i],M=R(q.round);bc(stateFor);
 app.innerHTML=hostHead()+`<section class="inter"><div class="num">Manche ${q.round} sur ${NR}</div>${drawArt(M.art).replace('<svg','<svg class="ibig"')}<h2>${esc(M.title)}</h2><p>${esc(M.text||'')}</p><button class="big" id="nx">Afficher la question</button></section>`;
 hostCount();$('#nx').onclick=question;
}
function question(){
 H.phase='q';const q=Q[H.i],M=R(q.round),lim=LIM(q);H.t0=Date.now();H.deadline=H.t0+lim;bc(stateFor);
 const os=optsOf(q),sw=q.type==='swipe'?SW(q):null;
 const body=q.type==='number'?`<div class="bignum" id="bn">?</div><p class="hint">Chacun tape son estimation${q.unit?' (en '+esc(q.unit)+')':''}. Plus on est proche, plus on marque.</p>`:q.type==='cloud'?`<div class="cloud" id="cloud">${cloudHtml([])}</div>`:q.type==='order'?`<ol class="olist" id="olist">${shuffleFor(H.i,q.items.length).map(k=>`<li>${esc(q.items[k])}</li>`).join('')}</ol><p class="hint">À remettre dans l’ordre sur les téléphones.</p>`:null;
 app.innerHTML=hostHead()+`<section class="stage"><article class="profile"><div class="pic" style="background:${M.tint||'#fff3c4'}">${artOf(q)}${W.online?`<span class="tag"><b></b>${esc(W.online)}</span>`:''}</div><div class="who"><h2>${esc(q.name||'')} ${q.sub?`<small>· ${esc(q.sub)}</small>`:''}</h2>${q.bio?`<p class="bio">${esc(q.bio)}</p>`:''}</div></article>
 <div class="panel"><div class="qh"><div><div class="manche">Question ${H.i+1} / ${Q.length} · ${esc(M.title)}${q.double?' · points doublés':''}</div><h3>${esc(ask(q))}</h3></div><div class="cd" id="cd">${lim/1000}</div></div>
 ${sw?`<p class="swhint">◀ Swipe à gauche : ${esc(sw.left.label)} · Swipe à droite : ${esc(sw.right.label)} ▶</p>`:''}${body!==null?body:`<div class="opts${os.length===2?' two':''}">${os.map((o,k)=>`<div class="opt" data-v="${o.v}" style="--c:${COLS[k]}">${o.icon||`<span class="sh">${k+1}</span>`}<span><b>${esc(o.label)}</b>${o.sub?`<small>${esc(o.sub)}</small>`:''}</span><span class="bar"><i></i></span><span class="nb"></span></div>`).join('')}</div>`}
 <div id="fb"></div><div class="next"><button class="big alt" id="rv">Révéler la réponse</button></div></div></section>`;
 hostCount();$('#rv').onclick=reveal;
 clearInterval(H.tick);H.tick=setInterval(()=>{const r=Math.max(0,Math.ceil((H.deadline-Date.now())/1000));const e=$('#cd');if(e)e.textContent=r;if(r<=0)reveal()},200);
}
function reveal(){
 if(H.phase!=='q')return;clearInterval(H.tick);H.phase='rev';
 const q=Q[H.i],lim=LIM(q),gv=String(q.answer),cnt={};let tot=0;
 const before=ranked().map(p=>p.pid);
 H.players.forEach(p=>{const a=p.ans[H.i];if(a){tot++;const k=Array.isArray(a.v)?'':String(a.v);cnt[k]=(cnt[k]||0)+1}const gain=gainOf(q,a,lim);p.score+=gain;p.last=gain;p.prev=before.indexOf(p.pid)});
 const r=ranked();
 r.forEach((p,k)=>{const a=p.ans[H.i];p.res={t:'rev',i:H.i,kind:q.type,ans:!!a,ok:p.last>0,gain:p.last,score:p.score,rank:k+1,total:r.length,good:goodLabel(q),mine:a?(q.type==='number'?fmtNum(a.v)+unitOf(q):q.type==='order'?a.v.filter((x,j)=>x===j).length+' / '+q.items.length+' bien placés':''):''};send(p,p.res)});
 const e=$('#cd');if(e)e.textContent='';
 let head=esc(goodLabel(q)),extra='';
 if(['choice','icons','swipe','poll'].includes(q.type))document.querySelectorAll('.opt').forEach(e=>{const v=e.dataset.v,n=cnt[v]||0;if(q.type!=='poll')e.classList.add(v===gv?'ok':'dim');e.querySelector('.bar i').style.width=(tot?n/tot*100:0)+'%';e.querySelector('.nb').textContent=n});
 if(q.type==='swipe'){const o=optsOf(q).find(x=>x.v===gv),pic=document.querySelector('.profile .pic');if(pic&&o)pic.insertAdjacentHTML('beforeend',`<span class="bigstamp" style="color:${o.color||'#e21b3c'}">${esc(o.stamp||o.label)}</span>`)}
 if(q.type==='number'){const bn=$('#bn');if(bn){bn.textContent=fmtNum(q.answer)+unitOf(q);bn.classList.add('ans')}
  const near=[...H.players.values()].filter(p=>p.ans[H.i]).sort((x,y)=>Math.abs(x.ans[H.i].v-q.answer)-Math.abs(y.ans[H.i].v-q.answer)).slice(0,3);
  if(near.length)extra=`<p class="near">Les plus proches : ${near.map(p=>`<b>${esc(p.nick)}</b> (${fmtNum(p.ans[H.i].v)})`).join(', ')}</p>`;head='Réponse : '+head}
 if(q.type==='order'){const ol=$('#olist');if(ol){ol.innerHTML=q.items.map(t=>`<li class="ok">${esc(t)}</li>`).join('');}
  const full=[...H.players.values()].filter(p=>p.ans[H.i]&&p.ans[H.i].v.every((x,j)=>x===j)).length;extra=`<p class="near">${full} joueur${full>1?'s':''} sur ${tot} ${full>1?'ont':'a'} trouvé l’ordre exact.</p>`;head='Le bon ordre'}
 if(q.type==='cloud'){const c=$('#cloud');if(c)c.innerHTML=cloudHtml([...H.players.values()].map(p=>p.ans[H.i]).filter(Boolean).map(a=>a.v))}
 if(NOPTS(q.type))head=`${tot} réponse${tot>1?'s':''}`;
 $('#fb').innerHTML=`<div class="fb"><h4>${good()}${head}</h4>${q.why?`<p>${esc(q.why)}</p>`:''}${extra}</div>`;
 const b=$('#rv'),last=H.i===Q.length-1;b.className='big';
 if(NOPTS(q.type)){b.textContent=last?'Voir le podium':'Question suivante';b.onclick=()=>{H.i++;step()}}
 else{b.textContent='Voir le classement';b.onclick=board}
}
function board(){
 H.phase='board';const r=ranked().slice(0,5),last=H.i===Q.length-1,ST=88;
 const rows=r.map((p,k)=>{const from=Number.isInteger(p.prev)&&p.prev>=0?p.prev:99,start=Math.min(from,5),d=from<99?from-k:0;
  return `<div class="rk" data-to="${k}" style="top:${start*ST}px;${from<5?'':'opacity:0'}"><span class="pos">${from<5?from+1:'–'}</span>${avatar(p.av)}<span class="nm">${esc(p.nick)}</span>${p.last?`<span class="gn">+${p.last}</span>`:''}<span class="sc" data-a="${p.score-(p.last||0)}" data-b="${p.score}">${p.score-(p.last||0)}</span><span class="dl ${d>0?'up':d<0?'down':''}">${d>0?'▲'+d:d<0?'▼'+(-d):''}</span></div>`}).join('');
 app.innerHTML=hostHead()+`<section class="board"><h2>${esc(W.board)}</h2><div class="rows anim" style="height:${Math.max(1,r.length)*ST-12}px">${rows||'<p class="hint">Aucun joueur.</p>'}</div><button class="big" id="nx">${last?'Voir le podium':'Question suivante'}</button></section>`;
 hostCount();$('#nx').onclick=()=>{H.i++;step()};
 const els=[...document.querySelectorAll('.rows.anim .rk')];
 setTimeout(()=>{
  els.forEach(e=>{const k=+e.dataset.to;e.style.top=k*ST+'px';e.style.opacity=1;const g=e.querySelector('.gn');if(g)g.classList.add('flash')});
  const sc=els.map(e=>e.querySelector('.sc')),t0=performance.now(),D=1100;
  const run=now=>{const f=Math.min(1,(now-t0)/D),ez=1-Math.pow(1-f,3);sc.forEach(x=>{const a=+x.dataset.a,b=+x.dataset.b;x.textContent=Math.round(a+(b-a)*ez)});if(f<1)requestAnimationFrame(run)};
  requestAnimationFrame(run);
  setTimeout(()=>els.forEach(e=>{e.querySelector('.pos').textContent=+e.dataset.to+1;e.querySelector('.dl').classList.add('on')}),950);
 },700);
}
function endRes(p){const r=ranked();return{score:p.score,rank:r.indexOf(p)+1,total:r.length}}
function finish(){
 H.phase='end';bc(stateFor);const r=ranked();const pod=[r[1],r[0],r[2]];
 app.innerHTML=hostHead()+`<section class="board"><h2>${esc(QUIZ.podiumTitle||W.podium)}</h2><div class="podium">${pod.map((p,k)=>p?`<div class="pod p${[2,1,3][k]}">${avatar(p.av,'avbig')}<span class="nm">${esc(p.nick)}</span><span class="sc">${p.score} pts</span><div class="blk">${[2,1,3][k]}</div></div>`:'<div></div>').join('')}</div>
 <p class="hint">${r[0]&&QUIZ.winnerLine?esc(QUIZ.winnerLine.replace('{nick}',r[0].nick)):''} ${esc(QUIZ.finishNote||'')}</p></section>`;
 hostCount();
}
function toast(t){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';document.body.appendChild(e)}e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),3500)}

/* ---------- JOUEUR ---------- */
const P={peer:null,conn:null,code:'',nick:'',pid:'',tick:null,timer:null,last:null,ok:false};
function joinForm(code){
 P.code=code;
 let av;try{av=avOk(JSON.parse(store.get(KEY+'av')))}catch(e){av=null}
 if(!store.get(KEY+'av'))av={k:AVS[Math.floor(Math.random()*AVS.length)],c:Math.floor(Math.random()*AVC.length)};
 const draw=()=>{
  app.innerHTML=`<section class="center join">${logo}<h2>${esc(W.profileTitle)}</h2><p>Partie <b>${esc(code)}</b>. ${esc(W.profileText)}</p>
  <div class="me">${avatar(av,'avbig')}</div>
  <form id="nf"><input class="pseudo" id="nk" maxlength="20" value="${esc(P.nick||store.get('ql-nick')||'')}" placeholder="${esc(QUIZ.nickPlaceholder||'Ton pseudo')}" aria-label="Pseudo" required>
  <div class="lbl">Ton avatar</div><div class="avpick">${AVS.map(k=>`<button type="button" class="avb${k===av.k?' sel':''}" data-k="${k}" aria-label="${k}">${drawArt(k)}</button>`).join('')}</div>
  <div class="lbl">Ta couleur</div><div class="colpick">${AVC.map((c,i)=>`<button type="button" class="colb${i===av.c?' sel':''}" data-c="${i}" style="background:${c}" aria-label="Couleur ${i+1}"></button>`).join('')}</div>
  <p class="net small"><b>Pense à couper le wifi</b> : le jeu marche en 4G ou 5G.</p>${fsOk()?`<label class="fsj"><input type="checkbox" id="fsj" checked> Jouer en plein écran</label>`:''}
  <button class="big">${esc(W.go)}</button></form></section>`;
  const keep=()=>{P.nick=$('#nk').value};
  document.querySelectorAll('.avb').forEach(b=>b.onclick=()=>{keep();av.k=b.dataset.k;draw()});
  document.querySelectorAll('.colb').forEach(b=>b.onclick=()=>{keep();av.c=+b.dataset.c;draw()});
  $('#nf').onsubmit=e=>{e.preventDefault();P.nick=$('#nk').value.trim().slice(0,20)||'Anonyme';P.av=av;store.set('ql-nick',P.nick);store.set(KEY+'av',JSON.stringify(av));keepAwake();if(fsOk()&&!isFs()&&$('#fsj')&&$('#fsj').checked)toggleFS();playerConnect()};
 };
 draw();
}
function pmsg(title,text,cls=''){app.innerHTML=`<section class="center ${cls}">${logo}<h2>${title}</h2>${text?`<p>${text}</p>`:''}</section>`}
function playerConnect(){
 if(!hasPeer())return;
 P.pid=store.get('ql-pid')||(Date.now().toString(36)+Math.random().toString(36).slice(2,10));store.set('ql-pid',P.pid);
 pmsg('Connexion…','On te fait entrer dans la salle.<br><span class="dbg" id="pdbg">Étape 1 : connexion au serveur…</span>');
 const start=()=>{
  if(P.peer&&!P.peer.destroyed)P.peer.destroy();
  const peer=new Peer(OPTS);P.peer=peer;
  peer.on('open',()=>{dbg('Étape 2 : serveur OK, recherche de la partie…');link()});
  peer.on('error',e=>{if(e.type==='peer-unavailable'){pmsg('Partie introuvable',`Aucune partie ouverte avec le code <b>${esc(P.code)}</b>. Vérifie le code ou attends que le présentateur ouvre la partie.<br><br><button class="big" id="rt">Réessayer</button>`);$('#rt').onclick=start}
   else if(!P.ok){pmsg('Connexion difficile','Le réseau bloque peut-être la connexion. Essaie en 4G plutôt qu’en wifi.<br><br><button class="big" id="rt">Réessayer</button>');$('#rt').onclick=start}});
  peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}});
 };
 const link=()=>{
  const c=P.peer.connect(SRV+P.code,{reliable:true});watchPc(c,t=>dbg('Étape 3 : '+t));
  clearTimeout(P.timer);P.timer=setTimeout(()=>{if(!c.open&&!P.ok){pmsg('Connexion difficile','La connexion met trop de temps. Essaie en 4G plutôt qu’en wifi.<br><span class="dbg">'+esc(P.dbgTxt||'')+'</span><br><br><button class="big" id="rt">Réessayer</button>');$('#rt').onclick=start}},30000);
  c.on('open',()=>{P.conn=c;P.ok=true;P.seen=Date.now();P.key=null;clearTimeout(P.timer);c.send({t:'join',pid:P.pid,nick:P.nick,av:P.av,v:VER})});
  if(!P.dog)P.dog=setInterval(()=>{if(P.conn&&P.key&&P.key!=='lobby'&&P.key!=='end'&&Date.now()-P.seen>9000){const old=P.conn;P.conn=null;banner(true);try{old.close()}catch(x){}P.seen=Date.now();link()}},2000);
  c.on('data',pData);
  c.on('close',()=>{if(P.conn===c){P.conn=null;banner(true);setTimeout(()=>{if(!P.conn)link()},2000)}});
 };
 start();
}
function dbg(t){P.dbgTxt=t;const e=$('#pdbg');if(e)e.textContent=t}
function banner(on){let e=$('#lost');if(on&&!e){e=document.createElement('div');e.id='lost';e.textContent='Connexion perdue… reconnexion en cours';document.body.appendChild(e)}if(!on&&e)e.remove()}
function phead(score){return `<div class="ptop">${logo}<span class="pill pme">${avatar(P.av,'avs')}${esc(P.nick)}${score!=null?' · '+score+' pts':''}</span>${fsBtn().replace('<span>Plein écran</span>','')}</div>`}
const sentBox=()=>`<div class="sent">${good()}<b>${esc(W.sent)}</b><span>${esc(W.watch)}</span></div>`;
const keyOf=d=>d.t==='q'?'q'+d.i:d.t==='rev'?'rev'+d.i:d.t==='inter'?'inter'+d.m:d.t;
function pData(d){
 banner(false);if(!d||typeof d!=='object')return;P.seen=Date.now();
 if(d.t==='reload'){let n=0;try{n=+sessionStorage.getItem('ql-rl')||0}catch(x){}
  if(n<2){try{sessionStorage.setItem('ql-rl',n+1)}catch(x){}pmsg('Mise à jour…','On charge la dernière version du jeu.');location.replace(location.pathname+'?p='+P.code+'&r='+Date.now());}
  else pmsg('Versions différentes','Le grand écran et ton téléphone n’ont pas la même version du jeu. Le présentateur doit recharger sa page (Ctrl+F5), puis rescanne le QR code.');return}
 if(d.t!=='got'){try{sessionStorage.removeItem('ql-rl')}catch(x){}const k=keyOf(d);if(d.sync&&k===P.key)return;P.key=k;clearInterval(P.tick)}
 if(d.t==='got'){setTimeout(()=>{if(P.qi!==d.i||!P.last||P.last.t!=='q')return;const e=$('#pq');if(e)e.innerHTML=sentBox()},380);return}
 P.last=d;
 if(d.t==='lobby'){app.innerHTML=phead()+`<section class="center">${drawArt(QUIZ.lobbyArt||AVS[0]).replace('<svg','<svg class="pbig"')}<h2>${esc(W.inRoom)}</h2><p>${esc(W.inRoomText)}</p></section>`;return}
 if(d.t==='wait'){app.innerHTML=phead()+`<section class="center"><h2>${esc(W.watch)}</h2><p>La prochaine question arrive.</p></section>`;return}
 if(d.t==='inter'){const M=R(d.m);app.innerHTML=phead()+`<section class="center">${drawArt(M.art).replace('<svg','<svg class="pbig"')}<div class="num">Manche ${d.m} sur ${NR}</div><h2>${esc(M.title)}</h2><p>${esc(M.text||'')}</p></section>`;return}
 if(d.t==='q'){
  const q=Q[d.i],os=optsOf(q),end=Date.now()+d.rem,lim=LIM(q);P.qi=d.i;
  const sw=q.type==='swipe'?SW(q):null;
  app.innerHTML=phead()+`<section class="pq"><div class="pmeta"><span>${esc(q.name||'')}</span><span class="cd" id="pcd"></span></div><div class="timer"><i id="tb"></i></div><h3>${esc(ask(q))}</h3><div id="pq">${d.done?sentBox():q.type==='number'?`<form id="nform" class="pform"><input id="nv" class="pseudo" inputmode="decimal" autocomplete="off" placeholder="Ton estimation" aria-label="Ton estimation">${q.unit?`<span class="unit">${esc(q.unit)}</span>`:''}<button class="big">Valider</button></form>`:q.type==='cloud'?`<form id="cform" class="pform"><input id="cv" class="pseudo" maxlength="25" autocomplete="off" placeholder="Un mot ou deux" aria-label="Ta réponse"><button class="big">Envoyer</button></form>`:q.type==='order'?`<p class="shint">Touche les étiquettes dans le bon ordre.</p><div class="ord">${shuffleFor(d.i,q.items.length).map(k=>`<button class="oitem" data-k="${k}"><span class="onum"></span>${esc(q.items[k])}</button>`).join('')}</div><div class="obtns"><button class="big alt" id="ore">Recommencer</button><button class="big" id="ook" disabled>Valider</button></div>`:sw?`<div class="swipe"><div class="scard" id="scard"><div class="sart" style="background:${R(q.round).tint||'#ffe0e8'}">${artOf(q)}</div><div class="sname">${esc(q.name||'')} ${q.sub?`<small>· ${esc(q.sub)}</small>`:''}</div>${q.bio?`<p class="sbio">${esc(q.bio)}</p>`:''}<span class="stamp sl" style="color:${sw.left.color}">${esc(sw.left.stamp||sw.left.label)}</span><span class="stamp sr" style="color:${sw.right.color}">${esc(sw.right.stamp||sw.right.label)}</span></div></div><div class="sbtns">${os.map(o=>`<button class="sbtn" data-v="${o.v}">${o.icon}${esc(o.label)}</button>`).join('')}</div><p class="shint">Swipe la carte : à gauche ${esc(sw.left.label)}, à droite ${esc(sw.right.label)}</p>`:`<div class="popts${os.length===2?' two':''}">${os.map((o,k)=>`<button class="popt" data-v="${o.v}" style="--c:${COLS[k]}">${o.icon||`<span class="sh">${k+1}</span>`}<b>${esc(o.label)}</b></button>`).join('')}</div>`}</div></section>`;
  let chosen=!!d.done;
  const choose=v=>{if(chosen||!P.conn)return;chosen=true;P.conn.send({t:'ans',i:d.i,v});if(['number','cloud','order'].includes(q.type)){const e=$('#pq');if(e)e.innerHTML=sentBox()}
   document.querySelectorAll('.popt,.sbtn').forEach(x=>{x.disabled=true;if(x.dataset.v!==v)x.classList.add('dim');else x.classList.add('pick')});
   const c=$('#scard');if(c){c.style.transition='transform .35s ease-in';c.style.transform=`translateX(${v==='right'?640:-640}px) rotate(${v==='right'?28:-28}deg)`;const st=c.querySelector(v==='right'?'.sr':'.sl');if(st)st.style.opacity=1}};
  document.querySelectorAll('.popt,.sbtn').forEach(b=>b.onclick=()=>choose(b.dataset.v));
  const nf=$('#nform');if(nf){setTimeout(()=>{const i=$('#nv');if(i)i.focus()},50);nf.onsubmit=e=>{e.preventDefault();const n=Number($('#nv').value.replace(',','.').replace(/\s/g,''));if(!$('#nv').value.trim()||!Number.isFinite(n))return;choose(n)}}
  const cf=$('#cform');if(cf){cf.onsubmit=e=>{e.preventDefault();const w=$('#cv').value.trim();if(w)choose(w)}}
  if(q.type==='order'){let seq=[];const its=[...document.querySelectorAll('.oitem')],ok=$('#ook');
   const paint=()=>{its.forEach(b=>{const k=+b.dataset.k,pos=seq.indexOf(k);b.classList.toggle('on',pos>=0);b.querySelector('.onum').textContent=pos>=0?pos+1:''});if(ok)ok.disabled=seq.length!==its.length};
   its.forEach(b=>b.onclick=()=>{if(chosen)return;const k=+b.dataset.k;if(!seq.includes(k))seq.push(k);paint()});
   $('#ore').onclick=()=>{if(chosen)return;seq=[];paint()};ok.onclick=()=>{if(seq.length===its.length)choose(seq)}}
  const card=$('#scard');
  if(card){let sx=0,dx=0,drag=false;const sl=card.querySelector('.sl'),sr=card.querySelector('.sr');
   card.addEventListener('pointerdown',e=>{if(chosen)return;drag=true;sx=e.clientX;dx=0;try{card.setPointerCapture(e.pointerId)}catch(x){}card.style.transition='none'});
   card.addEventListener('pointermove',e=>{if(!drag)return;dx=e.clientX-sx;card.style.transform=`translateX(${dx}px) rotate(${dx/14}deg)`;sl.style.opacity=Math.min(1,Math.max(0,-dx/110));sr.style.opacity=Math.min(1,Math.max(0,dx/110))});
   const fin=()=>{if(!drag)return;drag=false;if(dx>90)choose('right');else if(dx<-90)choose('left');else{card.style.transition='transform .3s';card.style.transform='';sl.style.opacity=0;sr.style.opacity=0}};
   card.addEventListener('pointerup',fin);card.addEventListener('pointercancel',fin);}
  const up=()=>{const r=Math.max(0,end-Date.now());const c=$('#pcd'),t=$('#tb');if(c)c.textContent=Math.ceil(r/1000)+' s';if(t)t.style.width=(r/lim*100)+'%';if(r<=0){clearInterval(P.tick);chosen=true;document.querySelectorAll('.popt,.sbtn,#pq input,#pq button').forEach(x=>x.disabled=true)}};
  up();P.tick=setInterval(up,200);return;
 }
 if(d.t==='rev'){
  if(d.kind==='poll'||d.kind==='cloud'){app.innerHTML=phead(d.score)+`<section class="center">${good().replace('<svg','<svg class="hb"')}<h2>${d.ans?'Merci !':'Trop tard…'}</h2><p>Les réponses de la salle s’affichent sur le grand écran.</p></section>`;return}
  if(d.kind==='number'||d.kind==='order'){const ttl=!d.ans?W.late:d.gain>=800?W.correct:d.gain>0?(d.kind==='order'?'Presque !':'Pas loin !'):W.wrong;
   app.innerHTML=phead(d.score)+`<section class="center res ${d.gain>0?'good':'bad'}">${(d.gain>0?good():bad()).replace('<svg','<svg class="hb"')}<h2>${esc(ttl)}</h2>${d.gain>0?`<div class="gain">+${d.gain}</div>`:''}${d.ans?`<p>Ta réponse : <b>${esc(d.mine)}</b></p>`:''}<p>${d.kind==='order'?'Le bon ordre :':'La bonne réponse :'} <b>${esc(d.good)}</b></p><p class="rank">${d.rank}<sup>${d.rank===1?'er':'e'}</sup> sur ${d.total}</p></section>`;return}
  const ttl=!d.ans?W.late:d.ok?W.correct:W.wrong;
  app.innerHTML=phead(d.score)+`<section class="center res ${d.ok?'good':'bad'}">${(d.ok?good():bad()).replace('<svg','<svg class="hb"')}<h2>${esc(ttl)}</h2>${d.ok?`<div class="gain">+${d.gain}</div>`:`<p>La bonne réponse : <b>${esc(d.good)}</b></p>`}<p class="rank">${d.rank}<sup>${d.rank===1?'er':'e'}</sup> sur ${d.total}</p></section>`;return;
 }
 if(d.t==='end'){
  app.innerHTML=phead(d.score)+`<section class="center">${drawArt('trophee').replace('<svg','<svg class="pbig"')}<h2>${esc(d.rank===1?(QUIZ.winner||'Champion !'):d.rank<=3?W.podiumPlayer:W.endNeutral)}</h2><div class="gain">${d.score} pts</div><p class="rank">${d.rank}<sup>${d.rank===1?'er':'e'}</sup> sur ${d.total}</p></section>`;
 }
}

/* ---------- DÉMARRAGE ---------- */
const pc=new URLSearchParams(location.search).get('p');
const auto=new URLSearchParams(location.search).get('r')&&store.get('ql-nick');
if(pc&&/^\d{4}$/.test(pc)&&auto){P.code=pc;P.nick=store.get('ql-nick');try{P.av=avOk(JSON.parse(store.get(KEY+'av')))}catch(e){P.av=avOk(null)}playerConnect()}
else if(pc&&/^\d{4}$/.test(pc))joinForm(pc);else home();
