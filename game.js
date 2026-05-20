const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d', {alpha:false});
const gw = document.getElementById('gw');
const overlayEl = document.getElementById('overlay');
const toastEl = document.getElementById('toast');
const bonusEl = document.getElementById('bonus');
const factEl = document.getElementById('fact');
const scoreEl = document.getElementById('hsc');
const timeEl = document.getElementById('htime');
const progressEl = document.getElementById('pfill');
const gridCanvas = document.createElement('canvas');
const gridCtx = gridCanvas.getContext('2d');
let viewW = 0, viewH = 0, dpr = 1;

function resize() {
  viewW = gw.clientWidth;
  viewH = gw.clientHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  buildGridLayer();
  ship.x = Math.max(0, Math.min(W()-ship.w, ship.x));
  ship.y = Math.min(H()-ship.h-28, H()*0.72);
}

const W = () => viewW;
const H = () => viewH;

let gs = 'menu', score = 0, frame = 0, dist = 0;
const BASE_GOAL = 9800;
const BASE_FPS = 240;
const MAX_DT = 1 / 30;
const START_TIME = 35;
const BONUS_SCORE_STEP = 400;
const BONUS_TIME = 5;

let ship = {x:0,y:0,w:34,h:46,hp:3,inv:0,trail:[]};
let obstacles = [], buoys = [], sparks = [], waveRings = [];
let scrollSpeed = 1.4;
let timeLeft = START_TIME, nextBonusScore = BONUS_SCORE_STEP, missionGoal = BASE_GOAL;
let nextObsFrame = 195, nextBuoyFrame = 155, hudFrame = 0, lastPct = -1, lastScore = -1, lastTimeText = '';
resize();
window.addEventListener('resize', resize);

const keys = {};
window.addEventListener('keydown', e => { keys[e.key]=true; e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.key]=false; });

let mx = -999;
function setPointerX(clientX) {
  const r = gw.getBoundingClientRect();
  mx = clientX - r.left;
}
function isUiTouch(e) {
  return e.target.closest('button, #overlay');
}
gw.addEventListener('mousemove', e => {
  setPointerX(e.clientX);
});
gw.addEventListener('mouseleave', () => { mx = -999; });
gw.addEventListener('touchstart', e => {
  if (gs !== 'play' || isUiTouch(e)) return;
  setPointerX(e.touches[0].clientX);
  e.preventDefault();
}, {passive:false});
gw.addEventListener('touchmove', e => {
  if (gs !== 'play' || isUiTouch(e)) return;
  setPointerX(e.touches[0].clientX);
  e.preventDefault();
}, {passive:false});
gw.addEventListener('touchend', () => { mx = -999; });
document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
  if(document.hidden) mx = -999;
});

const FACTS = [
  'ERA5: Tekanan MSL 1007 hPa pada 8 Dis 1941',
  'GEBCO 2024: Kedalaman 1941 ~2.1m di KPA',
  'UHSLC: Disember = bulan paras laut tertinggi',
  'CWL = pasang surut + gelombang angin + barometer',
  'Monsun NE: Angin 7.2 m/s menuju pantai',
  'Draf Daihatsu: 0.8-1.1m | Kelonggaran: +0.71m',
  'Serangan pertama Perang Pasifik - 82 min sebelum Pearl Harbor!',
  'Paleo-batimetri: 83 tahun hakisan dibalik semula',
  'GIS: GCS WGS 1984, UTM Zon 47N, EPSG:32647',
  'Kapal pendaratan Jepun: Takumi Detachment',
];
let fi = 0, toastT = 0, bonusT = 0, factT = 0, factNext = 180;

function showToast(txt, dur=90) {
  toastEl.textContent = txt;
  toastEl.style.opacity = '1';
  toastT = dur;
}
function showBonus(txt, dur=170) {
  bonusEl.textContent = txt;
  bonusEl.classList.add('show');
  bonusT = dur;
}
function showFact() {
  factEl.textContent = 'DATA: ' + FACTS[fi++ % FACTS.length];
  factEl.style.opacity = '1';
  factT = 130;
}

function spawnObs(yOff) {
  const y = yOff || -80;
  const big = Math.random() < 0.5;
  const side = Math.random() < 0.5;
  const cx = side ? W()*0.08 + Math.random()*W()*0.28 : W()*0.64 + Math.random()*W()*0.28;
  obstacles.push({x: cx, y, w: big?80+Math.random()*70:50+Math.random()*50, h: big?28+Math.random()*36:18+Math.random()*26, type: Math.random()<0.65?'sand':'rock'});
  if (Math.random() < 0.35) {
    obstacles.push({x: W()*0.22+Math.random()*W()*0.56, y: y-50, w:44+Math.random()*44, h:16+Math.random()*20, type:'rock'});
  }
}
function spawnBuoy(yOff) {
  const types = ['ERA5','GEBCO','UHSLC','CWL','GIS'];
  const cols = {ERA5:'#f4b520',GEBCO:'#00c6f8',UHSLC:'#00e887',CWL:'#ff8c42',GIS:'#c47fff'};
  const t = types[Math.floor(Math.random()*types.length)];
  buoys.push({x: W()*0.12 + Math.random()*W()*0.76, y: yOff||-20, r:11, type:t, col:cols[t], p:Math.random()*6.28, collected:false});
}
function spawnSparks(x,y,col,n=8) {
  for(let i=0;i<n;i++){
    const a = Math.random()*6.28, s = 1.2+Math.random()*2.8;
    sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:28,col});
  }
}

function startGame() {
  overlayEl.style.display='none';
  gs='play'; score=0; frame=0; dist=0; scrollSpeed=1.4; missionGoal=BASE_GOAL;
  timeLeft=START_TIME; nextBonusScore=BONUS_SCORE_STEP;
  nextObsFrame=195; nextBuoyFrame=155; hudFrame=0; lastPct=-1; lastScore=-1; lastTimeText='';
  ship.x = W()/2 - ship.w/2;
  ship.y = H()*0.72;
  ship.hp=3; ship.inv=0; ship.trail=[];
  obstacles=[]; buoys=[]; sparks=[]; waveRings=[];
  for(let i=0;i<5;i++) spawnObs(-(i+1)*260);
  for(let i=0;i<4;i++) spawnBuoy(-(i+1)*200-60);
  fi=0; factNext=200;
  updateHud(true);
  showFact();
}
document.getElementById('startBtn').onclick = startGame;

function endGame(won, reason) {
  gs = won?'win':'dead';
  const ol = overlayEl;
  ol.style.display = 'flex';
  const scoreMsg = `Skor: ${score}`;
  if (won) {
    ol.innerHTML = `
      <h1 style="color:#00e887">MISI BERJAYA!</h1>
      <div class="sub">KUALA PAK AMAT DICAPAI - 8 DIS 1941 - 00:30 HRS</div>
      <div class="story">
        <p>Anda berjaya mengemudi perairan Kelantan - seperti yang dilakukan tentera Jepun 83 tahun lalu. <span class="hi">Paras Air Kompaun +1.81m</span> memberikan kedalaman yang mencukupi melebihi draf 1.1m.</p>
        <p>Inilah kebenaran hidrodinamik yang sistem kami rekonstruksi. <span class="hi">Geomatik memelihara apa yang hampir diambil laut.</span></p>
        <div class="fact">${scoreMsg}</div>
      </div>
      <div class="sdgr">
        <div class="sp" style="background:#fd9d24">SDG 11 OK</div>
        <div class="sp" style="background:#0a97d9">SDG 14 OK</div>
        <div class="sp" style="background:#c5192d">SDG 4 OK</div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="gbtn" onclick="startGame()">MAIN SEMULA</button>
        <button class="gbtn cb" onclick="showMenu()">MENU</button>
      </div>`;
  } else {
    ol.innerHTML = `
      <h1 style="color:#ff5050">MISI GAGAL</h1>
      <div class="sub" style="color:#ff8080">${reason}</div>
      <div class="story">
        <p>Tanpa gelombang Monsun Timur Laut dan tekanan rendah, pendaratan tidak akan berjaya. Bukti hydro-forensik membuktikan bahawa <span class="hi">alam semula jadi sendiri yang membolehkan sejarah berlaku.</span></p>
        <div class="fact">${scoreMsg}</div>
      </div>
      <div style="display:flex;gap:6px;margin-top:14px">
        <button class="gbtn" onclick="startGame()">CUBA LAGI</button>
        <button class="gbtn cb" onclick="showMenu()">MENU</button>
      </div>`;
  }
}
function showMenu() {
  gs='menu';
  overlayEl.innerHTML = `
    <h1>OPERATION KPA</h1>
    <div class="sub">KUALA PAK AMAT - 8 DISEMBER 1941 - 00:30 HRS</div>
    <div class="story">
      <p>Anda mengetuai kapal pendaratan <span class="hi">Daihatsu</span> menuju ke pantai <span class="hi">Kuala Pak Amat, Kelantan</span> - serangan pertama Perang Pasifik, 82 minit sebelum Pearl Harbor.</p>
      <p>Monsun Timur Laut telah menaikkan paras laut. Navigasi melalui perairan cetek, elakkan beting pasir, dan kumpulkan pungutan data hidrografi!</p>
      <div class="fact">Draf kapal: 1.1m &nbsp;|&nbsp; CWL: +1.81m &nbsp;|&nbsp; Angin: 7.2 m/s NE</div>
    </div>
    <div class="sdgr">
      <div class="sp" style="background:#fd9d24">SDG 11</div>
      <div class="sp" style="background:#0a97d9">SDG 14</div>
      <div class="sp" style="background:#c5192d">SDG 4</div>
    </div>
    <div style="display:flex;gap:6px;">
      <button class="gbtn" id="startBtn">MULA MISI</button>
    </div>
    <div style="margin-top:10px;font-size:9px;color:rgba(200,160,60,0.35);letter-spacing:2px;">GEOSPATIAL METAVERSE EMPOWERING HERITAGE - UiTM 2026</div>`;
  document.getElementById('startBtn').onclick = startGame;
}

let wt = 0;
const wavePool = Array.from({length:12},(_,i)=>({x:Math.random()*600,y:Math.random()*500,r:14+Math.random()*26,a:0.05+Math.random()*0.15,spd:0.2+Math.random()*0.4,phase:Math.random()*6.28}));

function buildGridLayer(){
  gridCanvas.width = Math.round(W() * dpr);
  gridCanvas.height = Math.round(H() * dpr);
  gridCtx.setTransform(dpr,0,0,dpr,0,0);
  gridCtx.clearRect(0,0,W(),H());
  gridCtx.strokeStyle='rgba(0,198,248,0.03)'; gridCtx.lineWidth=0.5;
  for(let x=0;x<W();x+=55){ gridCtx.beginPath();gridCtx.moveTo(x,0);gridCtx.lineTo(x,H());gridCtx.stroke(); }
  for(let y=0;y<H();y+=55){ gridCtx.beginPath();gridCtx.moveTo(0,y);gridCtx.lineTo(W(),y);gridCtx.stroke(); }
}

function updateHud(force=false){
  const pct=Math.min(100, Math.floor(dist/missionGoal*100));
  const timeText=Math.max(0, Math.ceil(timeLeft))+'s';
  if(force || pct !== lastPct){ progressEl.style.width=pct+'%'; lastPct=pct; }
  if(force || score !== lastScore){ scoreEl.textContent=score; lastScore=score; }
  if(force || timeText !== lastTimeText){ timeEl.textContent=timeText; lastTimeText=timeText; }
}

function update(dt) {
  if(gs!=='play') return;
  const step = dt * BASE_FPS;
  timeLeft -= dt;
  if(timeLeft<=0){ timeLeft=0; updateHud(true); endGame(false,'Masa misi tamat!'); return; }
  frame += step; wt += 0.022 * step; dist += scrollSpeed * step;
  scrollSpeed = Math.min(2.6, 1.4 + dist/missionGoal*1.0);

  if(mx>0 && Math.abs(mx - (ship.x+ship.w/2)) > 4)
    ship.x += (mx-(ship.x+ship.w/2))*(1-Math.pow(0.88, step));
  if(keys['ArrowLeft']||keys['a']) ship.x -= 3.2 * step;
  if(keys['ArrowRight']||keys['d']) ship.x += 3.2 * step;
  ship.x = Math.max(0, Math.min(W()-ship.w, ship.x));
  if(ship.inv>0) ship.inv=Math.max(0, ship.inv-step);

  ship.trail.unshift({x:ship.x+ship.w/2, y:ship.y+ship.h, j:(Math.random()-0.5)*4});
  if(ship.trail.length>18) ship.trail.pop();

  wavePool.forEach(w=>{ w.y+=scrollSpeed*0.35*step; if(w.y>H()+50) w.y=-30; });
  obstacles.forEach(o=>o.y+=scrollSpeed*step);
  for(let i=obstacles.length-1;i>=0;i--) if(obstacles[i].y>=H()+60) obstacles.splice(i,1);
  buoys.forEach(b=>{ b.y+=scrollSpeed*step; b.p+=0.07*step; });
  for(let i=buoys.length-1;i>=0;i--) if(buoys[i].y>=H()+40) buoys.splice(i,1);
  sparks.forEach(p=>{ p.x+=p.vx*step; p.y+=p.vy*step; p.vx*=Math.pow(0.9, step); p.vy*=Math.pow(0.9, step); p.life-=step; });
  for(let i=sparks.length-1;i>=0;i--) if(sparks[i].life<=0) sparks.splice(i,1);
  waveRings.forEach(r=>{ r.radius+=2.5*step; r.life-=step; });
  for(let i=waveRings.length-1;i>=0;i--) if(waveRings[i].life<=0) waveRings.splice(i,1);

  if(frame>=nextObsFrame){ spawnObs(); nextObsFrame+=195; }
  if(frame>=nextBuoyFrame){ spawnBuoy(); nextBuoyFrame+=155; }
  if(frame>=factNext){ showFact(); factNext=frame+180+Math.floor(Math.random()*80); }

  if(ship.inv<=0){
    const sx=ship.x+5,sy=ship.y+5,sw=ship.w-10,sh=ship.h-10;
    for(const o of obstacles){
      if(sx<o.x+o.w && sx+sw>o.x && sy<o.y+o.h && sy+sh>o.y){
        ship.hp--; ship.inv=70;
        spawnSparks(ship.x+ship.w/2,ship.y+ship.h/2,'#ff5050',10);
        waveRings.push({x:ship.x+ship.w/2,y:ship.y+ship.h/2,radius:10,life:20,col:'#ff5050'});
        showToast('BETING PASIR! KEEL TERHANTUK!',90);
        if(ship.hp<=0){ endGame(false,'Kapal anda karam pada beting pasir!'); return; }
        break;
      }
    }
  }
  for(const b of buoys){
    if(!b.collected){
      const dx=ship.x+ship.w/2-b.x, dy=ship.y+ship.h/2-b.y;
      if(Math.sqrt(dx*dx+dy*dy)<ship.w/2+b.r){
        b.collected=true; score+=50;
        spawnSparks(b.x,b.y,b.col,10);
        waveRings.push({x:b.x,y:b.y,radius:8,life:18,col:b.col});
        showToast('DATA '+b.type+' DIKUMPUL! +50 mata',85);
        while(score>=nextBonusScore){
          timeLeft+=BONUS_TIME;
          missionGoal+=BASE_GOAL/START_TIME*BONUS_TIME;
          nextBonusScore+=BONUS_SCORE_STEP;
          showBonus('+5 SAAT BONUS MASA!');
        }
        updateHud(true);
      }
    }
  }

  if(dist>=missionGoal){ score+=500; updateHud(true); endGame(true); return; }

  if(toastT>0){ toastT-=step; if(toastT<=0) toastEl.style.opacity='0'; }
  if(bonusT>0){ bonusT-=step; if(bonusT<=0) bonusEl.classList.remove('show'); }
  if(factT>0){ factT-=step; if(factT<=0) factEl.style.opacity='0'; }

  hudFrame += step;
  if(hudFrame >= 6 || score !== lastScore){
    hudFrame = 0;
    updateHud();
  }
}

function drawOcean(){
  const c=ctx;
  c.fillStyle='#000e1c'; c.fillRect(0,0,W(),H());
  const nearShore = dist/missionGoal;
  if(nearShore>0.75){
    const alpha=(nearShore-0.75)*4*0.35;
    c.fillStyle=`rgba(30,90,40,${alpha})`;
    c.fillRect(0,H()*0.55,W(),H()*0.45);
  }
  c.drawImage(gridCanvas,0,0,W(),H());
  wavePool.forEach(w=>{
    const pulse=Math.sin(wt*1.2+w.phase)*0.25+0.75;
    c.beginPath();
    c.arc(w.x,w.y,w.r*pulse,0,6.28);
    c.strokeStyle=`rgba(100,195,255,${w.a})`;
    c.lineWidth=0.8; c.stroke();
  });
  c.strokeStyle='rgba(0,198,248,0.055)'; c.setLineDash([7,9]); c.lineWidth=0.6;
  c.beginPath();c.moveTo(W()*0.28,0);c.lineTo(W()*0.28,H());c.stroke();
  c.beginPath();c.moveTo(W()*0.72,0);c.lineTo(W()*0.72,H());c.stroke();
  c.setLineDash([]);
  c.fillStyle='rgba(20,60,18,0.2)'; c.fillRect(0,0,W()*0.08,H());
  c.fillRect(W()*0.92,0,W()*0.08,H());
}

function drawObs(o){
  if(o.type==='sand'){
    ctx.fillStyle='rgba(175,145,75,0.72)';
    ctx.beginPath(); ctx.roundRect(o.x,o.y,o.w,o.h,6); ctx.fill();
    ctx.strokeStyle='rgba(210,175,95,0.5)'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle='rgba(210,178,100,0.45)'; ctx.font='7px Courier New'; ctx.textAlign='center';
    ctx.fillText('BETING',o.x+o.w/2,o.y+o.h/2+2.5);
  } else {
    ctx.fillStyle='rgba(75,78,100,0.82)';
    ctx.beginPath(); ctx.roundRect(o.x,o.y,o.w,o.h,4); ctx.fill();
    ctx.strokeStyle='rgba(130,135,160,0.45)'; ctx.lineWidth=0.7; ctx.stroke();
    ctx.fillStyle='rgba(155,158,185,0.5)'; ctx.font='7px Courier New'; ctx.textAlign='center';
    ctx.fillText('BATU',o.x+o.w/2,o.y+o.h/2+2.5);
  }
}

function drawBuoy(b){
  if(b.collected) return;
  const pulse=Math.sin(b.p)*0.28+0.85;
  ctx.beginPath(); ctx.arc(b.x,b.y,b.r*1.55*pulse,0,6.28);
  ctx.strokeStyle=b.col+'44'; ctx.lineWidth=1.4; ctx.stroke();
  ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.28);
  ctx.fillStyle='rgba(0,5,18,0.7)'; ctx.fill();
  ctx.strokeStyle=b.col; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle=b.col; ctx.font='bold 7px Courier New';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(b.type,b.x,b.y);
  ctx.textBaseline='alphabetic';
}

function drawShip(){
  const x=ship.x, y=ship.y, w=ship.w, h=ship.h;
  const flash = ship.inv>0 && Math.floor(ship.inv/5)%2===0;
  if(flash) return;
  if(ship.trail.length>2){
    for(let i=1;i<ship.trail.length;i++){
      const t=ship.trail[i];
      const alpha=(1-i/ship.trail.length)*0.18;
      ctx.beginPath(); ctx.arc(t.x+t.j,t.y+i*2,1.8,0,6.28);
      ctx.fillStyle=`rgba(100,200,255,${alpha})`; ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.moveTo(x+4,y+h); ctx.lineTo(x,y+h*0.5);
  ctx.lineTo(x+w/2,y+4); ctx.lineTo(x+w,y+h*0.5);
  ctx.lineTo(x+w-4,y+h); ctx.closePath();
  ctx.fillStyle='#233545'; ctx.fill();
  ctx.strokeStyle='#3a6080'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#2e5878';
  ctx.beginPath(); ctx.roundRect(x+5,y+h*0.28,w-10,h*0.32,2); ctx.fill();
  for(let i=0;i<3;i++){
    ctx.beginPath(); ctx.arc(x+w/2-8+i*8,y+h*0.42,2.8,0,6.28);
    ctx.fillStyle=i<ship.hp?'#00e887':'#222'; ctx.fill();
  }
  ctx.strokeStyle='#aaa'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(x+w/2,y+4); ctx.lineTo(x+w/2,y-12); ctx.stroke();
  ctx.fillStyle='#c82000'; ctx.fillRect(x+w/2,y-12,9,6);
  ctx.fillStyle='#fff'; ctx.font='5px sans-serif'; ctx.textAlign='left';
  ctx.fillText('JP',x+w/2+1,y-7);
}

function drawSparks(){
  sparks.forEach(p=>{
    ctx.beginPath(); ctx.arc(p.x,p.y,1.8,0,6.28);
    const a=Math.floor(p.life/28*255).toString(16).padStart(2,'0');
    ctx.fillStyle=p.col+a; ctx.fill();
  });
}

function drawRings(){
  waveRings.forEach(r=>{
    const a=r.life/20;
    ctx.beginPath(); ctx.arc(r.x,r.y,r.radius,0,6.28);
    ctx.strokeStyle=r.col+Math.floor(a*200).toString(16).padStart(2,'0');
    ctx.lineWidth=1.2; ctx.stroke();
  });
}

function drawCompass(){
  const cx=W()-38, cy=52;
  ctx.save(); ctx.translate(cx,cy);
  ctx.strokeStyle='rgba(200,160,60,0.35)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.arc(0,0,15,0,6.28); ctx.stroke();
  ctx.fillStyle='#f4b520'; ctx.font='bold 8px Courier New';
  ctx.textAlign='center';
  ctx.fillText('N',0,-5);
  ctx.fillStyle='rgba(200,160,60,0.45)'; ctx.font='7px Courier New';
  ctx.fillText('NE',8,5);
  ctx.restore();
}

function drawShoreIndicator(){
  if(dist/missionGoal<0.8) return;
  const alpha=(dist/missionGoal-0.8)*5;
  ctx.fillStyle=`rgba(0,232,135,${alpha*0.7})`;
  ctx.font='bold 11px Courier New'; ctx.textAlign='center';
  ctx.fillText('KUALA PAK AMAT',W()/2,H()*0.13);
}

function draw(){
  ctx.clearRect(0,0,W(),H());
  drawOcean();
  obstacles.forEach(drawObs);
  buoys.forEach(drawBuoy);
  drawSparks();
  drawRings();
  if(gs==='play') drawShip();
  drawCompass();
  drawShoreIndicator();
}

let lastTime = performance.now();
function loop(now){
  const dt = Math.min((now-lastTime)/1000, MAX_DT);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
