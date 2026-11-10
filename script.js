/* Treventure v2 - 1단계: 공통 게임 틀 (전환 · 버튼 반응 · HUD · 사운드 · 로딩) */
const S=[
 ["01_start.webp","시작 화면"],["02_intro.webp","메인 메뉴"],["03_character.png","캐릭터 선택"],["04_character_01.png","캐릭터 적용"],
 ["05_character_02.png","아이템 구매"],["06_mission_01.png","농산 코너 미션"],["07_mission_01_2.png","농산물 찾기"],["08_mission_01_3.png","농산 미션 성공"],
 ["09_mission_02.png","수산 코너 미션"],["10_mission_02_1.png","수산물 찾기"],["11_mission_02_2.png","수산 미션 성공"],["12_mission_03.png","과자 코너 미션"],
 ["13_mission_03_1.png","과자 상품 찾기"],["14_mission_03_2.png","과자 미션 성공"],["15_reward_01.png","히든 아이템 찾기"],["16_reward_02.png","히든 카드 보상"],
 ["17_reward_03.png","캐릭터 보상"],["18_result_01.png","영수증 스캔"],["19_result_02.png","보스 전투 1"],["20_result_03.png","보스 전투 2"],
 ["21_result_04.png","보스 전투 3"],["22_boss_clear.png","보스 퇴치 성공"],["23_ending_photo.png","미디어 큐브 송출"],["24_ending_album.png","추억의 앨범"]
];
const ROUTES={character:[2,3,4],media:["i23","i24"],boss:["i18","b:fight","i22"],zone:[5,6,7,8,9,10,11,12,13],hidden:[14,15,16]};
const DEFAULT={coins:60,hp:450,character:"남자 탐험가",items:[],completed:[],photoKeys:[]};
let state;try{state={...DEFAULT,...JSON.parse(localStorage.getItem("treventure-state")||"{}")};}catch{state={...DEFAULT};}
let screen=0,route=null,routePos=0,cameraPurpose=null,dbPromise;
const $=id=>document.getElementById(id);
const stage=$("stage"),world=$("world"),layer=$("hotspots"),toastEl=$("toast"),hudEl=$("hud"),coinN=$("coin-n"),hpEl=$("hp"),
 camera=$("camera-input"),bg=$("bg"),loader=$("loader"),bar=$("bar"),fx=$("fx"),imgs=[$("img-a"),$("img-b")];
let cur=1;coinN.textContent=state.coins;

/* ── 사운드 (파일 없이 코드로 생성) ── */
let ac,muted=localStorage.getItem("treventure-mute")==="1";
function tone(f,d,type="sine",v=.14,t=0,to){
 if(muted)return;
 try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.resume?.();
  const o=ac.createOscillator(),g=ac.createGain(),s=ac.currentTime+t;
  o.type=type;o.frequency.setValueAtTime(f,s);if(to)o.frequency.exponentialRampToValueAtTime(to,s+d);
  g.gain.setValueAtTime(v,s);g.gain.exponentialRampToValueAtTime(.001,s+d);
  o.connect(g).connect(ac.destination);o.start(s);o.stop(s+d);}catch{}
}
const sfx={tap:()=>tone(560,.07,"triangle"),
 coin:()=>{tone(988,.08,"square",.07);tone(1480,.16,"square",.07,.08);},
 hit:()=>tone(220,.22,"sawtooth",.18,0,50),
 win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.22,"triangle",.14,i*.11)),
 err:()=>tone(180,.15,"square",.08)};
function toggleSound(){muted=!muted;localStorage.setItem("treventure-mute",muted?"1":"0");if(muted)say("🔇 소리 꺼짐");else{sfx.coin();say("🔊 소리 켜짐");}}

/* ── 연출 도구 ── */
function say(m){toastEl.textContent=m;toastEl.classList.add("show");clearTimeout(say.t);say.t=setTimeout(()=>toastEl.classList.remove("show"),1800);}
function shake(){world.classList.remove("shake");void world.offsetWidth;world.classList.add("shake");}
function pop(txt,x,y,cls=""){const d=document.createElement("b");d.className="pop "+cls;d.textContent=txt;d.style.left=x+"%";d.style.top=y+"%";stage.appendChild(d);setTimeout(()=>d.remove(),1000);}
function flyCoins(n=6){
 sfx.coin();if(!hudOn)return;const to=hudEl.getBoundingClientRect(),sr=stage.getBoundingClientRect();
 for(let i=0;i<n;i++){
  const c=document.createElement("i");c.className="fcoin";c.textContent="T";stage.appendChild(c);
  const x0=sr.width*(.35+Math.random()*.3),y0=sr.height*(.55+Math.random()*.1);
  c.style.left=x0+"px";c.style.top=y0+"px";
  const dx=to.left+to.width*.1-sr.left-x0,dy=to.top+to.height/2-sr.top-y0;
  c.animate([{transform:"translate(0,0) scale(.4)",opacity:0},{transform:"translate(0,-40px) scale(1.1)",opacity:1,offset:.25},{transform:`translate(${dx}px,${dy}px) scale(.7)`,opacity:.9}],
   {duration:800,delay:i*70,easing:"cubic-bezier(.5,0,.8,.4)",fill:"both"}).onfinish=()=>c.remove();
 }
}
function countTo(v){
 const from=+coinN.textContent||0,t0=performance.now();cancelAnimationFrame(countTo.r);
 hudEl.classList.remove("bump");void hudEl.offsetWidth;hudEl.classList.add("bump");
 const step=t=>{const k=Math.min(1,(t-t0)/600);coinN.textContent=Math.round(from+(v-from)*(1-Math.pow(1-k,3)));if(k<1)countTo.r=requestAnimationFrame(step);};
 countTo.r=requestAnimationFrame(step);
}
for(let i=0;i<16;i++){const s=document.createElement("i");s.textContent="✦";
 s.style.cssText=`left:${Math.random()*96}%;top:${Math.random()*85}%;font-size:${10+Math.random()*18}px;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*2}s`;fx.appendChild(s);}
layer.addEventListener("pointerdown",e=>{
 const b=e.target.closest(".hotspot");if(!b)return;
 const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height)*1.3,s=document.createElement("span");
 s.className="rip";s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
 b.appendChild(s);setTimeout(()=>s.remove(),520);sfx.tap();navigator.vibrate?.(12);
});

/* ── 저장 ── */
function openDB(){
 if(!("indexedDB" in window))return Promise.resolve(null);
 if(!dbPromise)dbPromise=new Promise((res,rej)=>{const q=indexedDB.open("TreventureDB",1);
  q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains("photos"))db.createObjectStore("photos",{keyPath:"id",autoIncrement:true});};
  q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
 return dbPromise;
}
async function storePhoto(file,purpose){
 try{const db=await openDB();
  if(db){const id=await new Promise((res,rej)=>{const q=db.transaction("photos","readwrite").objectStore("photos").add({blob:file,purpose,createdAt:Date.now()});q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
   state.photoKeys.push({id,purpose,createdAt:Date.now()});persist();return;}
 }catch(e){console.warn(e);}
 state.photoKeys.push({purpose,createdAt:Date.now(),data:await compressToDataURL(file)});persist();
}
async function compressToDataURL(file){
 const b=await createImageBitmap(file),k=Math.min(1,1000/Math.max(b.width,b.height)),c=document.createElement("canvas");
 c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);c.getContext("2d").drawImage(b,0,0,c.width,c.height);b.close?.();return c.toDataURL("image/jpeg",.68);
}
function persist(){localStorage.setItem("treventure-state",JSON.stringify(state));renderHud();}

/* ── HUD ── */
function renderHud(){
 hudEl.style.display=hudOn?"flex":"none";
 if(+coinN.textContent!==state.coins&&hudOn)countTo(state.coins);
 const boss=false;hpEl.style.display=boss?"block":"none";
 hpEl.firstElementChild.style.width=state.hp/450*100+"%";hpEl.lastElementChild.textContent="보스 HP "+state.hp;
}

/* ── 화면 전환 + 게임 장면 (3~24번 화면을 코드로 재구성) ── */
const ui=$("ui");
const RT={character:["i03","i04","i05"],zone:["i06","i07","i08","i09","i10","i11","i12","i13","i14"],hidden:["i15","i16","i17"],boss:["i18","b:fight","i22","i25","club"],media:["i23","i24"]};
const Z={produce:["🥬","농산","신선한 채소와 과일 코너에서 오늘의 재료를 찾아 찍어요"],seafood:["🐟","수산","수산 코너에서 싱싱한 해산물을 찾아 찍어요"],snack:["🍪","과자","과자 코너에서 가족이 좋아하는 간식을 찾아 찍어요"]};
const P={i07:"produce-mission",i10:"seafood-mission",i13:"snack-mission",i15:"hidden-item",i18:"receipt",i23:"family-memory"};
const REW={"produce-mission":1,"seafood-mission":1,"snack-mission":1,"hidden-item":2};
const ITEMS=[["신발","👟",10],["헤드셋","🎧",10],["비눗방울","🫧",15]];
let key="",pos=0;
const btn=(a,t,v="")=>`<button class="btn go" data-a="${a}" data-v="${v}">${t}</button>`;
const head=(t,s)=>`<h2>${t}</h2><p class="sub">${s}</p>`;
const chr=w=>`<img class="chr" src="assets/characters/${w||(state.character==="여자 탐험가"?"girl":"boy")}.webp" alt="">`;
const AV=()=>`<div class="av">${chr()}<div class="gear">${ITEMS.filter(i=>state.items.includes(i[0])).map(i=>i[1]).join(" ")}</div></div>`;
const shoot=(e,t,s)=>head(t,s)+`<div class="hero">${e}</div>`+btn("shoot","📷 사진 찍기");
const V={
 pick:()=>head("탐험가를 골라요","함께 떠날 대원을 선택하세요")+`<div class="row">${[["남자 탐험가","👦"],["여자 탐험가","👧"]].map(([n,e])=>`<button class="pc ${state.character===n?"sel":""}" data-a="pick" data-v="${n}"><i>${e}</i>${n}</button>`).join("")}</div>`+btn("next","선택하기"),
 shop:()=>head("탐험 장비 상점","T코인으로 장비를 사서 꾸며요")+AV()+`<div class="row">${ITEMS.map(([n,e,c])=>`<button class="it ${state.items.includes(n)?"own":""}" data-a="buy" data-v="${n}"><i>${e}</i>${n}<small>${state.items.includes(n)?"✓ 보유":"🪙 "+c}</small></button>`).join("")}</div>`+btn("menu","꾸미기 끝!"),
 m:k=>shoot(Z[k][0],Z[k][1]+" 코너 미션",Z[k][2]),
 ok:k=>head("미션 성공!",Z[k][1]+" 코너를 클리어했어요")+`<div class="stars">${[0,1,2].map(i=>`<span style="animation-delay:${i*.25}s">⭐</span>`).join("")}</div><div class="reward">🪙 +10 T코인</div>`+btn("next",k==="snack"?"미션 완료":"다음 미션"),
 h:a=>a==="find"?shoot("🔍","히든 아이템 수집","매장 곳곳에 숨은 T 마크 아이템을 찾아 찍어요"):a==="card"?head("히든 카드 획득!","+2 T코인과 특별 카드를 얻었어요")+`<div class="fcard">🃏</div>`+btn("next","다음"):head("캐릭터 보상","히든 카드로 탐험가 뱃지가 열렸어요")+AV()+`<div class="reward">🎖️ 탐험가 뱃지</div>`+btn("menu","메인으로"),
 b:a=>a==="scan"?shoot("🧾","영수증 보스 퇴치","영수증을 찍으면 보스가 나타나요"):a==="fight"?`<div class="bf"><div class="beams"></div>${[8,22,38,55,70,86].map((x,i)=>`<i class="rcf" style="left:${x}%;animation-delay:${i*.7}s">🧾</i>`).join("")}<div class="bhud"><div class="bav" style="background-image:url(assets/characters/golem.webp)"></div><div class="bname"><div><b>영수증 골렘</b><em>Lv.5</em></div><div class="bbar"><i id="bhp" style="width:${state.hp/4.5}%"></i><span id="bt">HP ${state.hp}</span></div></div></div><img id="boss" class="golem" src="assets/characters/golem.webp" alt="영수증 골렘"><div class="fx2" id="bfx"></div><img class="pl l" src="assets/characters/boy.webp" alt=""><img class="pl r" src="assets/characters/girl.webp" alt=""><button class="atk" data-a="attack"><span>⚔️</span>공격!</button></div>`:head("보스 퇴치 성공!","영수증 괴물이 사라졌어요")+`<div class="duo jump">${chr("boy")}${chr("girl")}</div><div class="reward">🪙 +5 T코인</div>`+btn("menu","메인으로"),
 v:a=>a==="shoot"?shoot(chr(),"미디어 큐브 송출","가족 사진을 찍어 큐브에 띄워요"):a==="cast"?head("송출 중...","가족 사진을 미디어 큐브로 보내고 있어요")+`<div class="duo">${chr()}<div class="hero" style="font-size:24cqw;margin:0">🧊</div></div><div class="pbar"><i id="pb"></i></div>`:head("추억의 앨범","오늘의 가족 사진")+`<div class="grid" id="grid"></div>`+btn("menu","메인으로")
};
function goUi(k,quiet){
 key=k;screen=2;setHud("def");stage.dataset.mode="ui";stage.dataset.fx="off";
 if(!quiet){ui.classList.remove("ui");void ui.offsetWidth;ui.classList.add("ui");}
 const[a,b]=k.split(":");ui.innerHTML=`<button class="back" data-a="menu" aria-label="메인으로">‹</button>`+V[a](b);setHud(k==="b:fight"?null:"def");renderHud();
 if(quiet)return;
 if(a==="ok"||k==="b:clear"||k==="h:card")setTimeout(confetti,300);
 if(k==="v:cast"){setTimeout(()=>{const p=$("pb");if(p)p.style.width="100%";},60);setTimeout(()=>{if(key==="v:cast"){sfx.win();next();}},2800);}
 if(k==="v:album")loadAlbum();
}
function start(n){route=n;pos=0;if(n==="boss")state.hp=450;go(RT[n][0]);}
function next(){if(!route)return showImg(1);const r=RT[route];if(++pos<r.length)go(r[pos]);else{route=null;showImg(1);}}
function buy(name,cost){
 if(state.items.includes(name)){sfx.err();return say("이미 가지고 있는 아이템이에요.");}
 if(state.coins<cost){sfx.err();navigator.vibrate?.([30,40,30]);return say("T코인이 부족해요.");}
 state.coins-=cost;state.items.push(name);persist();sfx.coin();pop("-"+cost,50,45,"dmg");say(name+" 구매 완료!");
}
function attack(){
 if(attack.lock)return;attack.lock=true;setTimeout(()=>attack.lock=false,700);
 state.hp=Math.max(0,state.hp-150);sfx.hit();navigator.vibrate?.(40);
 const g=$("boss"),f=$("bfx"),w=ui.querySelector(".bf");if(!g||!f||!w)return;
 [[w,"slam"],[g,"hit"]].forEach(([e,c])=>{e.classList.remove(c);void e.offsetWidth;e.classList.add(c);});
 const d=document.createElement("b");d.className="dmg";d.textContent="-HP 150";f.appendChild(d);setTimeout(()=>d.remove(),900);
 for(let i=0;i<9;i++){const r=document.createElement("i");r.className="rc";r.textContent="🧾";f.appendChild(r);
  r.animate([{transform:"translate(0,0) scale(.5) rotate(0)",opacity:1},{transform:`translate(${(Math.random()-.5)*70}cqw,${-10-Math.random()*40}cqw) scale(1.1) rotate(${Math.random()*540}deg)`,opacity:0}],{duration:800+Math.random()*400,easing:"ease-out"}).onfinish=()=>r.remove();}
 $("bhp").style.width=state.hp/4.5+"%";$("bt").textContent="HP "+state.hp;
 if(!state.hp){state.coins+=5;g.classList.remove("hit");g.classList.add("dead");persist();setTimeout(()=>{sfx.win();next();},1150);}else persist();
}
const A={next,menu(){route=null;showImg(1);},
 pick(v){state.character=v;persist();sfx.coin();ui.querySelectorAll(".pc").forEach(c=>c.classList.toggle("sel",c.dataset.v===v));},
 buy(v){buy(v,ITEMS.find(x=>x[0]===v)[2]);go(key,true);},
 shoot(){capture(P[key]);},attack};
ui.addEventListener("click",e=>{const b=e.target.closest("[data-a]");if(!b)return;sfx.tap();navigator.vibrate?.(12);A[b.dataset.a]?.(b.dataset.v);});
function confetti(){
 sfx.win();const h=stage.getBoundingClientRect().height;
 for(let i=0;i<36;i++){const c=document.createElement("i");c.className="cf";c.style.cssText=`left:${Math.random()*100}%;background:${["#d9ff22","#ffe27a","#ff7a59","#7fe3ff","#fff"][i%5]}`;stage.appendChild(c);
  c.animate([{transform:"translateY(-20px) rotate(0)",opacity:1},{transform:`translateY(${h*(.6+Math.random()*.4)}px) rotate(${Math.random()*720}deg)`,opacity:.9}],{duration:1400+Math.random()*1200,delay:Math.random()*300,easing:"ease-in"}).onfinish=()=>c.remove();}
}
async function loadAlbum(){
 let urls=[];
 try{const db=await openDB();if(db)urls=(await new Promise((r,j)=>{const q=db.transaction("photos").objectStore("photos").getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);})).filter(p=>p.purpose==="family-memory").map(p=>URL.createObjectURL(p.blob));}catch{}
 state.photoKeys.filter(p=>p.data&&p.purpose==="family-memory").forEach(p=>urls.push(p.data));
 const g=$("grid");if(g)g.innerHTML=urls.length?urls.map(u=>`<img src="${u}" alt="가족 사진">`).join(""):"<p class='sub'>아직 사진이 없어요. 미디어 큐브에서 촬영해 보세요!</p>";
}
/* 사진 촬영 → 저장 → 보상 → 다음 장면 */
function finish(p){
 if(REW[p]){state.coins+=REW[p];flyCoins();}
 if(p==="hidden-item"&&!state.items.includes("히든 카드"))state.items.push("히든 카드");
 if(p==="receipt")sfx.hit();
 persist();next();
}
function snapFx(cb){
 if(snapFx.lock)return;snapFx.lock=true;setTimeout(()=>snapFx.lock=false,900);
 const f=document.createElement("div");f.className="flash";stage.appendChild(f);setTimeout(()=>f.remove(),600);
 tone(1900,.04,"square",.06);tone(950,.07,"square",.06,.05);navigator.vibrate?.(25);setTimeout(cb,450);
}
function capture(p){snapFx(()=>finish(p));}
function toggleCam(){state.cam=!state.cam;persist();say(state.cam?"📷 사진 촬영 켜짐":"📷 사진 촬영 꺼짐 (버튼만 눌러도 다음으로 넘어가요)");}
camera.addEventListener("change",async()=>{
 const f=camera.files&&camera.files[0];if(!f)return;
 if(!f.type.startsWith("image/")){say("이미지 파일을 선택해 주세요.");return;}
 const p=cameraPurpose;cameraPurpose=null;
 try{await storePhoto(f,p);}catch(e){console.warn(e);say("사진 저장 공간이 부족할 수 있어요.");}
 finish(p);
});
/* ── 원본 화면(WebP) + 피그마 버튼 영역 ── */
const px=r=>[r[0]/8.04,r[1]/17.48,r[2]/8.04,r[3]/17.48];
let hudOn=true;
function setHud(r){hudOn=r!==null;const t=hudEl.style;if(r&&r!=="def"){t.left=r[0]/8.04+"%";t.top=r[1]/17.48+"%";t.width=r[2]/8.04+"%";t.height=r[3]/17.48+"%";}else t.left=t.top=t.width=t.height="";}
const NX=[75,1345,650,170];
const SCR={
 i03:{f:"03_character",h:[583,18,208,68],b:[[10,10,105,90],"menu"],hs:[["남자 탐험가",[60,968,330,425],"sel:남자 탐험가"],["여자 탐험가",[425,968,320,425],"lock:여자 탐험가"],["선택하기",[140,1468,525,140],"next"]]},
 i04:{f:"04_character_01",h:[568,20,220,70],b:[[20,8,95,85],"back"],hs:[["아이템 탭",[420,820,340,95],"go:i05"],["기본 탐험가",[55,968,230,420],"say:기본 탐험가로 입었어요!"],["요리사",[298,968,218,420],"lock:요리사"],["선장",[532,968,220,420],"lock:선장"],["적용하기",[145,1455,515,130],"next"]]},
 i05:{f:"05_character_02",h:[568,22,220,70],b:[[25,15,95,95],"back"],hs:[["옷 탭",[35,818,360,100],"go:i04"],["신발",[30,975,255,380],"say:신발은 이미 착용 중이에요!"],["헤드셋",[292,980,228,375],"lock:헤드셋"],["비눗방울",[535,980,235,375],"lock:비눗방울"],["구매하기",[145,1450,515,150],"menu:🔒 잠긴 아이템은 아직 구매할 수 없어요"]]},
 i06:{f:"06_mission_01",b:[[30,70,125,120],"menu"],hs:[["미션 시작",[95,1440,615,170],"next"]]},
 i07:{f:"07_mission_01_2",b:[[20,25,115,110],"back"],hs:[["사진 촬영",[88,1240,630,145],"cam"]]},
 i08:{f:"08_mission_01_3",b:[[25,32,115,110],"menu"],hs:[["다음 단계",NX,"next"]]},
 i09:{f:"09_mission_02",b:[[20,25,115,110],"menu"],hs:[["미션 시작",[80,1415,645,175],"next"]]},
 i10:{f:"10_mission_02_1",b:[[28,30,115,110],"back"],hs:[["사진 촬영",[92,1298,660,155],"cam"]]},
 i11:{f:"11_mission_02_2",b:[[25,32,115,110],"menu"],hs:[["다음 단계",NX,"next"]]},
 i12:{f:"12_mission_03",b:[[20,20,115,110],"menu"],hs:[["미션 시작",[92,1455,615,175],"next"]]},
 i13:{f:"13_mission_03_1",b:[[25,30,115,110],"back"],hs:[["사진 촬영",[88,1238,630,148],"cam"]]},
 i14:{f:"14_mission_03_2",b:[[25,32,115,110],"menu"],hs:[["다음 단계",NX,"next"]]},
 i15:{f:"15_reward_01",b:[[15,10,125,125],"menu"],hs:[["사진 촬영",[58,1410,685,200],"cam"]]},
 i16:{f:"16_reward_02",hs:[["장착하기",[100,1328,600,165],"next"]]},
 i17:{f:"17_reward_03",b:[[28,24,125,120],"menu"],hint:"화면을 눌러 계속",hs:[["계속",[0,150,804,1598],"next"]]},
 i18:{f:"18_result_01",b:[[15,20,135,115],"menu"],hs:[["영수증 촬영",[38,1440,740,180],"cam"]]},
 i22:{f:"22_boss_clear",b:[[0,25,115,115],"menu"],hs:[["다음 단계",[15,1495,765,175],"next"]]},
 i23:{f:"23_ending_photo",b:[[22,15,105,105],"menu"],hs:[["셔터",[318,1492,168,172],"shutter","round"]]},
 i25:{f:"25_membership_reward",b:[[24,20,115,100],"menu"],hs:[["트레이더스 클럽 혜택 확인하기",[38,1490,735,160],"next"]]},
 i24:{f:"24_ending_album",b:[[15,55,110,100],"menu"],hs:[]}
};
const CHK={};
const LOCK={i03:[[425,968,320,425]],i04:[[298,968,218,420],[532,968,220,420]],i05:[[292,980,228,375],[535,980,235,375]]};
function go(k,q){
 if(k==="club")return showClub();
 const d=SCR[k];if(!d)return goUi(k,q);
 key=k;screen=2;stage.dataset.mode="img";stage.dataset.fx="off";setHud(d.h||null);
 swap("assets/screens/"+d.f+".webp","Treventure "+k);layer.innerHTML="";
 d.hs.forEach(([l,r,a,c])=>add(l,px(r),()=>act(a),c||""));
 if(d.b)add("뒤로",px(d.b[0]),()=>act(d.b[1]));
 if(d.hint){const h=document.createElement("div");h.className="hint";h.textContent=d.hint;layer.appendChild(h);}
 marks();renderHud();
 if(["i08","i11","i14","i16","i22","i25"].includes(k))setTimeout(confetti,350);
 if(k==="i19"||k==="i20")hpCover();
}
function deco(c,r,t=""){const e=document.createElement("i");e.className=c;e.textContent=t;const q=px(r);e.style.cssText=`left:${q[0]}%;top:${q[1]}%;width:${q[2]}%;height:${q[3]}%`;layer.appendChild(e);}
function marks(){
 layer.querySelectorAll(".chk,.ring,.lockv").forEach(e=>e.remove());
 if(key==="i03"){state.character="남자 탐험가";deco("ring",[60,968,330,425]);}
 (LOCK[key]||[]).forEach(r=>deco("lockv",r,"🔒"));
 (CHK[key]||[]).forEach(([n,p])=>{if(state.items.includes(n))deco("chk",[p[0]-30,p[1]-30,60,60],"✓");});
}
function act(a){
 const[p,x,y]=a.split(":");
 if(p==="next")next();else if(p==="menu"){if(x)say(x);A.menu();}else if(p==="back")back();
 else if(p==="cam")capture(P[key]);
 else if(p==="shutter")shutter();
 else if(p==="go"){pos=RT[route].indexOf(x);go(x);}
 else if(p==="say")say(x);
 else if(p==="lock"){sfx.err();navigator.vibrate?.([30,40,30]);say("🔒 "+x+"은(는) 잠겨 있어서 적용할 수 없어요");}
 else if(p==="sel"){state.character=x;persist();sfx.coin();say(x+"를 선택했어요.");marks();}
 else if(p==="buy"){buy(x,+y);marks();}
 else if(p==="hit")bossHit();
}
function back(){if(route&&pos>0){pos--;go(RT[route][pos]);}else A.menu();}
function hpCover(){
 let c=$("hpc");if(!c){c=document.createElement("i");c.id="hpc";c.className="hpc";layer.appendChild(c);}
 const r=state.hp/450,L=182+600*r,q=px([L,122,782-L,64]);c.style.cssText=`left:${q[0]}%;top:${q[1]}%;width:${q[2]}%;height:${q[3]}%`;
}
function bossHit(){
 if(attack.lock)return;attack.lock=true;setTimeout(()=>attack.lock=false,650);
 state.hp=Math.max(0,state.hp-150);sfx.hit();navigator.vibrate?.(40);shake();hpCover();
 if(state.hp>0&&key==="i19"){persist();setTimeout(next,520);}
 else if(state.hp>0){pop("-150",50,26,"dmg");persist();}
 else{state.coins+=5;persist();setTimeout(()=>{sfx.win();next();},700);}
}
const SEASON=m=>m>=3&&m<=5?0:m>=6&&m<=8?1:m>=9&&m<=11?2:3;
const SLOT=[[97,338,305,402],[446,338,320,402],[97,915,305,402],[446,915,320,402]];
const DATE=[[186,808,165,34],[546,808,170,34],[186,1385,170,34],[543,1385,170,34]];
async function fillAlbum(){
 let list=[];
 try{const db=await openDB();if(db)list=(await new Promise((r,j)=>{const q=db.transaction("photos").objectStore("photos").getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);})).filter(p=>p.purpose==="family-memory").map(p=>({t:p.createdAt,u:URL.createObjectURL(p.blob)}));}catch{}
 state.photoKeys.filter(p=>p.data&&p.purpose==="family-memory").forEach(p=>list.push({t:p.createdAt,u:p.data}));
 if(key!=="i24")return;
 const best={};list.sort((a,b)=>a.t-b.t).forEach(p=>{best[SEASON(new Date(p.t).getMonth()+1)]=p;});
 Object.entries(best).forEach(([s,p])=>{
  const d=new Date(p.t),ds=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
  const im=document.createElement("img");im.className="ph";im.src=p.u;im.alt="가족 사진";let q=px(SLOT[s]);im.style.cssText=`left:${q[0]}%;top:${q[1]}%;width:${q[2]}%;height:${q[3]}%`;layer.appendChild(im);
  const t=document.createElement("b");t.className="dt";t.textContent=ds;q=px(DATE[s]);t.style.cssText=`left:${q[0]}%;top:${q[1]}%;width:${q[2]}%;height:${q[3]}%`;layer.appendChild(t);
 });
}

/* ── 미디어 큐브: 셔터 → 번쩍 → 추억의 앨범(원본 이미지) ── */
function shutter(){snapFx(()=>finish("family-memory"));}
/* 시작·메인 메뉴 (원본 사용) */
function swap(src,alt){const a=imgs[cur],b=imgs[1-cur];b.src=src;b.alt=alt;b.className="screen-image in";a.className="screen-image out";cur=1-cur;bg.style.backgroundImage=`url(${src})`;}
function showImg(n){
 screen=n;stage.dataset.mode="img";stage.dataset.fx="on";setHud(n===1?"def":null);swap("assets/screens/"+S[n][0],"Treventure "+S[n][1]);
 document.title=S[n][1]+" | Treventure";renderHotspots();persist();
}
function add(label,r,fn,cls=""){const b=document.createElement("button");b.type="button";b.className="hotspot "+cls;b.setAttribute("aria-label",label);b.title=label;b.style.cssText=`left:${r[0]}%;top:${r[1]}%;width:${r[2]}%;height:${r[3]}%`;b.addEventListener("click",fn);layer.appendChild(b);}
function ping(x,y){const p=document.createElement("i");p.className="ping";p.style.left=x+"%";p.style.top=y+"%";layer.appendChild(p);}
function renderHotspots(){
 layer.innerHTML="";
 if(screen===0){add("탐험 시작",[15.5,80,70.5,9.4],()=>{sfx.win();showImg(1);},"pill glow");add("앱으로 돌아가기",px([28,40,190,66]),goApp,"exit");layer.lastChild.textContent="‹ 트레이더스";return;}
 add("나의 캐릭터 꾸미기",[0,51.5,44.2,20.3],()=>start("character"),"round glow");
 add("구역 미션",[70.9,47.8,24.6,11.2],()=>start("zone"),"round");
 add("히든 아이템 수집",[66.5,59.8,29.3,12.7],()=>start("hidden"),"round");
 add("미디어 큐브 송출",[12.4,72.2,31.8,14.2],()=>start("media"),"round");
 add("영수증 보스 퇴치",[46,70.3,31,12.9],()=>start("boss"),"round");
 add("환경설정(소리)",[80.2,83.8,14.9,7.5],toggleSound,"round");
 add("설정(소리)",[87.7,2.7,8.3,3.7],toggleSound,"round");
 ping(35.2,55.5);ping(90.4,62);
}
window.addEventListener("keydown",e=>{if(stage.dataset.mode==="home")return;if(e.key==="Escape"||e.key==="ArrowLeft"){route=null;screen===0?goApp():showImg(screen===1?0:1);}});
const loaded=new Set();
const preload=i=>new Promise(r=>{if(loaded.has(i))return r();const im=new Image();im.onload=im.onerror=()=>{loaded.add(i);r();};im.src="assets/screens/"+S[i][0];});
const homeEl=$("home"),clubEl=$("club");
function showClub(){key="club";screen=2;stage.dataset.mode="club";setHud(null);document.title="TRADERS CLUB 안내";clubEl.querySelector(".cl-scroll").scrollTop=0;renderHud();}
clubEl.addEventListener("click",e=>{
 if(e.target.closest("[data-back]")){sfx.tap();back();}
 else if(e.target.closest("[data-home]")){sfx.tap();route=null;goApp();}
 else if(e.target.closest("#cl-join")){sfx.coin();say("🎫 가입은 실제 트레이더스 앱에서 진행돼요");}
});
function goApp(){route=null;screen=0;stage.dataset.mode="home";setHud(null);document.title="TRADERS";homeEl.querySelector(".hscroll").scrollTop=0;renderHud();}
function launchGame(){
 if(launchGame.on)return;launchGame.on=true;
 const tx=$("ltxt"),tips=["탐험 준비 중...","트레이더스 매장으로 이동 중...","가족 탐험대 합류 중..."],t0=performance.now();
 loader.classList.remove("hide");bar.style.width="0%";
 const tick=t=>{const k=Math.min(1,(t-t0)/2600);bar.style.width=100*(1-(1-k)*(1-k))+"%";tx.textContent=tips[Math.min(2,Math.floor(k*3))];
  if(k<1)requestAnimationFrame(tick);else Promise.all([preload(0),preload(1)]).then(()=>{showImg(0);setTimeout(()=>{loader.classList.add("hide");launchGame.on=false;},200);});};
 requestAnimationFrame(tick);
}
homeEl.addEventListener("click",e=>{
 if(e.target.closest("[data-go]")){sfx.coin();navigator.vibrate?.(15);launchGame();}
 else if(e.target.closest(".ic,.hnav button")){sfx.tap();say("🎮 트레벤처 아이콘을 눌러 게임을 시작해보세요!");}
});
(()=>{preload(0);preload(1);goApp();setTimeout(()=>Object.values(SCR).forEach((d,i)=>setTimeout(()=>{new Image().src="assets/screens/"+d.f+".webp";},i*300)),2500);})();

/* ── 앱처럼 보이기: 화면비가 비슷하면 꽉 채우고, 아니면 비율 유지 ── */
let FILL=.3;   // 폰 화면 비율이 게임과 이 비율(30%) 이내로 다르면 화면을 꽉 채움 (0.07로 줄이면 비율 유지)
function fit(){
 const w=innerWidth,h=innerHeight,r=804/1748,phone=w<=600;let W=Math.min(w,h*r),H=W/r;
 if(phone&&(["home","club"].includes(stage.dataset.mode)||Math.abs(w/h-r)/r<=FILL)){W=w;H=h;}
 stage.style.width=W+"px";stage.style.height=H+"px";
}
new MutationObserver(fit).observe(stage,{attributes:true,attributeFilter:["data-mode"]});
addEventListener("resize",fit);addEventListener("orientationchange",fit);fit();
addEventListener("pointerdown",()=>{try{if(!document.fullscreenElement&&matchMedia("(pointer:coarse)").matches)document.documentElement.requestFullscreen?.({navigationUI:"hide"}).catch(()=>{});}catch{}},{once:true});
if(/iPhone|iPad/.test(navigator.userAgent)&&!navigator.standalone&&!localStorage.getItem("treventure-hint"))setTimeout(()=>{say("공유 버튼 → ‘홈 화면에 추가’로 앱처럼 쓸 수 있어요");localStorage.setItem("treventure-hint","1");},3000);
