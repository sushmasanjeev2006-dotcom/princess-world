/* app.js — Hybrid Game Portal
   Stages:
     0: entry
     1: coin mini-game
     2: missions (choices)
     3: certificate generation (saves to localStorage and can open certificate.html)
     4: outro
*/

// ----- config & data -----
const PLAYER = { name: 'Shub' }; // can be dynamic
const COIN_ROUND_SECONDS = 15;
const MISSIONS = [
  { id:1, text:"Promise to spot me at the gym — pick your reaction", choices:[{t:"Deal", coins:3},{t:"Only when PR's", coins:1}]},
  { id:2, text:"Anime mood today — choose vibe", choices:[{t:"Shonen energy", coins:2},{t:"Slice of life", coins:1}]},
  { id:3, text:"Snack truce — will you share?", choices:[{t:"Always", coins:3},{t:"Sometimes", coins:1}]},
  { id:4, text:"Reply speed — set a rule", choices:[{t:"Instant (within 1h)", coins:2},{t:"Within day", coins:1}]},
  { id:5, text:"Gym challenge — accept kawaii squats?", choices:[{t:"Y", coins:3},{t:"N", coins:0}]},
  { id:6, text:"Pose protocol — dramatic pose pre-lift?", choices:[{t:"Y", coins:2},{t:"N", coins:0}]}
];

let state = {
  stage:0,
  coins:0,
  coinRoundActive:false,
  timeLeft:COIN_ROUND_SECONDS,
  missionIndex:0,
  missionRewards:[],
  certificateDataUrl:null
};

// ----- DOM -----
const entry = document.getElementById('entry');
const enterBtn = document.getElementById('enterBtn');
const viewQR = document.getElementById('viewQR');
const appMain = document.getElementById('app');
const coinCount = document.getElementById('coinCount');
const stageLabel = document.getElementById('stageLabel');

const stage1 = document.getElementById('stage1');
const startCoinsBtn = document.getElementById('startCoins');
const coinCanvas = document.getElementById('coinCanvas');
const timeLeftEl = document.getElementById('timeLeft');

const stage2 = document.getElementById('stage2');
const missionArea = document.getElementById('missionArea');
const nextMissionBtn = document.getElementById('nextMission');
const finishMissionsBtn = document.getElementById('finishMissions');

const stage3 = document.getElementById('stage3');
const previewCertCanvas = document.getElementById('previewCert');
const generateCertBtn = document.getElementById('generateCert');
const goToCertPageBtn = document.getElementById('goToCertPage');

const stage4 = document.getElementById('stage4');
const replayBtn = document.getElementById('replayBtn');
const shareCertBtn = document.getElementById('shareCertBtn');

const qrModal = document.getElementById('qrModal');
const qrLarge = document.getElementById('qrLarge');
const closeQR = document.getElementById('closeQR');

// particles canvas (background glitter)
const particleCanvas = document.getElementById('particleCanvas');
const pctx = particleCanvas.getContext('2d');

// coin canvas setup
const ctx = coinCanvas.getContext('2d');
let coinParticles = [];
let coinTimer = null;

// initialize small UI
document.getElementById('playerNameDisplay').textContent = PLAYER.name;
updateHUD();

// ----- ENTRY & QR -----
enterBtn.addEventListener('click', ()=> {
  entry.classList.add('hidden');
  appMain.classList.remove('hidden');
  gotoStage(1);
  startParticleLoop();
});
viewQR.addEventListener('click', ()=> {
  // generate page QR that points to current location (host URL)
  const url = window.location.href;
  qrLarge.innerHTML = '';
  new QRCode(qrLarge, { text: url, width: 280, height: 280, colorDark: "#3b1230", colorLight: "#fff7fb", correctLevel: QRCode.CorrectLevel.H });
  qrModal.classList.remove('hidden');
});
closeQR.addEventListener('click', ()=> qrModal.classList.add('hidden'));

// ----- HUD -----
function updateHUD(){
  coinCount.textContent = state.coins;
  stageLabel.textContent = state.stage;
}

// ----- PARTICLES BACKGROUND -----
function resizeParticles(){ particleCanvas.width = window.innerWidth; particleCanvas.height = window.innerHeight; }
window.addEventListener('resize', resizeParticles);
function startParticleLoop(){
  resizeParticles();
  const particles = [];
  for(let i=0;i<60;i++){
    particles.push({
      x: Math.random()*particleCanvas.width,
      y: Math.random()*particleCanvas.height,
      r: 0.6 + Math.random()*2,
      vy: -0.2 - Math.random()*0.6,
      alpha: 0.3 + Math.random()*0.6,
      glow: 8 + Math.random()*16
    });
  }
  function frame(){
    pctx.clearRect(0,0,particleCanvas.width,particleCanvas.height);
    for(const p of particles){
      const g = pctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.glow);
      g.addColorStop(0, `rgba(255,255,255,${p.alpha})`);
      g.addColorStop(1, 'rgba(255,182,211,0)');
      pctx.fillStyle = g;
      pctx.fillRect(p.x-p.glow,p.y-p.glow,p.glow*2,p.glow*2);
      p.y += p.vy;
      if(p.y < -50){ p.y = particleCanvas.height + 20; p.x = Math.random()*particleCanvas.width; }
    }
    requestAnimationFrame(frame);
  }
  frame();
}

// ----- STAGE CONTROL -----
function gotoStage(n){
  state.stage = n;
  updateHUD();
  [stage1, stage2, stage3, stage4].forEach(s => s.classList.add('hidden'));
  if(n===1) stage1.classList.remove('hidden');
  if(n===2) { stage2.classList.remove('hidden'); renderMission(); }
  if(n===3) { stage3.classList.remove('hidden'); drawPreviewCertificate(); }
  if(n===4) stage4.classList.remove('hidden');
}

// ----- COIN MINI-GAME -----
// coins are circles with simple physics falling down; user taps/clicks them
function spawnCoins(n=18){
  coinParticles = [];
  for(let i=0;i<n;i++){
    coinParticles.push({
      x: Math.random()*coinCanvas.width,
      y: -Math.random()*coinCanvas.height,
      vy: 0.7 + Math.random()*1.2,
      r: 12 + Math.random()*10,
      tapped:false
    });
  }
}

function drawCoins(){
  ctx.clearRect(0,0,coinCanvas.width, coinCanvas.height);
  coinParticles.forEach(c=>{
    // coin style: gold rim with pink sheen
    ctx.beginPath();
    const grd = ctx.createLinearGradient(c.x-c.r, c.y-c.r, c.x+c.r, c.y+c.r);
    grd.addColorStop(0, '#ffd07a'); grd.addColorStop(1, '#ffb3e6');
    ctx.fillStyle = grd;
    ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
    ctx.fill();
    // rim
    ctx.strokeStyle = '#ffd18a'; ctx.lineWidth = 2; ctx.stroke();
    // sparkle overlay
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(c.x - c.r/2, c.y - c.r/2 - 2, 4, 4);
    // update
    c.y += c.vy;
    if(c.y > coinCanvas.height + 30) { c.y = -20; c.x = Math.random()*coinCanvas.width; c.tapped = false; }
  });
}

function startCoinRound(){
  if(state.coinRoundActive) return;
  state.coinRoundActive = true;
  state.timeLeft = COIN_ROUND_SECONDS;
  timeLeftEl.textContent = state.timeLeft;
  spawnCoins(20);
  drawCoins();
  // tick
  coinTimer = setInterval(()=> {
    state.timeLeft--;
    timeLeftEl.textContent = state.timeLeft;
    if(state.timeLeft <= 0){ stopCoinRound(); }
  }, 1000);
  // animation
  (function anim(){ if(!state.coinRoundActive) return; drawCoins(); requestAnimationFrame(anim); })();
}

function stopCoinRound(){
  clearInterval(coinTimer);
  state.coinRoundActive = false;
  // small reward: add coins equal to taps counted (we tracked via state.coins during clicks)
  gotoStage(2);
}

// handle clicks on canvas
coinCanvas.addEventListener('click', (ev)=> {
  if(!state.coinRoundActive) return;
  const rect = coinCanvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (coinCanvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (coinCanvas.height / rect.height);
  // detect coin under click
  for(let c of coinParticles){
    const dx = x - c.x, dy = y - c.y;
    if(!c.tapped && dx*dx + dy*dy <= c.r*c.r){
      c.tapped = true;
      state.coins += 1;
      updateHUD();
      // nice little visual pulse (grow then shrink)
      const originalR = c.r;
      let step = 0;
      const pulse = setInterval(()=> {
        if(step>6){ clearInterval(pulse); c.r = originalR; return; }
        c.r = originalR + Math.sin(step/6*Math.PI)*8;
        step++;
      }, 16);
      break;
    }
  }
});

// ----- MISSIONS (stage 2) -----
function renderMission(){
  missionArea.innerHTML = '';
  const m = MISSIONS[state.missionIndex];
  const box = document.createElement('div'); box.className = 'missionBox';
  box.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${m.text}</div>`;
  const choices = document.createElement('div'); choices.style.display='flex'; choices.style.gap='10px';
  m.choices.forEach((c, i) => {
    const btn = document.createElement('button'); btn.className='choiceBtn'; btn.textContent = `${c.t} (+${c.coins} coins)`;
    btn.addEventListener('click', ()=>{
      state.coins += c.coins;
      state.missionRewards.push({mission:m.id,choice:c.t,coins:c.coins});
      state.missionIndex++;
      updateHUD();
      // brief feedback
      btn.style.transform = 'scale(0.98)'; setTimeout(()=>btn.style.transform='none',160);
      if(state.missionIndex >= MISSIONS.length) {
        // done
        gotoStage(3);
      } else {
        renderMission();
      }
    });
    choices.appendChild(btn);
  });
  box.appendChild(choices);
  missionArea.appendChild(box);
}

nextMissionBtn.addEventListener('click', ()=>{
  renderMission();
});

finishMissionsBtn.addEventListener('click', ()=>{
  gotoStage(3);
});

// ----- CERTIFICATE (stage 3) -----
// draw preview certificate on previewCert canvas
function drawPreviewCertificate(){
  const c = previewCertCanvas;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  // background parchment-like
  ctx.fillStyle = '#fff6f9'; ctx.fillRect(0,0,W,H);
  // soft texture using subtle noise rectangle (simple)
  ctx.fillStyle = 'rgba(255,230,245,0.06)'; for(let i=0;i<2000;i+=200){ ctx.fillRect(i%W, (i*3)%H, 2, 2); }
  // golden border
  ctx.strokeStyle = '#d69b6a'; ctx.lineWidth = 8;
  roundRect(ctx,20,20,W-40,H-40,18,false,true);
  // heading
  ctx.fillStyle = '#6d1542'; ctx.font = '28px serif'; ctx.textAlign='center';
  ctx.fillText('Certificate of Unescapable Friendship', W/2, 90);
  // name
  ctx.fillStyle = '#4b0f33'; ctx.font = '36px serif'; ctx.fillText(PLAYER.name, W/2, 180);
  // message
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#5a223f';
  const msg = `This certifies that ${PLAYER.name} is forcefully enrolled in this Princess Friendship. Escape is not an option.`;
  wrapTextCenter(ctx, msg, W/2, 230, W-160, 26);
  // seal (pink round)
  ctx.beginPath(); ctx.fillStyle = '#ffb3e6'; ctx.arc(W/2, H-160, 48, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#7a1f44'; ctx.font='16px serif'; ctx.fillText('PRINCESS SEAL', W/2, H-156);
  // small footer
  ctx.fillStyle = '#7a1f44'; ctx.font='14px sans-serif'; ctx.fillText('Signed with glitter & gym-energy', W/2, H-80);
}

// utility to center wrap text
function wrapTextCenter(ctx, text, x, y, maxW, lineH){
  ctx.textAlign='center';
  const words = text.split(' ');
  let line=''; let row=0;
  for(let n=0;n<words.length;n++){
    const test = line + words[n] + ' ';
    const metrics = ctx.measureText(test);
    if(metrics.width > maxW && n>0){
      ctx.fillText(line, x, y + row*lineH);
      line = words[n] + ' ';
      row++;
    } else line = test;
  }
  ctx.fillText(line, x, y + row*lineH);
}

function roundRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  if(fill) ctx.fill(); if(stroke) ctx.stroke();
}

// when user clicks generate, create a high-res certificate PNG and save to localStorage
generateCertBtn.addEventListener('click', ()=>{
  const canvas = previewCertCanvas;
  // generate high-dpi version (2x)
  const scale = 2;
  const w = canvas.width, h = canvas.height;
  const tmp = document.createElement('canvas'); tmp.width = w*scale; tmp.height = h*scale;
  const tctx = tmp.getContext('2d');
  // scale drawing: reuse preview drawing logic scaled
  tctx.scale(scale, scale);
  // re-draw using same routine but on tmp context — simple approach: call drawPreviewCertificate but with tctx
  // We'll replicate essential parts quickly
  tctx.fillStyle = '#fff6f9'; tctx.fillRect(0,0,w,h);
  tctx.strokeStyle = '#d69b6a'; tctx.lineWidth = 8;
  roundRect(tctx,20,20,w-40,h-40,18,false,true);
  tctx.fillStyle = '#6d1542'; tctx.font = '28px serif'; tctx.textAlign='center';
  tctx.fillText('Certificate of Unescapable Friendship', w/2, 90);
  tctx.fillStyle = '#4b0f33'; tctx.font = '36px serif'; tctx.fillText(PLAYER.name, w/2, 180);
  tctx.font = '18px sans-serif'; tctx.fillStyle = '#5a223f';
  const msg = `This certifies that ${PLAYER.name} is forcefully enrolled in this Princess Friendship. Escape is not an option.`;
  // center wrap
  // reuse wrapTextCenter using tctx (it uses ctx.measureText etc)
  (function wrapAndDraw(){
    tctx.textAlign='center';
    const words = msg.split(' ');
    let line=''; let row=0;
    for(let n=0;n<words.length;n++){
      const test = line + words[n] + ' ';
      const metrics = tctx.measureText(test);
      if(metrics.width > (w-160) && n>0){
        tctx.fillText(line, w/2, 230 + row*26);
        line = words[n] + ' ';
        row++;
      } else line = test;
    }
    tctx.fillText(line, w/2, 230 + row*26);
  })();
  // seal
  tctx.beginPath(); tctx.fillStyle = '#ffb3e6'; tctx.arc(w/2, h-160, 48, 0, Math.PI*2); tctx.fill();
  tctx.fillStyle = '#7a1f44'; tctx.font='16px serif'; tctx.fillText('PRINCESS SEAL', w/2, h-156);
  tctx.fillStyle = '#7a1f44'; tctx.font='14px sans-serif'; tctx.fillText('Signed with glitter & gym-energy', w/2, h-80);

  // export data URL
  const dataUrl = tmp.toDataURL('image/png');
  state.certificateDataUrl = dataUrl;
  // save into localStorage so certificate.html can load it
  try { localStorage.setItem('pr_certificate', dataUrl); } catch(e){ console.warn('localStorage failed', e); }
  // show open certificate page button
  goToCertPageBtn.classList.remove('hidden');
  goToCertPageBtn.addEventListener('click', ()=> {
    // open certificate page in same origin: certificate.html (must exist on host)
    window.open('certificate.html', '_blank');
  });
  // also allow immediate navigation there
  document.getElementById('goToCertPage').classList.remove('hidden');
});

// ----- STAGE 4 -----
replayBtn.addEventListener('click', ()=> location.reload());
shareCertBtn.addEventListener('click', ()=> window.open('certificate.html','_blank'));

// ----- start coin round button -----
startCoinsBtn.addEventListener('click', ()=> {
  // adapt canvas to style size
  coinCanvas.width = coinCanvas.clientWidth * devicePixelRatio;
  coinCanvas.height = coinCanvas.clientHeight * devicePixelRatio;
  ctx.setTransform(1,0,0,1,0,0);
  spawnCoins(18);
  startCoinRound();
});

// ----- helpers: coin spawning & animation (simplified wrapper) -----
function spawnCoins(n=18){
  coinParticles = [];
  for(let i=0;i<n;i++){
    coinParticles.push({
      x: Math.random()*coinCanvas.width,
      y: -Math.random()*coinCanvas.height,
      vy: 1 + Math.random()*2,
      r: (12 + Math.random()*10) * devicePixelRatio,
      tapped:false
    });
  }
}

function startCoinRound(){
  state.coinRoundActive = true;
  let time = COIN_ROUND_SECONDS;
  timeLeftEl.textContent = time;
  const interval = setInterval(()=> {
    time--;
    timeLeftEl.textContent = time;
    if(time<=0){ clearInterval(interval); state.coinRoundActive = false; gotoStage(2); }
  }, 1000);

  // animate coins
  (function loop(){
    if(!state.coinRoundActive) return;
    // clear
    ctx.clearRect(0,0,coinCanvas.width,coinCanvas.height);
    // draw
    for(const c of coinParticles){
      // simple circle
      ctx.beginPath();
      const grad = ctx.createLinearGradient(c.x-c.r, c.y-c.r, c.x+c.r, c.y+c.r);
      grad.addColorStop(0,'#ffd07a'); grad.addColorStop(1,'#ffb3e6');
      ctx.fillStyle = grad;
      ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#ffd18a'; ctx.lineWidth = 2;
      ctx.stroke();
      // update
      c.y += c.vy;
      if(c.y > coinCanvas.height + 50) { c.y = -20; c.x = Math.random()*coinCanvas.width; c.tapped = false; }
    }
    requestAnimationFrame(loop);
  })();
}

// when clicking on coinCanvas we detect coin hits and add coins
coinCanvas.addEventListener('click', (ev)=>{
  if(!state.coinRoundActive) return;
  const rect = coinCanvas.getBoundingClientRect();
  const scaleX = coinCanvas.width / rect.width;
  const scaleY = coinCanvas.height / rect.height;
  const x = (ev.clientX - rect.left) * scaleX;
  const y = (ev.clientY - rect.top) * scaleY;
  for(const c of coinParticles){
    const dx = x - c.x, dy = y - c.y;
    if(!c.tapped && dx*dx + dy*dy <= c.r*c.r){
      c.tapped = true;
      state.coins++;
      updateHUD();
      // tiny pop effect: briefly expand radius
      const original = c.r;
      let step=0;
      const pop = setInterval(()=> {
        step++;
        c.r = original + Math.sin((step/6)*Math.PI)*8;
        if(step>6){ clearInterval(pop); c.r = original; }
      }, 16);
      break;
    }
  }
});

// initial setup
function init(){
  // sizing
  coinCanvas.width = coinCanvas.clientWidth * devicePixelRatio;
  coinCanvas.height = coinCanvas.clientHeight * devicePixelRatio;
  ctx.setTransform(1,0,0,1,0,0);
  previewCertCanvas.width = previewCertCanvas.clientWidth * devicePixelRatio;
  previewCertCanvas.height =  (previewCertCanvas.clientWidth * 2/3) * devicePixelRatio;
  drawPreviewCertificate();
  gotoStage(0); // hidden content
  // show entry visible state
  // entry visible by default; user presses Enter
}
init();
