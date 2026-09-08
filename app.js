/* =============================================================
   🔒 Arcatdia Battle Engine - 屠龍刀黃金 Demo 版 (Part 1)
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
let savedData = { title: null, ready: null, battle: [], opacity: 100 };

// 🎯 預設 2 = 3D 消失點開局！
let currentPerspectiveMode = 2; 
const judgeLineOffsets = [165, 185, 205, 225];
let judgeLineLevel = 1; 

const lanePressed = [false, false, false, false];
const laneTouchStartY = [0, 0, 0, 0]; // 用於 Flick 上滑判定
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

// === Web Audio 音軌管理 ===
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let bgmGainNode = null;
let sfxGainNode = null;
let sfxBuffers = {};

function initAudioEngine() {
    if (!audioCtx) {
        audioCtx = new AudioContextClass();
        bgmGainNode = audioCtx.createGain();
        sfxGainNode = audioCtx.createGain();
        bgmGainNode.connect(audioCtx.destination);
        sfxGainNode.connect(audioCtx.destination);
        loadSFXFiles();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// 載入精確 5 粒 WAV
const soundPaths = {
    tap: "sounds/arcatdia_perfect_tap.wav",
    flick: "sounds/arcatdia_perfect_flick.wav",
    hold: "sounds/arcatdia_hold.wav",
    tick: "sounds/arcatdia_tick.wav",
    stage: "sounds/arcatdia_stage_tap.wav"
};

async function loadSFXFiles() {
    for (let key in soundPaths) {
        try {
            const resp = await fetch(soundPaths[key]);
            const ab = await resp.arrayBuffer();
            audioCtx.decodeAudioData(ab, (buf) => { sfxBuffers[key] = buf; });
        } catch(e) {
            // 若相對路徑 sounds/ 找不到，自動退回根目錄載入
            try {
                const resp2 = await fetch(soundPaths[key].replace('sounds/', ''));
                const ab2 = await resp2.arrayBuffer();
                audioCtx.decodeAudioData(ab2, (buf) => { sfxBuffers[key] = buf; });
            } catch(err) {}
        }
    }
}

function playSFX(key) {
    if (!audioCtx || !sfxBuffers[key]) return;
    try {
        const src = audioCtx.createBufferSource();
        src.buffer = sfxBuffers[key];
        src.connect(sfxGainNode);
        src.start(0);
    } catch(e) {}
}

function updateBgmVolume(val) {
    if (bgmGainNode) bgmGainNode.gain.value = parseFloat(val);
    document.getElementById('valBgm').innerText = Math.round(val * 100) + "%";
}
function updateSfxVolume(val) {
    if (sfxGainNode) sfxGainNode.gain.value = parseFloat(val);
    document.getElementById('valSfx').innerText = Math.round(val * 100) + "%";
}

// === Master BGM 音訊 ===
const currentSong = { id: "01", title: "最大の愛", folder: "songs/01_最大の愛", fileName: "master.mp3", bpm: 175 };
const masterAudio = new Audio();
try { masterAudio.src = encodeURI(`${currentSong.folder}/${currentSong.fileName}`); masterAudio.preload = "auto"; } catch (e) {}

let bgmSourceNode = null;
function hookMasterAudioNode() {
    if (audioCtx && !bgmSourceNode) {
        try {
            bgmSourceNode = audioCtx.createMediaElementSource(masterAudio);
            bgmSourceNode.connect(bgmGainNode);
        } catch(e) {}
    }
}

function playStickClick(freq = 1200) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(sfxGainNode);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {}
}

// === 生成譜面（加入 Flick 與 Hold 混合） ===
function generateChart() {
    notes = []; particles = [];
    const beatMs = (60 / bpm) * 1000;
    let currentTime = 5 * beatMs;
    let lastLane = 1;

    if (currentMode === 'test') {
        for (let i = 0; i < 150; i++) {
            const nType = (i % 4 === 3) ? 'flick' : 'tap';
            notes.push({ type: nType, lane: 0, targetTime: currentTime, hit: false });
            currentTime += (beatMs * 4);
        }
    } else {
        for (let i = 0; i < 350; i++) {
            lastLane = (lastLane + 1) % 4;
            const r = Math.random();
            if (r < 0.6) {
                notes.push({ type: 'tap', lane: lastLane, targetTime: currentTime, hit: false });
            } else if (r < 0.85) {
                notes.push({ type: 'flick', lane: lastLane, targetTime: currentTime, hit: false });
            } else {
                notes.push({ type: 'hold', lane: lastLane, targetTime: currentTime, duration: beatMs * 1.5, hit: false, holding: false, lastTick: 0 });
            }
            currentTime += (r > 0.5 ? beatMs * 2 : beatMs);
        }
    }
    notes.sort((a, b) => a.targetTime - b.targetTime);
}

// === 宇宙史詩導航 ===
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

function goToReadyRoom() {
    document.getElementById('titleScreen').classList.remove('active');
    document.getElementById('titleBg').classList.remove('active');
    document.getElementById('readyRoom').classList.add('active');
    const rb = document.getElementById('readyBg'); if (rb) rb.classList.add('active');
    initAudioEngine();
}
function returnToTitle() {
    document.getElementById('readyRoom').classList.remove('active');
    document.getElementById('readyBg').classList.remove('active');
    document.getElementById('titleScreen').classList.add('active');
    const tb = document.getElementById('titleBg'); if (tb) tb.classList.add('active');
}
function returnToReadyRoom() {
    document.getElementById('pauseMenu').classList.remove('active');
    document.getElementById('battleHud').style.display = 'none';
    document.getElementById('touchController').style.display = 'none';
    const rb = document.getElementById('readyBg'); if (rb) rb.classList.add('active');
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
    hookMasterAudioNode();
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
    for (let i = 0; i < 8; i++) { 
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 6 + 2; 
        particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 4 + 2, color: color, alpha: 1.0 }); 
    }
}

// === 觸控事件：支援 Tap、Flick 向上劃動、Hold 按住、以及 Stage 空打 ===
for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        laneBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            laneBtn.classList.add('pressed');
            lanePressed[i] = true;
            laneTouchStartY[i] = e.touches[0].clientY;
            handleAction(i, 'down');
        }, { passive: false });

        laneBtn.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            if (laneTouchStartY[i] - currentY > 20) {
                handleAction(i, 'flick');
                laneTouchStartY[i] = currentY;
            }
        });

        laneBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            laneBtn.classList.remove('pressed');
            lanePressed[i] = false;
            handleAction(i, 'up');
        }, { passive: false });

        laneBtn.addEventListener('mousedown', (e) => {
            laneBtn.classList.add('pressed');
            lanePressed[i] = true;
            handleAction(i, 'down');
        });
        laneBtn.addEventListener('mouseup', () => {
            laneBtn.classList.remove('pressed');
            lanePressed[i] = false;
            handleAction(i, 'up');
        });
    }
}
/* =============================================================
   🔒 Arcatdia Battle Engine - 屠龍刀黃金 Demo 版 (Part 2)
   ============================================================= */

function handleAction(laneIndex, actionType) {
    if (!isPlaying || isPaused) return;
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentHitY = H - judgeLineOffsets[judgeLineLevel];
    const laneW = W / 4;
    const targetX = laneW * laneIndex + (laneW / 2);

    if (actionType === 'down') {
        const targetNote = notes.find(n => n.lane === laneIndex && !n.hit && Math.abs(currentTimeMs - n.targetTime) < 220);
        if (targetNote) {
            if (targetNote.type === 'tap') {
                targetNote.hit = true; score += 1000; combo++; hp = Math.min(100, hp + 2);
                playSFX('tap');
                showJudgement("PERFECT!"); createHitParticles(targetX, currentHitY, "#ffffff"); updateUI();
            } else if (targetNote.type === 'hold') {
                targetNote.holding = true; targetNote.lastTick = currentTimeMs;
                playSFX('hold');
                showJudgement("HOLD!"); createHitParticles(targetX, currentHitY, laneColors[laneIndex].main); updateUI();
            }
        } else {
            // 🎯 Stage 空打：冇音符嗰陣發出 stage 敲擊聲，唔扣血！
            playSFX('stage');
            createHitParticles(targetX, currentHitY, "rgba(0, 255, 204, 0.4)");
        }
    } else if (actionType === 'flick') {
        const flickNote = notes.find(n => n.lane === laneIndex && !n.hit && n.type === 'flick' && Math.abs(currentTimeMs - n.targetTime) < 260);
        if (flickNote) {
            flickNote.hit = true; score += 1200; combo++; hp = Math.min(100, hp + 3);
            playSFX('flick');
            showJudgement("FLICK!!"); createHitParticles(targetX, currentHitY, "#ff0077"); updateUI();
        }
    } else if (actionType === 'up') {
        const holdingNote = notes.find(n => n.lane === laneIndex && n.type === 'hold' && n.holding && !n.hit);
        if (holdingNote) {
            holdingNote.holding = false; holdingNote.hit = true;
            score += 500; updateUI();
        }
    }
}

// === 1943 街機能量條四階切換 ===
function updateUI() {
    const scoreVal = document.getElementById('scoreVal');
    if (scoreVal) scoreVal.innerText = String(score).padStart(6, '0');
    
    const hpFill = document.getElementById('hpFill');
    if (hpFill) {
        hpFill.style.width = `${hp}%`;
        hpFill.className = 'hp-fill';
        if (hp <= 25) hpFill.classList.add('lvl-c');
        else if (hp <= 60) hpFill.classList.add('lvl-b');
        else if (hp <= 85) hpFill.classList.add('lvl-a');
        else hpFill.classList.add('lvl-s');
    }
    
    const comboDisp = document.getElementById('comboDisplay');
    if (comboDisp && combo > 1) { comboDisp.innerText = `${combo} COMBO`; comboDisp.style.opacity = '1'; }
}

function showJudgement(text) { 
    const disp = document.getElementById('judgementDisplay'); 
    if (disp) { 
        disp.innerText = text; disp.style.opacity = '1'; 
        setTimeout(() => { disp.style.opacity = '0'; }, 280); 
    } 
}

let countInTimers = []; let audioStartTimer = null;
function clearAllTimers() { countInTimers.forEach(t => clearTimeout(t)); countInTimers = []; if (audioStartTimer) { clearTimeout(audioStartTimer); audioStartTimer = null; } }

function scheduleCountInAndPlay() {
    clearAllTimers(); 
    const beatMs = (60 / bpm) * 1000;
    [0, 1, 2, 3].forEach(b => { 
        countInTimers.push(setTimeout(() => { 
            if (!isPlaying || isPaused) return; 
            playStickClick(b === 3 ? 1800 : 1200); 
            showJudgement(`${b + 1}`); 
        }, (b * beatMs) / playbackSpeed)); 
    });

    audioStartTimer = setTimeout(() => { 
        if (!isPlaying || isPaused) return; 
        masterAudio.playbackRate = playbackSpeed; 
        masterAudio.currentTime = 0; 
        masterAudio.play().catch(() => {}); 
    }, (beatMs * 4) / playbackSpeed);
}

// === 主渲染遊戲循環（補回 5.3 激光判定線與動態 Shadow） ===
function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, W, H);
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;

    // 繁星背景
    stars.forEach(s => { 
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.beginPath(); 
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill(); 
        s.y += s.speed * 1.5; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } 
    });

    // 史詩行星事件
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
    // 消失點聚攏頂部
    const topX = (currentPerspectiveMode === 1) ? botX : [W * 0.44, W * 0.48, W * 0.52, W * 0.56];

    // 4 條主軌道
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = laneColors[i].glow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(topX[i], startY); ctx.lineTo(botX[i], H); ctx.stroke();
    }

    // 🌟 補回 5.3 靈魂：橫跨全螢幕的青色激光判定線 + 強烈 Shadow 光暈！
    ctx.save();
    ctx.strokeStyle = "rgba(0, 255, 204, 0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00ffcc";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(W, hitY);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = laneColors[i].main; 
        ctx.beginPath(); ctx.arc(botX[i], hitY, 22, 0, Math.PI * 2); ctx.fill();
    }

    // 音符渲染
    const beatMs = (60 / bpm) * 1000;
    const tDur = (beatMs * 4) / scrollSpeedMultiplier; 

    notes.forEach(n => {
        if (n.hit) return;
        const p = 1.0 - ((n.targetTime - currentTimeMs) / tDur);

        // 🌟 補回 5.3 靈魂：Note 隨距離充能爆光的動態 Shadow！
        if (p > 0 && p < 1.15) {
            const cx = topX[n.lane] + (botX[n.lane] - topX[n.lane]) * p;
            const cy = startY + (hitY - startY) * p;

            ctx.save();
            ctx.fillStyle = laneColors[n.lane].main;
            ctx.shadowColor = laneColors[n.lane].main;
            ctx.shadowBlur = 22 * p; // 越接近判定線越光！

            ctx.beginPath();
            if (n.type === 'flick') {
                ctx.fillStyle = "#ff0077";
                ctx.shadowColor = "#ff0077";
                ctx.arc(cx, cy, 26, 0, Math.PI * 2);
                ctx.fill();
            } else if (currentPerspectiveMode === 1) { 
                ctx.ellipse(cx, cy, 26, 32, 0, 0, Math.PI * 2); 
                ctx.fill();
            } else { 
                const rx = (10 * (1.0 - p)) + (28 * p); 
                const ry = (32 * (1.0 - p)) + (14 * p); 
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); 
                ctx.fill();
            }
            ctx.restore();
        }

        if (p > 1.08 && !n.hit) { 
            n.hit = true; combo = 0; hp = Math.max(0, hp - 5); 
            showJudgement("MISS"); updateUI(); 
        }
    });

    // 打擊粒子更新
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.05; if (p.alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(gameLoop);
}
