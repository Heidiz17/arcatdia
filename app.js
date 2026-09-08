/* =============================================================
   🔒 Arcatdia Battle Engine - 屠龍刀黃金版 (Part 1/3)
   ============================================================= */

const canvas = document.getElementById('battleCanvas');
const ctx = canvas.getContext('2d');
let W = window.innerWidth; let H = window.innerHeight;

let bpm = 175;
let isPlaying = false; let isPaused = false;
let score = 0; let combo = 0; let hp = 100;
let notes = []; let particles = []; let stars = []; 
let celestialEvents = [];
let startTime = 0; let pauseStartTime = 0; let totalPausedDuration = 0;
let playbackSpeed = 1.0; let scrollSpeedMultiplier = 1.0; 
let currentMode = 'test';

let battleBgOpacity = 1.0;
let preloadedSlideImages = [];
let currentSlideIndex = 0;
let lastSlideChangeTime = 0;
let savedData = { title: null, ready: null, battle: [], opacity: 100 };

let currentPerspectiveMode = 2; // 3D 消失點
const judgeLineOffsets = [165, 185, 205, 225];
let judgeLineLevel = 1; 

const lanePressed = [false, false, false, false];
const laneTouchStartY = [0, 0, 0, 0];
const laneTouchFlicked = [false, false, false, false];

const laneColors = [
    { main: "#ff0055", glow: "rgba(255, 0, 85, 0.8)" },
    { main: "#ccff00", glow: "rgba(204, 255, 0, 0.8)" },
    { main: "#00ccff", glow: "rgba(0, 204, 255, 0.8)" },
    { main: "#aa00ff", glow: "rgba(170, 0, 255, 0.8)" }
];

function togglePerspectiveMode() { currentPerspectiveMode = currentPerspectiveMode === 1 ? 2 : 1; showJudgement(currentPerspectiveMode === 1 ? "2D 直軌" : "3D 消失點"); }
function toggleJudgeLineLevel() { judgeLineLevel = (judgeLineLevel + 1) % judgeLineOffsets.length; showJudgement(`判定線: LV ${judgeLineLevel + 1}`); }
function handleResize() { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; initStars(); }
window.addEventListener('resize', handleResize); handleResize();

// === 📸 輕量化壓縮相片核心 ===
function compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = function() {
        const cvs = document.createElement('canvas');
        const MAX = 1080; 
        let w = img.width; let h = img.height;
        if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
        else if (h > MAX) { w *= MAX / h; h = MAX; }
        cvs.width = w; cvs.height = h;
        const cCtx = cvs.getContext('2d');
        cCtx.drawImage(img, 0, 0, w, h);
        callback(cvs.toDataURL('image/jpeg', 0.6)); 
    };
    img.src = dataUrl;
}

// === 📸 相片讀取與上傳 (已移除鎖死 opacity，交由 CSS 控制) ===
function loadSavedImages() {
    try {
        const saved = localStorage.getItem('arcatdia_save');
        if (saved) {
            savedData = JSON.parse(saved);
            if (savedData.title) {
                const tb = document.getElementById('titleBg');
                if (tb) { tb.style.backgroundImage = `url(${savedData.title})`; }
            }
            if (savedData.ready) {
                const rb = document.getElementById('readyBg');
                if (rb) { rb.style.backgroundImage = `url(${savedData.ready})`; }
            }
            if (savedData.battle && savedData.battle.length > 0) {
                preloadBattleSlides();
            }
            if (savedData.opacity !== undefined) {
                battleBgOpacity = savedData.opacity / 100;
                const sl = document.getElementById('opacitySlider');
                if (sl) sl.value = savedData.opacity;
            }
        }
    } catch(e) {}
}

function preloadBattleSlides() {
    preloadedSlideImages = [];
    savedData.battle.forEach(src => {
        const img = new Image();
        img.src = src;
        preloadedSlideImages.push(img);
    });
}

function handleUpload(event, type) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (type === 'title') {
        const reader = new FileReader();
        reader.onload = (e) => {
            compressImage(e.target.result, (compressed) => {
                savedData.title = compressed;
                const tb = document.getElementById('titleBg');
                if (tb) { tb.style.backgroundImage = `url(${compressed})`; }
                showJudgement("封面已換！");
            });
        };
        reader.readAsDataURL(files[0]);
    } else if (type === 'ready') {
        const reader = new FileReader();
        reader.onload = (e) => {
            compressImage(e.target.result, (compressed) => {
                savedData.ready = compressed;
                const rb = document.getElementById('readyBg');
                if (rb) { rb.style.backgroundImage = `url(${compressed})`; }
                showJudgement("候機室已換！");
            });
        };
        reader.readAsDataURL(files[0]);
    } else if (type === 'battle') {
        savedData.battle = [];
        let loadedCount = 0;
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                compressImage(e.target.result, (compressed) => {
                    savedData.battle.push(compressed);
                    loadedCount++;
                    if (loadedCount === files.length) {
                        preloadBattleSlides();
                        showJudgement(`已讀入 ${loadedCount} 張戰鬥圖！`);
                    }
                });
            };
            reader.readAsDataURL(file);
        });
    }
}

function updateSlideOpacity(val) {
    battleBgOpacity = parseFloat(val) / 100;
    savedData.opacity = parseInt(val, 10);
}

function saveSettings() {
    try {
        savedData.opacity = Math.round(battleBgOpacity * 100);
        localStorage.setItem('arcatdia_save', JSON.stringify(savedData));
        showJudgement("💾 存檔成功！");
    } catch(e) {
        showJudgement("⚠️ 相片過大，存檔受限");
    }
}

window.addEventListener('DOMContentLoaded', loadSavedImages);
loadSavedImages();
/* =============================================================
   🔒 Arcatdia Battle Engine - 屠龍刀黃金版 (Part 2/3)
   ============================================================= */

// === Web Audio 引擎 ===
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null; let bgmGainNode = null; let sfxGainNode = null; let sfxBuffers = {};
function initAudioEngine() {
    if (!audioCtx) {
        audioCtx = new AudioContextClass(); bgmGainNode = audioCtx.createGain(); sfxGainNode = audioCtx.createGain();
        bgmGainNode.connect(audioCtx.destination); sfxGainNode.connect(audioCtx.destination); loadSFXFiles();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
const soundPaths = { tap: "sounds/arcatdia_perfect_tap.wav", flick: "sounds/arcatdia_perfect_flick.wav", hold: "sounds/arcatdia_hold.wav", tick: "sounds/arcatdia_tick.wav", stage: "sounds/arcatdia_stage_tap.wav" };
async function loadSFXFiles() { for (let key in soundPaths) { try { const resp = await fetch(soundPaths[key]); const ab = await resp.arrayBuffer(); audioCtx.decodeAudioData(ab, (buf) => { sfxBuffers[key] = buf; }); } catch(e) { try { const resp2 = await fetch(soundPaths[key].replace('sounds/', '')); const ab2 = await resp2.arrayBuffer(); audioCtx.decodeAudioData(ab2, (buf) => { sfxBuffers[key] = buf; }); } catch(err) {} } } }
function playSFX(key) { if (!audioCtx || !sfxBuffers[key]) return null; try { const src = audioCtx.createBufferSource(); src.buffer = sfxBuffers[key]; src.connect(sfxGainNode); src.start(0); return src; } catch(e) { return null; } }
function updateBgmVolume(val) { if (bgmGainNode) bgmGainNode.gain.value = parseFloat(val); document.getElementById('valBgm').innerText = Math.round(val * 100) + "%"; }
function updateSfxVolume(val) { if (sfxGainNode) sfxGainNode.gain.value = parseFloat(val); document.getElementById('valSfx').innerText = Math.round(val * 100) + "%"; }

const currentSong = { id: "01", title: "最大の愛", folder: "songs/01_最大の愛", fileName: "master.mp3", bpm: 175 };
const masterAudio = new Audio(); try { masterAudio.src = encodeURI(`${currentSong.folder}/${currentSong.fileName}`); masterAudio.preload = "auto"; } catch (e) {}
let bgmSourceNode = null;
function hookMasterAudioNode() { if (audioCtx && !bgmSourceNode) { try { bgmSourceNode = audioCtx.createMediaElementSource(masterAudio); bgmSourceNode.connect(bgmGainNode); } catch(e) {} } }
function playStickClick(freq = 1200) { if (!audioCtx) return; try { const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(freq, audioCtx.currentTime); gain.gain.setValueAtTime(0.8, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04); osc.connect(gain); gain.connect(sfxGainNode); osc.start(); osc.stop(audioCtx.currentTime + 0.04); } catch (e) {} }

// === 少林寺排譜 ===
function generateChart() {
    notes = []; particles = [];
    const beatMs = (60 / bpm) * 1000;
    let currentTime = 5 * beatMs; let lastLane = 0;
    if (currentMode === 'test') {
        for (let i = 0; i < 150; i++) {
            const mod = i % 4;
            if (mod === 0 || mod === 1) notes.push({ type: 'tap', lane: 0, targetTime: currentTime, hit: false });
            else if (mod === 2) notes.push({ type: 'flick', lane: 0, targetTime: currentTime, hit: false });
            else notes.push({ type: 'hold', lane: 0, targetTime: currentTime, duration: beatMs * 2, hit: false, holding: false, lastTick: 0 });
            currentTime += (beatMs * 4);
        }
    } else if (currentMode === 'easy') {
        for (let i = 0; i < 200; i++) {
            lastLane = (lastLane + Math.floor(Math.random() * 3) + 1) % 4;
            const r = Math.random();
            if (r < 0.65) { notes.push({ type: 'tap', lane: lastLane, targetTime: currentTime, hit: false }); currentTime += (beatMs * (Math.random() < 0.5 ? 2 : 4)); }
            else if (r < 0.85) { notes.push({ type: 'flick', lane: lastLane, targetTime: currentTime, hit: false }); currentTime += (beatMs * 2); }
            else { const holdBeats = (Math.random() < 0.5) ? 1 : 2; const holdDuration = beatMs * holdBeats; notes.push({ type: 'hold', lane: lastLane, targetTime: currentTime, duration: holdDuration, hit: false, holding: false, lastTick: 0 }); currentTime += holdDuration + (beatMs * 2); }
        }
    } else {
        for (let i = 0; i < 300; i++) {
            lastLane = (lastLane + Math.floor(Math.random() * 3) + 1) % 4;
            const r = Math.random();
            if (r < 0.60) { notes.push({ type: 'tap', lane: lastLane, targetTime: currentTime, hit: false }); currentTime += (beatMs * (Math.random() < 0.6 ? 1 : 2)); }
            else if (r < 0.80) { notes.push({ type: 'flick', lane: lastLane, targetTime: currentTime, hit: false }); currentTime += (beatMs * 2); }
            else { const holdDuration = beatMs * 3; notes.push({ type: 'hold', lane: lastLane, targetTime: currentTime, duration: holdDuration, hit: false, holding: false, lastTick: 0 }); currentTime += holdDuration + beatMs; }
        }
    }
    notes.sort((a, b) => a.targetTime - b.targetTime);
}

function initStars() { stars = []; for (let i = 0; i < 80; i++) { stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 2 + 1, speed: Math.random() * 1.5 + 0.5, alpha: Math.random() }); } }
function initCelestialJourney() { celestialEvents = [ { timeSec: 2, duration: 8, planets: [{ name: "🌍 地球起航", color: "rgba(0, 160, 255, 0.32)", radius: 65, xRatio: 0.72, yRatio: 0.20 }] }, { timeSec: 25, duration: 8, planets: [{ name: "🌟 啟明星・金星", color: "rgba(255, 205, 80, 0.32)", radius: 60, xRatio: 0.70, yRatio: 0.22 }] }, { timeSec: 52, duration: 11, planets: [ { name: "🪐 木星風暴", color: "rgba(235, 140, 60, 0.32)", radius: 78, xRatio: 0.60, yRatio: 0.18 }, { name: "🪐 土星光環", color: "rgba(240, 210, 140, 0.32)", radius: 55, xRatio: 0.82, yRatio: 0.26, hasRing: true } ]}, { timeSec: 88, duration: 11, planets: [ { name: "🧊 天王星", color: "rgba(120, 235, 235, 0.32)", radius: 52, xRatio: 0.62, yRatio: 0.20 }, { name: "🌊 海王星", color: "rgba(65, 105, 225, 0.35)", radius: 50, xRatio: 0.80, yRatio: 0.25 } ]}, { timeSec: 122, duration: 9, planets: [{ name: "❄️ 冥王星冰界", color: "rgba(195, 220, 240, 0.28)", radius: 42, xRatio: 0.72, yRatio: 0.22 }] }, { timeSec: 148, duration: 12, planets: [{ name: "🌌 阿卡迪亞星雲", color: "rgba(180, 60, 255, 0.35)", radius: 95, xRatio: 0.70, yRatio: 0.18 }] }, { timeSec: 175, duration: 25, planets: [{ name: "🐾 抵達：阿卡迪亞貓星", color: "rgba(255, 105, 180, 0.42)", radius: 115, xRatio: 0.68, yRatio: 0.18 }] } ]; }

function goToReadyRoom() { 
    document.getElementById('titleScreen').classList.remove('active'); 
    document.getElementById('titleBg').classList.remove('active'); 
    document.getElementById('readyRoom').classList.add('active'); 
    const rb = document.getElementById('readyBg'); 
    if (rb) { rb.classList.add('active'); } 
    initAudioEngine(); 
}

function returnToTitle() { 
    document.getElementById('readyRoom').classList.remove('active'); 
    document.getElementById('readyBg').classList.remove('active'); 
    document.getElementById('titleScreen').classList.add('active'); 
    const tb = document.getElementById('titleBg'); 
    if (tb) { tb.classList.add('active'); } 
}

function returnToReadyRoom() { 
    document.getElementById('pauseMenu').classList.remove('active'); 
    document.getElementById('battleHud').style.display = 'none'; 
    document.getElementById('touchController').style.display = 'none'; 
    const rb = document.getElementById('readyBg'); 
    if (rb) { rb.classList.add('active'); } 
    document.getElementById('readyRoom').classList.add('active'); 
    isPaused = false; isPlaying = false; 
    masterAudio.pause(); masterAudio.currentTime = 0; clearAllTimers(); ctx.clearRect(0, 0, W, H); 
}

// 🛡️ 徹底隱藏封面及候機室底圖，保證戰鬥 Canvas 獨立無阻
function startVoyage() { 
    document.getElementById('readyRoom').classList.remove('active'); 
    const rb = document.getElementById('readyBg');
    if (rb) { rb.classList.remove('active'); }
    const tb = document.getElementById('titleBg');
    if (tb) { tb.classList.remove('active'); }

    document.getElementById('battleHud').style.display = 'flex'; 
    document.getElementById('touchController').style.display = 'flex'; 
    score = 0; combo = 0; hp = 100; totalPausedDuration = 0; 
    hookMasterAudioNode(); updateUI(); initStars(); initCelestialJourney(); generateChart(); 
    isPlaying = true; isPaused = false; startTime = performance.now(); lastSlideChangeTime = performance.now(); 
    scheduleCountInAndPlay(); requestAnimationFrame(gameLoop); 
}

function selectDifficulty(mode) { currentMode = mode; document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active')); if (mode === 'easy') document.getElementById('btnDiffEasy').classList.add('active'); if (mode === 'normal') document.getElementById('btnDiffNormal').classList.add('active'); if (mode === 'test') document.getElementById('btnDiffTest').classList.add('active'); }
function pauseGame() { if (!isPlaying || isPaused) return; isPaused = true; pauseStartTime = performance.now(); masterAudio.pause(); clearAllTimers(); document.getElementById('pauseMenu').classList.add('active'); }
function resumeGame() { if (!isPaused) return; document.getElementById('pauseMenu').classList.remove('active'); totalPausedDuration += (performance.now() - pauseStartTime); isPaused = false; masterAudio.play().catch(()=>{}); requestAnimationFrame(gameLoop); }
function restartFromPause() { document.getElementById('pauseMenu').classList.remove('active'); isPaused = false; startVoyage(); }

function createHitParticles(x, y, color) { if (particles.length > 30) particles.splice(0, 10); for (let i = 0; i < 8; i++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 6 + 2; particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 4 + 2, color: color, alpha: 1.0 }); } }

for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        laneBtn.addEventListener('touchstart', (e) => { e.preventDefault(); laneBtn.classList.add('pressed'); lanePressed[i] = true; laneTouchFlicked[i] = false; laneTouchStartY[i] = e.touches[0].clientY; handleAction(i, 'down'); }, { passive: false });
        laneBtn.addEventListener('touchmove', (e) => { const currentY = e.touches[0].clientY; if (!laneTouchFlicked[i] && (laneTouchStartY[i] - currentY > 18)) { laneTouchFlicked[i] = true; handleAction(i, 'flick'); } });
        laneBtn.addEventListener('touchend', (e) => { e.preventDefault(); laneBtn.classList.remove('pressed'); lanePressed[i] = false; handleAction(i, 'up'); }, { passive: false });
        laneBtn.addEventListener('mousedown', (e) => { laneBtn.classList.add('pressed'); lanePressed[i] = true; handleAction(i, 'down'); });
        laneBtn.addEventListener('mouseup', () => { laneBtn.classList.remove('pressed'); lanePressed[i] = false; handleAction(i, 'up'); });
    }
}
/* =============================================================
   🔒 Arcatdia Battle Engine - 屠龍刀黃金版 (Part 3/3)
   ============================================================= */

let activeHoldAudioSources = [null, null, null, null];

function handleAction(laneIndex, actionType) {
    if (!isPlaying || isPaused) return;
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentHitY = H - judgeLineOffsets[judgeLineLevel];
    const laneW = W / 4;
    const targetX = laneW * laneIndex + (laneW / 2);

    if (actionType === 'down') {
        const targetNote = notes.find(n => n.lane === laneIndex && !n.hit && Math.abs(currentTimeMs - n.targetTime) < 200);
        if (targetNote) {
            if (targetNote.type === 'tap') { targetNote.hit = true; score += 1000; combo++; hp = Math.min(100, hp + 2); playSFX('tap'); showJudgement("PERFECT!"); createHitParticles(targetX, currentHitY, "#ffffff"); updateUI(); } 
            else if (targetNote.type === 'hold') { targetNote.holding = true; targetNote.lastTick = currentTimeMs; activeHoldAudioSources[laneIndex] = playSFX('hold'); showJudgement("HOLD!"); createHitParticles(targetX, currentHitY, laneColors[laneIndex].main); updateUI(); } 
            else if (targetNote.type === 'flick') { showJudgement("FLICK UP!"); }
        } else { playSFX('stage'); createHitParticles(targetX, currentHitY, "rgba(0, 255, 204, 0.45)"); }
    } else if (actionType === 'flick') {
        const flickNote = notes.find(n => n.lane === laneIndex && !n.hit && n.type === 'flick' && Math.abs(currentTimeMs - n.targetTime) < 260);
        if (flickNote) { flickNote.hit = true; score += 1200; combo++; hp = Math.min(100, hp + 3); playSFX('flick'); showJudgement("FLICK!!"); createHitParticles(targetX, currentHitY, "#ff0077"); updateUI(); }
    } else if (actionType === 'up') {
        const holdingNote = notes.find(n => n.lane === laneIndex && n.type === 'hold' && n.holding && !n.hit);
        if (holdingNote) { holdingNote.holding = false; holdingNote.hit = true; score += 500; updateUI(); }
        if (activeHoldAudioSources[laneIndex]) { try { activeHoldAudioSources[laneIndex].stop(); } catch(e) {} activeHoldAudioSources[laneIndex] = null; }
    }
}

function updateUI() {
    const scoreVal = document.getElementById('scoreVal'); if (scoreVal) scoreVal.innerText = String(score).padStart(6, '0');
    const hpFill = document.getElementById('hpFill');
    if (hpFill) { hpFill.style.width = `${hp}%`; hpFill.className = 'hp-fill'; if (hp <= 25) hpFill.classList.add('lvl-c'); else if (hp <= 60) hpFill.classList.add('lvl-b'); else if (hp <= 85) hpFill.classList.add('lvl-a'); else hpFill.classList.add('lvl-s'); }
    const comboDisp = document.getElementById('comboDisplay'); if (comboDisp && combo > 1) { comboDisp.innerText = `${combo} COMBO`; comboDisp.style.opacity = '1'; }
}

function showJudgement(text) { const disp = document.getElementById('judgementDisplay'); if (disp) { disp.innerText = text; disp.style.opacity = '1'; setTimeout(() => { disp.style.opacity = '0'; }, 280); } }

let countInTimers = []; let audioStartTimer = null;
function clearAllTimers() { countInTimers.forEach(t => clearTimeout(t)); countInTimers = []; if (audioStartTimer) { clearTimeout(audioStartTimer); audioStartTimer = null; } }

function scheduleCountInAndPlay() {
    clearAllTimers(); const beatMs = (60 / bpm) * 1000;
    [0, 1, 2, 3].forEach(b => { countInTimers.push(setTimeout(() => { if (!isPlaying || isPaused) return; playStickClick(b === 3 ? 1800 : 1200); showJudgement(`${b + 1}`); }, (b * beatMs) / playbackSpeed)); });
    audioStartTimer = setTimeout(() => { if (!isPlaying || isPaused) return; masterAudio.playbackRate = playbackSpeed; masterAudio.currentTime = 0; masterAudio.play().catch(() => {}); }, (beatMs * 4) / playbackSpeed);
}

// === 渲染循環 (5.3 激光特效 + 幻燈片) ===
function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    const currentTimeMs = (now - startTime - totalPausedDuration) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;

    // 📸 幻燈片渲染
    if (preloadedSlideImages.length > 0) {
        if (now - lastSlideChangeTime > 8000) { currentSlideIndex = (currentSlideIndex + 1) % preloadedSlideImages.length; lastSlideChangeTime = now; }
        const curImg = preloadedSlideImages[currentSlideIndex];
        if (curImg && curImg.complete) {
            ctx.save(); ctx.globalAlpha = battleBgOpacity;
            const imgRatio = curImg.width / curImg.height; const screenRatio = W / H; let dw, dh, dx, dy;
            if (screenRatio > imgRatio) { dw = W; dh = W / imgRatio; dx = 0; dy = (H - dh) / 2; } 
            else { dh = H; dw = H * imgRatio; dx = (W - dw) / 2; dy = 0; }
            ctx.drawImage(curImg, dx, dy, dw, dh); ctx.restore();
        }
    }

    stars.forEach(s => { ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill(); s.y += s.speed * 1.5; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });

    celestialEvents.forEach(evt => {
        if (currentSec >= evt.timeSec && currentSec <= evt.timeSec + evt.duration) {
            const progress = (currentSec - evt.timeSec) / evt.duration; const alpha = Math.sin(progress * Math.PI) * 0.40;
            evt.planets.forEach(p => {
                ctx.save(); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 45;
                const px = W * p.xRatio - (progress * 40); const py = H * p.yRatio + (progress * 30);
                ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.fill();
                if (p.hasRing) { ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35); ctx.strokeStyle = "rgba(240, 220, 160, 0.55)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.8})`; ctx.font = "bold 13px sans-serif"; ctx.fillText(p.name, px - 40, py + p.radius + 20); ctx.restore();
            });
        }
    });

    const hitY = H - judgeLineOffsets[judgeLineLevel]; const startY = 20; const laneW = W / 4;
    const botX = [laneW * 0.5, laneW * 1.5, laneW * 2.5, laneW * 3.5]; const topX = (currentPerspectiveMode === 1) ? botX : [W * 0.44, W * 0.48, W * 0.52, W * 0.56];

    for (let i = 0; i < 4; i++) { ctx.strokeStyle = laneColors[i].glow; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(topX[i], startY); ctx.lineTo(botX[i], H); ctx.stroke(); }

    // 🌟 5.3 激光判定線
    ctx.save(); ctx.strokeStyle = "rgba(0, 255, 204, 0.9)"; ctx.lineWidth = 3; ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke(); ctx.restore();

    for (let i = 0; i < 4; i++) { ctx.fillStyle = laneColors[i].main; ctx.beginPath(); ctx.arc(botX[i], hitY, 22, 0, Math.PI * 2); ctx.fill(); }

    const beatMs = (60 / bpm) * 1000; const tDur = (beatMs * 4) / scrollSpeedMultiplier; 

    notes.forEach(n => {
        if (n.hit) return;
        const p = 1.0 - ((n.targetTime - currentTimeMs) / tDur);

        if (n.type === 'hold') {
            const endP = 1.0 - (((n.targetTime + n.duration) - currentTimeMs) / tDur);
            if (n.holding) {
                if (currentTimeMs - n.lastTick >= 120) { n.lastTick = currentTimeMs; playSFX('tick'); score += 150; combo++; updateUI(); createHitParticles(botX[n.lane], hitY, laneColors[n.lane].main); }
                if (currentTimeMs >= n.targetTime + n.duration) { n.hit = true; n.holding = false; score += 600; combo++; hp = Math.min(100, hp + 3); playSFX('tap'); showJudgement("PERFECT!"); updateUI(); }
            }
            if (p > 0 && endP < 1.15) {
                const headY = startY + (hitY - startY) * Math.min(1.0, Math.max(0, p)); const tailY = startY + (hitY - startY) * Math.min(1.0, Math.max(0, endP));
                const hx = topX[n.lane] + (botX[n.lane] - topX[n.lane]) * Math.min(1.0, Math.max(0, p)); const tx = topX[n.lane] + (botX[n.lane] - topX[n.lane]) * Math.min(1.0, Math.max(0, endP));
                ctx.save(); ctx.strokeStyle = n.holding ? "#ffffff" : laneColors[n.lane].glow; ctx.lineWidth = n.holding ? 28 : 20; ctx.shadowColor = laneColors[n.lane].main; ctx.shadowBlur = n.holding ? 25 : 12; ctx.beginPath(); ctx.moveTo(hx, headY); ctx.lineTo(tx, tailY); ctx.stroke(); ctx.restore();
            }
            if (p > 1.15 && !n.holding && !n.hit) { n.hit = true; combo = 0; hp = Math.max(0, hp - 5); showJudgement("MISS"); updateUI(); }
        } else {
            if (p > 0 && p < 1.15) {
                const cx = topX[n.lane] + (botX[n.lane] - topX[n.lane]) * p; const cy = startY + (hitY - startY) * p;
                ctx.save(); ctx.fillStyle = laneColors[n.lane].main; ctx.shadowColor = laneColors[n.lane].main; ctx.shadowBlur = 22 * p;
                ctx.beginPath();
                if (n.type === 'flick') { ctx.fillStyle = "#ff0077"; ctx.shadowColor = "#ff0077"; ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill(); } 
                else if (currentPerspectiveMode === 1) { ctx.ellipse(cx, cy, 26, 32, 0, 0, Math.PI * 2); ctx.fill(); } 
                else { const rx = (10 * (1.0 - p)) + (28 * p); const ry = (32 * (1.0 - p)) + (14 * p); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
            }
            if (p > 1.08 && !n.hit) { n.hit = true; combo = 0; hp = Math.max(0, hp - 5); showJudgement("MISS"); updateUI(); }
        }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.05; if (p.alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(gameLoop);
}
