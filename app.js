/* =============================================================
   🔒 Arcatdia Battle Engine - v2 (第1拍正位 + 1943能源Bar版) Part 1
   ============================================================= */

const canvas = document.getElementById('battleCanvas');
const ctx = canvas.getContext('2d');

let W = window.innerWidth;
let H = window.innerHeight;

// 🌟 核心參數與狀態
let bpm = 175;
let isPlaying = false;
let isPaused = false;
let score = 0;
let combo = 0;
let hp = 100;
let notes = [];
let particles = [];
let stars = []; 
let celestialEvents = [];
let startTime = 0;
let pauseStartTime = 0;
let totalPausedDuration = 0;

let playbackSpeed = 1.0;
let scrollSpeedMultiplier = 1.0; 
let currentMode = 'easy';

const judgeLineOffsets = [165, 185, 205, 225];
let judgeLineLevel = 1; 

const lanePressed = [false, false, false, false];
const laneColors = [
    { main: "#ff0055", glow: "rgba(255, 0, 85, 0.8)" },
    { main: "#ccff00", glow: "rgba(204, 255, 0, 0.8)" },
    { main: "#00ccff", glow: "rgba(0, 204, 255, 0.8)" },
    { main: "#aa00ff", glow: "rgba(170, 0, 255, 0.8)" }
];

function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 2 + 1, speed: Math.random() * 1.5 + 0.5, alpha: Math.random() });
    }
}

function handleResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    initStars(); 
}
window.addEventListener('resize', handleResize);
handleResize(); 

// 📸 三層獨立視覺上載與透明度控制
let preloadedSlideImages = [];

function handleUpload(event, target) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (target === 'battle') {
        preloadedSlideImages = [];
        for (let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.src = e.target.result;
                preloadedSlideImages.push(img);
            };
            reader.readAsDataURL(files[i]);
        }
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (target === 'title') {
                const el = document.getElementById('titleBg');
                if (el) el.style.backgroundImage = `url(${e.target.result})`;
            } else if (target === 'ready') {
                const el = document.getElementById('readyBg');
                if (el) el.style.backgroundImage = `url(${e.target.result})`;
            }
        };
        reader.readAsDataURL(files[0]);
    }
}

function updateGlassOpacity(val) {
    const opacity = val / 100;
    document.documentElement.style.setProperty('--glass-opacity', opacity);
    document.documentElement.style.setProperty('--battle-frost', (opacity * 0.65).toFixed(2));
    const mask = document.getElementById('battleGlassMask');
    if (mask) {
        mask.style.backdropFilter = `blur(${Math.round(val * 0.08)}px)`;
    }
}

function toggleWallpaperDrawer() {
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.toggle('open');
}

// 🎵 音樂載入 (防死火 Try-Catch)
const songDatabase = [{ id: "01", title: "最大の愛", folder: "songs/01_最大の愛", fileName: "master.mp3", bpm: 175 }];
let currentSong = songDatabase[0];
const masterAudio = new Audio();
try {
    masterAudio.src = encodeURI(`${currentSong.folder}/${currentSong.fileName}`);
    masterAudio.preload = "auto";
} catch (e) {
    console.error("Audio error:", e);
}
bpm = currentSong.bpm;

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

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let dspCtx = null;
function initDSP() {
    try {
        if (!dspCtx) dspCtx = new AudioContextClass();
        if (dspCtx.state === 'suspended') dspCtx.resume();
    } catch (e) {}
}

function playStickClick(freq = 1200) {
    if (!dspCtx) return;
    try {
        const osc = dspCtx.createOscillator();
        const gain = dspCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, dspCtx.currentTime);
        gain.gain.setValueAtTime(0.8, dspCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, dspCtx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(dspCtx.destination);
        osc.start();
        osc.stop(dspCtx.currentTime + 0.04);
    } catch (e) {}
}
/* =============================================================
   🔒 Arcatdia Battle Engine - v2 (第1拍正位 + 1943能源Bar版) Part 2
   ============================================================= */

function goToReadyRoom() {
    const ts = document.getElementById('titleScreen'); if (ts) ts.classList.remove('active');
    const tb = document.getElementById('titleBg'); if (tb) tb.classList.remove('active');
    const rr = document.getElementById('readyRoom'); if (rr) rr.classList.add('active');
    const rb = document.getElementById('readyBg'); if (rb) rb.classList.add('active');
    initDSP();
}

function returnToReadyRoom() {
    const pm = document.getElementById('pauseMenu'); if (pm) pm.classList.remove('active');
    const hud = document.getElementById('battleHud'); if (hud) hud.style.display = 'none';
    const tc = document.getElementById('touchController'); if (tc) tc.style.display = 'none';
    const rb = document.getElementById('readyBg'); if (rb) rb.classList.add('active');
    const rr = document.getElementById('readyRoom'); if (rr) rr.classList.add('active');

    isPaused = false; isPlaying = false;
    masterAudio.pause(); masterAudio.currentTime = 0;
    clearAllTimers();
    ctx.clearRect(0, 0, W, H);
}

function startVoyage() {
    const rr = document.getElementById('readyRoom'); if (rr) rr.classList.remove('active');
    const rb = document.getElementById('readyBg'); if (rb) rb.classList.remove('active');
    const hud = document.getElementById('battleHud'); if (hud) hud.style.display = 'flex';
    const tc = document.getElementById('touchController'); if (tc) tc.style.display = 'flex';

    score = 0; combo = 0; hp = 100;
    totalPausedDuration = 0;
    updateUI();
    initStars();
    initCelestialJourney();
    generateChart();
    isPlaying = true;
    isPaused = false;
    startTime = performance.now();
    scheduleCountInAndPlay();
    requestAnimationFrame(gameLoop);
}

function selectDifficulty(mode) {
    currentMode = mode;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'easy') { const b = document.getElementById('btnDiffEasy'); if (b) b.classList.add('active'); }
    if (mode === 'normal') { const b = document.getElementById('btnDiffNormal'); if (b) b.classList.add('active'); }
    if (mode === 'test') { const b = document.getElementById('btnDiffTest'); if (b) b.classList.add('active'); }
}

function pauseGame() {
    if (!isPlaying || isPaused) return;
    isPaused = true; pauseStartTime = performance.now();
    masterAudio.pause(); clearAllTimers();
    const pm = document.getElementById('pauseMenu'); if (pm) pm.classList.add('active');
}

function resumeGame() {
    if (!isPaused) return;
    const pm = document.getElementById('pauseMenu'); if (pm) pm.classList.remove('active');
    totalPausedDuration += (performance.now() - pauseStartTime);
    isPaused = false;
    masterAudio.play().catch(() => {});
    requestAnimationFrame(gameLoop);
}

function restartFromPause() {
    const pm = document.getElementById('pauseMenu'); if (pm) pm.classList.remove('active');
    isPaused = false;
    startVoyage();
}

function createHitParticles(x, y, color) {
    if (particles.length > 30) particles.splice(0, 10);
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 4 + 2, color: color, alpha: 1.0 });
    }
}

// 🎯 核心拍子修復：準確落喺第 1 拍！
function generateChart() {
    notes = []; particles = [];
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4;
    
    // Count-in 有 4 拍，所以「第 1 拍」落點正正喺第 4 拍完結嗰一刻 (4 * beatMs)
    const firstBeatOffset = 4 * beatMs;
    let lastLane = 1;

    for (let bar = 0; bar < 145; bar++) {
        lastLane = (lastLane + 1) % 4;
        // 第一粒音準確落喺第一拍，其後每個 Bar 嘅第 1 拍落一粒！
        notes.push({ 
            type: 'tap', 
            lane: lastLane, 
            targetTime: firstBeatOffset + (bar * barMs), 
            hit: false 
        });
    }
    notes.sort((a, b) => a.targetTime - b.targetTime);
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
    const targetX = (W / 4) * laneIndex + (W / 8);
    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit);

    if (targetNote && Math.abs(currentTimeMs - targetNote.targetTime) < 200) {
        targetNote.hit = true; score += 1000; combo++; hp = Math.min(100, hp + 2);
        showJudgement("PERFECT!");
        createHitParticles(targetX, H - 185, "#ffffff");
        updateUI();
    }
}

// 🕹️ 1943 街機復古能源 Bar + 分數加大渲染
function updateUI() {
    const scoreVal = document.getElementById('scoreVal');
    if (scoreVal) {
        scoreVal.innerText = String(score).padStart(6, '0');
        // 分數放大醒目 Style
        scoreVal.style.fontSize = "24px";
        scoreVal.style.fontWeight = "900";
        scoreVal.style.letterSpacing = "2px";
        scoreVal.style.textShadow = "0 0 12px #ffcc00";
    }

    const hpFill = document.getElementById('hpFill');
    if (hpFill) {
        hpFill.style.width = `${hp}%`;
        // 1943 街機能量條經典格仔紋
        hpFill.style.background = "repeating-linear-gradient(90deg, #ff0055 0px, #ffaa00 12px, #00ffcc 24px)";
        hpFill.style.boxShadow = "0 0 12px #00ffcc";
        hpFill.style.height = "6px";
    }

    const comboDisp = document.getElementById('comboDisplay');
    if (comboDisp && combo > 1) { 
        comboDisp.innerText = `${combo} COMBO`; 
        comboDisp.style.opacity = '1'; 
    }
}

function showJudgement(text) {
    const disp = document.getElementById('judgementDisplay');
    if (disp) {
        disp.innerText = text; disp.style.opacity = '1';
        setTimeout(() => { disp.style.opacity = '0'; }, 300);
    }
}

let countInTimers = []; let audioStartTimer = null;
function clearAllTimers() { countInTimers.forEach(t => clearTimeout(t)); countInTimers = []; if (audioStartTimer) { clearTimeout(audioStartTimer); audioStartTimer = null; } }

function scheduleCountInAndPlay() {
    clearAllTimers();
    const beatMs = (60 / bpm) * 1000;
    // 預備拍 1-2-3-4
    [0, 1, 2, 3].forEach(b => {
        countInTimers.push(setTimeout(() => {
            if (!isPlaying || isPaused) return;
            playStickClick(b === 3 ? 1800 : 1200); 
            showJudgement(`${b + 1}`);
        }, (b * beatMs) / playbackSpeed));
    });

    // 正好喺第 4 拍完結（即第 1 拍開始時）音樂準時起跑！
    audioStartTimer = setTimeout(() => {
        if (!isPlaying || isPaused) return;
        masterAudio.playbackRate = playbackSpeed; 
        masterAudio.currentTime = 0; 
        masterAudio.play().catch(() => {});
    }, (beatMs * 4) / playbackSpeed);
}

// 🎯 主循環：Canvas 幻燈片、星空與音符渲染
function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, W, H);
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;

    // 📸 戰鬥幻燈片 (每 5.5 秒優雅切換)
    if (preloadedSlideImages.length > 0) {
        const slideIndex = Math.floor(currentSec / 5.5);
        if (slideIndex < preloadedSlideImages.length) {
            const img = preloadedSlideImages[slideIndex];
            if (img.complete && img.naturalWidth !== 0) {
                ctx.save(); ctx.globalAlpha = 0.45;
                const r = W / H > img.width / img.height;
                const dW = r ? W : H * (img.width / img.height);
                const dH = r ? W / (img.width / img.height) : H;
                ctx.drawImage(img, (W - dW) / 2, (H - dH) / 2, dW, dH);
                ctx.restore();
            }
        }
    }

    stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
        s.y += s.speed * 1.5; if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });

    celestialEvents.forEach(evt => {
        if (currentSec >= evt.timeSec && currentSec <= evt.timeSec + evt.duration) {
            const progress = (currentSec - evt.timeSec) / evt.duration;
            evt.planets.forEach(p => {
                ctx.save(); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 35;
                const px = W * p.xRatio - (progress * 40), py = H * p.yRatio + (progress * 30);
                ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.fill();
                if (p.hasRing) {
                    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35); ctx.strokeStyle = "rgba(240, 220, 160, 0.55)"; ctx.lineWidth = 6;
                    ctx.beginPath(); ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
                }
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(progress * Math.PI) * 0.72})`;
                ctx.font = "bold 13px 'Zen Maru Gothic', sans-serif"; ctx.fillText(p.name, px - 40, py + p.radius + 20); ctx.restore();
            });
        }
    });

    const hitY = H - 185; const botX = [W*0.125, W*0.375, W*0.625, W*0.875];
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = laneColors[i].glow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(botX[i], 20); ctx.lineTo(botX[i], H); ctx.stroke();
        ctx.fillStyle = laneColors[i].main; ctx.beginPath(); ctx.arc(botX[i], hitY, 22, 0, Math.PI * 2); ctx.fill();
    }

    // 飛行時間對齊 4 拍（剛好跟 Count-in 同步起飛）
    const beatMs = (60 / bpm) * 1000;
    const tDur = (beatMs * 4) / scrollSpeedMultiplier;

    notes.forEach(n => {
        if (n.hit) return;
        const p = 1.0 - ((n.targetTime - currentTimeMs) / tDur);
        if (p > 0 && p < 1.15) {
            ctx.fillStyle = laneColors[n.lane].main; ctx.shadowColor = laneColors[n.lane].main; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.ellipse(botX[n.lane], 20 + (hitY - 20) * p, 26, 32, 0, 0, Math.PI * 2); ctx.fill();
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
