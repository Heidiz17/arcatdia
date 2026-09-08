/* =============================================================
   🔒 Arcatdia Battle Engine - 3D 消失點 + 史詩宇宙 (Part 1)
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
let currentMode = 'easy';

// === UI 與圖層控制 ===
let battleBgOpacity = 1.0;
let preloadedSlideImages = [];
let savedData = { title: null, ready: null, battle: [], opacity: 100 };

// === 視角與判定線系統 (源自 v5.3) ===
let currentPerspectiveMode = 1; // 1 = 2D 直軌, 2 = 3D 尖角
const judgeLineOffsets = [165, 185, 205, 225];
let judgeLineLevel = 1; 

const lanePressed = [false, false, false, false];
const laneColors = [
    { main: "#ff0055", glow: "rgba(255, 0, 85, 0.8)" },
    { main: "#ccff00", glow: "rgba(204, 255, 0, 0.8)" },
    { main: "#00ccff", glow: "rgba(0, 204, 255, 0.8)" },
    { main: "#aa00ff", glow: "rgba(170, 0, 255, 0.8)" }
];

function togglePerspectiveMode() {
    currentPerspectiveMode = currentPerspectiveMode === 1 ? 2 : 1;
    showJudgement(currentPerspectiveMode === 1 ? "2D 直軌模式" : "3D 消失點模式");
}
function toggleJudgeLineLevel() {
    judgeLineLevel = (judgeLineLevel + 1) % judgeLineOffsets.length;
    showJudgement(`判定線: LV ${judgeLineLevel + 1}`);
}

function handleResize() { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; initStars(); }
window.addEventListener('resize', handleResize); handleResize();

function compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = function() {
        const cvs = document.createElement('canvas'); const MAX = 1080; 
        let w = img.width; let h = img.height;
        if (w > h && w > MAX) { h *= MAX / w; w = MAX; } else if (h > MAX) { w *= MAX / h; h = MAX; }
        cvs.width = w; cvs.height = h;
        cvs.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(cvs.toDataURL('image/jpeg', 0.6));
    }; img.src = dataUrl;
}

function handleUpload(event, target) {
    const files = event.target.files; if (!files || files.length === 0) return;
    if (target === 'battle') {
        preloadedSlideImages = []; savedData.battle = [];
        for (let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.onload = function(e) { compressImage(e.target.result, (compressed) => { const img = new Image(); img.src = compressed; preloadedSlideImages.push(img); savedData.battle.push(compressed); }); };
            reader.readAsDataURL(files[i]);
        }
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            compressImage(e.target.result, (compressed) => {
                const el = document.getElementById(target + 'Bg');
                if (el) { el.style.backgroundImage = `url('${compressed}')`;}
                savedData[target] = compressed;
            });
        }; reader.readAsDataURL(files[0]);
    }
}
function updateSlideOpacity(val) { battleBgOpacity = parseFloat(val) / 100; savedData.opacity = parseInt(val, 10); }
function saveSettings() {
    try { localStorage.setItem('arcatdia_save', JSON.stringify(savedData)); alert("💾 存檔成功！"); } 
    catch (e) { alert("相片太大儲存失敗。"); }
}

window.onload = function() {
    const saved = localStorage.getItem('arcatdia_save');
    if (saved) {
        try {
            savedData = JSON.parse(saved);
            ['title', 'ready'].forEach(t => {
                if (savedData[t]) { const el = document.getElementById(t + 'Bg'); if(el) { el.style.backgroundImage = `url('${savedData[t]}')`;}}});
            if (savedData.battle) { savedData.battle.forEach(src => { const img = new Image(); img.src = src; preloadedSlideImages.push(img); }); }
            if (savedData.opacity !== undefined) { battleBgOpacity = savedData.opacity / 100; const slider = document.getElementById('opacitySlider'); if (slider) slider.value = savedData.opacity; }
        } catch(e) {}
    }
};

// === 嚴格限制：單一 Master MP3 ===
const currentSong = { id: "01", title: "最大の愛", folder: "songs/01_最大の愛", fileName: "master.mp3", bpm: 175 };
const masterAudio = new Audio();
try { masterAudio.src = encodeURI(`${currentSong.folder}/${currentSong.fileName}`); masterAudio.preload = "auto"; } catch (e) {}

const AudioContextClass = window.AudioContext || window.webkitAudioContext; let dspCtx = null;
function initDSP() { try { if (!dspCtx) dspCtx = new AudioContextClass(); if (dspCtx.state === 'suspended') dspCtx.resume(); } catch (e) {} }
function playStickClick(freq = 1200) {
    if (!dspCtx) return;
    try { const osc = dspCtx.createOscillator(); const gain = dspCtx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(freq, dspCtx.currentTime); gain.gain.setValueAtTime(0.8, dspCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, dspCtx.currentTime + 0.04); osc.connect(gain); gain.connect(dspCtx.destination); osc.start(); osc.stop(dspCtx.currentTime + 0.04); } catch (e) {}
}

// === 嚴謹樂理生成譜面 ===
function generateChart() {
    notes = []; particles = [];
    const beatMs = (60 / bpm) * 1000;
    let currentTime = 4 * beatMs; // 開場前奏
    let lastLane = 1;

    if (currentMode === 'test') {
        // Test: 全四分音符 (1拍)，全落 L1 (lane 0) 作為校準場
        for (let i = 0; i < 600; i++) {
            notes.push({ type: 'tap', lane: 0, targetTime: currentTime, hit: false });
            currentTime += beatMs;
        }
    } else if (currentMode === 'easy') {
        // Easy: 全音符(4拍) 與 二分音符(2拍)
        for (let i = 0; i < 200; i++) {
            lastLane = (lastLane + 1) % 4;
            notes.push({ type: 'tap', lane: lastLane, targetTime: currentTime, hit: false });
            currentTime += Math.random() > 0.5 ? beatMs * 4 : beatMs * 2;
        }
    } else if (currentMode === 'normal') {
        // Normal: 二分音符(2拍) 與 四分音符(1拍)
        for (let i = 0; i < 400; i++) {
            lastLane = Math.floor(Math.random() * 4);
            notes.push({ type: 'tap', lane: lastLane, targetTime: currentTime, hit: false });
            currentTime += Math.random() > 0.5 ? beatMs * 2 : beatMs;
        }
    }
    notes.sort((a, b) => a.targetTime - b.targetTime);
}

// === 宇宙史詩導航 (源自 v5.3) ===
function initStars() { stars = []; for (let i = 0; i < 80; i++) { stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 2 + 1, speed: Math.random() * 1.5 + 0.5, alpha: Math.random() }); } }
function initCelestialJourney() {
    celestialEvents = [
        { timeSec: 2, duration: 8, planets: [{ name: "🌍 地球起航", color: "rgba(0, 160, 255, 0.32)", radius: 65, xRatio: 0.72, yRatio: 0.20 }] },
        { timeSec: 25, duration: 8, planets: [{ name: "🌟 啟明星・金星", color: "rgba(255, 205, 80, 0.32)", radius: 60, xRatio: 0.70, yRatio: 0.22 }] },
        { timeSec: 52, duration: 11, planets: [
            { name: "🪐 木星風暴", color: "rgba(235, 140, 60, 0.32)", radius: 78, xRatio: 0.60, yRatio: 0.18 },
            { name: "🪐 土星光環", color: "rgba(240, 210, 140, 0.32)", radius: 55, xRatio: 0.82, yRatio: 0.26, hasRing: true }
        ]},
        { timeSec: 88, duration: 11, planets: [
            { name: "🧊 天王星", color: "rgba(120, 235, 235, 0.32)", radius: 52, xRatio: 0.62, yRatio: 0.20 },
            { name: "🌊 海王星", color: "rgba(65, 105, 225, 0.35)", radius: 50, xRatio: 0.80, yRatio: 0.25 }
        ]},
        { timeSec: 122, duration: 9, planets: [{ name: "❄️ 冥王星冰界", color: "rgba(195, 220, 240, 0.28)", radius: 42, xRatio: 0.72, yRatio: 0.22 }] },
        { timeSec: 148, duration: 12, planets: [{ name: "🌌 阿卡迪亞星雲", color: "rgba(180, 60, 255, 0.35)", radius: 95, xRatio: 0.70, yRatio: 0.18 }] },
        { timeSec: 175, duration: 25, planets: [{ name: "🐾 抵達：阿卡迪亞貓星", color: "rgba(255, 105, 180, 0.42)", radius: 115, xRatio: 0.68, yRatio: 0.18 }] }
    ];
}
/* =============================================================
   🔒 Arcatdia Battle Engine - (Part 2 渲染與控制)
   ============================================================= */

function goToReadyRoom() {
    document.getElementById('titleScreen').classList.remove('active');
    document.getElementById('titleBg').classList.remove('active');
    document.getElementById('readyRoom').classList.add('active');
    document.getElementById('readyBg').classList.add('active');
    initDSP();
}
function returnToTitle() {
    document.getElementById('readyRoom').classList.remove('active');
    document.getElementById('readyBg').classList.remove('active');
    document.getElementById('titleScreen').classList.add('active');
    document.getElementById('titleBg').classList.add('active');
}
function returnToReadyRoom() {
    document.getElementById('pauseMenu').classList.remove('active');
    document.getElementById('battleHud').style.display = 'none';
    document.getElementById('touchController').style.display = 'none';
    document.getElementById('readyBg').classList.add('active');
    document.getElementById('readyRoom').classList.add('active');
    isPaused = false; isPlaying = false;
    masterAudio.pause(); masterAudio.currentTime = 0; clearAllTimers(); ctx.clearRect(0, 0, W, H);
}

function startVoyage() {
    document.getElementById('readyRoom').classList.remove('active');
    document.getElementById('readyBg').classList.remove('active');
    document.getElementById('battleHud').style.display = 'flex';
    document.getElementById('touchController').style.display = 'flex';
    score = 0; combo = 0; hp = 100; totalPausedDuration = 0;
    updateUI(); initStars(); initCelestialJourney(); generateChart();
    isPlaying = true; isPaused = false; startTime = performance.now();
    scheduleCountInAndPlay(); requestAnimationFrame(gameLoop);
}

function selectDifficulty(mode) {
    currentMode = mode; document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'easy') document.getElementById('btnDiffEasy').classList.add('active');
    if (mode === 'normal') document.getElementById('btnDiffNormal').classList.add('active');
    if (mode === 'test') document.getElementById('btnDiffTest').classList.add('active');
}

function pauseGame() { if (!isPlaying || isPaused) return; isPaused = true; pauseStartTime = performance.now(); masterAudio.pause(); clearAllTimers(); document.getElementById('pauseMenu').classList.add('active'); }
function resumeGame() { if (!isPaused) return; document.getElementById('pauseMenu').classList.remove('active'); totalPausedDuration += (performance.now() - pauseStartTime); isPaused = false; masterAudio.play().catch(()=>{}); requestAnimationFrame(gameLoop); }
function restartFromPause() { document.getElementById('pauseMenu').classList.remove('active'); isPaused = false; startVoyage(); }

function createHitParticles(x, y, color) {
    if (particles.length > 30) particles.splice(0, 10);
    for (let i = 0; i < 8; i++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 6 + 2; particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 4 + 2, color: color, alpha: 1.0 }); }
}

for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        const press = (e) => { e.preventDefault(); laneBtn.classList.add('pressed'); lanePressed[i] = true; handleTap(i); };
        const release = (e) => { e.preventDefault(); laneBtn.classList.remove('pressed'); lanePressed[i] = false; };
        laneBtn.addEventListener('touchstart', press); laneBtn.addEventListener('touchend', release);
        laneBtn.addEventListener('mousedown', press); laneBtn.addEventListener('mouseup', release);
    }
}

function handleTap(laneIndex) {
    if (!isPlaying || isPaused) return;
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    
    const laneW = W / 4;
    const currentHitY = H - judgeLineOffsets[judgeLineLevel];
    // 根據 2D/3D 計算落點 X
    let targetX;
    if (currentPerspectiveMode === 1) {
        targetX = laneW * laneIndex + (laneW / 2);
    } else {
        const topXArr = [W * 0.44, W * 0.48, W * 0.52, W * 0.56];
        const botXArr = [laneW * 0.5, laneW * 1.5, laneW * 2.5, laneW * 3.5];
        targetX = botXArr[laneIndex]; // 撞線時喺底部
    }

    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit);
    if (targetNote && Math.abs(currentTimeMs - targetNote.targetTime) < 200) {
        targetNote.hit = true; score += 1000; combo++; hp = Math.min(100, hp + 2);
        showJudgement("PERFECT!"); createHitParticles(targetX, currentHitY, "#ffffff"); updateUI();
    }
}

function updateUI() {
    const scoreVal = document.getElementById('scoreVal');
    if (scoreVal) scoreVal.innerText = String(score).padStart(6, '0');
    const hpFill = document.getElementById('hpFill');
    if (hpFill) hpFill.style.width = `${hp}%`;
    const comboDisp = document.getElementById('comboDisplay');
    if (comboDisp && combo > 1) { comboDisp.innerText = `${combo} COMBO`; comboDisp.style.opacity = '1'; }
}

function showJudgement(text) { const disp = document.getElementById('judgementDisplay'); if (disp) { disp.innerText = text; disp.style.opacity = '1'; setTimeout(() => { disp.style.opacity = '0'; }, 300); } }

let countInTimers = []; let audioStartTimer = null;
function clearAllTimers() { countInTimers.forEach(t => clearTimeout(t)); countInTimers = []; if (audioStartTimer) { clearTimeout(audioStartTimer); audioStartTimer = null; } }
function scheduleCountInAndPlay() {
    clearAllTimers(); const beatMs = (60 / bpm) * 1000;
    [0, 1, 2, 3].forEach(b => { countInTimers.push(setTimeout(() => { if (!isPlaying || isPaused) return; playStickClick(b === 3 ? 1800 : 1200); showJudgement(`${b + 1}`); }, (b * beatMs) / playbackSpeed)); });
    audioStartTimer = setTimeout(() => { if (!isPlaying || isPaused) return; masterAudio.playbackRate = playbackSpeed; masterAudio.currentTime = 0; masterAudio.play().catch(() => {}); }, (beatMs * 4) / playbackSpeed);
}

function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, W, H);
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;

    // 🎨 戰鬥幻燈片：2秒淡入 -> 4秒展示 -> 2秒淡出 (總週期 21秒)
    if (preloadedSlideImages.length > 0 && battleBgOpacity > 0.01) {
        const cycleLength = 21;
        const localTime = currentSec % cycleLength;
        const slideIndex = Math.floor(currentSec / cycleLength) % preloadedSlideImages.length;
        
        let slideAlpha = 0;
        if (localTime < 2) slideAlpha = localTime / 2; // 淡入
        else if (localTime < 6) slideAlpha = 1.0;      // 停留
        else if (localTime < 8) slideAlpha = 1.0 - ((localTime - 6) / 2); // 淡出
        else slideAlpha = 0; // 星空留白
        
        const finalAlpha = slideAlpha * battleBgOpacity;
        
        if (finalAlpha > 0.01) {
            const img = preloadedSlideImages[slideIndex];
            if (img && img.complete && img.naturalWidth !== 0) {
                ctx.save();
                ctx.globalAlpha = finalAlpha; 
                const imgRatio = img.width / img.height;
                const screenRatio = W / H;
                let drawW = W, drawH = W / imgRatio;
                if (screenRatio <= imgRatio) { drawH = H; drawW = H * imgRatio; }
                ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
                ctx.restore();
            }
        }
    }

    // 🎯 星空
    stars.forEach(s => { ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill(); s.y += s.speed * 1.5; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });

    // 🎯 行星事件 (含 5.3 土星環)
    celestialEvents.forEach(evt => {
        if (currentSec >= evt.timeSec && currentSec <= evt.timeSec + evt.duration) {
            const progress = (currentSec - evt.timeSec) / evt.duration;
            const alpha = Math.sin(progress * Math.PI) * 0.40;
            evt.planets.forEach(p => {
                ctx.save(); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 45;
                const px = W * p.xRatio - (progress * 40); const py = H * p.yRatio + (progress * 30);
                ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.fill();
                if (p.hasRing) {
                    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35); ctx.strokeStyle = "rgba(240, 220, 160, 0.55)"; ctx.lineWidth = 6;
                    ctx.beginPath(); ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
                }
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.8})`; ctx.font = "bold 13px sans-serif"; ctx.fillText(p.name, px - 40, py + p.radius + 20);
                ctx.restore();
            });
        }
    });

    const hitY = H - judgeLineOffsets[judgeLineLevel];
    const startY = 20;
    const laneW = W / 4;
    const botX = [laneW * 0.5, laneW * 1.5, laneW * 2.5, laneW * 3.5];
    const topX = (currentPerspectiveMode === 1) ? botX : [W * 0.44, W * 0.48, W * 0.52, W * 0.56];

    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = laneColors[i].glow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(topX[i], startY); ctx.lineTo(botX[i], H); ctx.stroke();
        ctx.fillStyle = laneColors[i].main; ctx.beginPath(); ctx.arc(botX[i], hitY, 22, 0, Math.PI * 2); ctx.fill();
    }

    const beatMs = (60 / bpm) * 1000;
    const tDur = (beatMs * 4) / scrollSpeedMultiplier; 

    notes.forEach(n => {
        if (n.hit) return;
        const p = 1.0 - ((n.targetTime - currentTimeMs) / tDur);
        if (p > 0 && p < 1.15) {
            const cx = topX[n.lane] + (botX[n.lane] - topX[n.lane]) * p;
            const cy = startY + (hitY - startY) * p;
            ctx.fillStyle = laneColors[n.lane].main; ctx.shadowColor = laneColors[n.lane].main; ctx.shadowBlur = 15;
            ctx.beginPath();
            if (currentPerspectiveMode === 1) { ctx.ellipse(cx, cy, 26, 32, 0, 0, Math.PI * 2); } 
            else { const rx = (10 * (1.0 - p)) + (26 * p); const ry = (32 * (1.0 - p)) + (14 * p); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }
            ctx.fill();
        }
        if (p > 1.08 && !n.hit) { n.hit = true; combo = 0; hp = Math.max(0, hp - 5); showJudgement("MISS"); updateUI(); }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.05; if (p.alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(gameLoop);
}
