/* =============================================================
   🔒 Arcatdia Battle Engine - v3 (Fit原相 + 漸變血條 + Slider設定)
   ============================================================= */

const canvas = document.getElementById('battleCanvas');
const ctx = canvas.getContext('2d');

let W = window.innerWidth;
let H = window.innerHeight;

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

// 🌟 戰鬥背景透明度變數 (由 Slider 控制)
let battleBgOpacity = 0.45;

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
                // 直接轉 background-image
                if (el) el.style.backgroundImage = `url('${e.target.result}')`;
            } else if (target === 'ready') {
                const el = document.getElementById('readyBg');
                if (el) el.style.backgroundImage = `url('${e.target.result}')`;
            }
        };
        reader.readAsDataURL(files[0]);
    }
}

// 🌟 透明度與儲存設定
function updateSlideOpacity(val) {
    battleBgOpacity = val / 100;
}

function saveSettings() {
    alert("設定已儲存！");
    toggleWallpaperDrawer();
}

function toggleWallpaperDrawer() {
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.toggle('open');
}

const songDatabase = [{ id: "01", title: "最大の愛", folder: "songs/01_最大の愛", fileName: "master.mp3", bpm: 175 }];
let currentSong = songDatabase[0];
const masterAudio = new Audio();
try {
    masterAudio.src = encodeURI(`${currentSong.folder}/${currentSong.fileName}`);
    masterAudio.preload = "auto";
} catch (e) {}
bpm = currentSong.bpm;

function initCelestialJourney() {
    celestialEvents = [
        { timeSec: 2, duration: 8, planets: [{ name: "🌍 地球起航", color: "rgba(0, 160, 255, 0.32)", radius: 65, xRatio: 0.72, yRatio: 0.20 }] },
        { timeSec: 25, duration: 8, planets: [{ name: "🌟 啟明星・金星", color: "rgba(255, 205, 80, 0.32)", radius: 60, xRatio: 0.70, yRatio: 0.22 }] }
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

// 🌟 畫面切換 (3 -> 2 -> 1)
function goToReadyRoom() {
    const ts = document.getElementById('titleScreen'); if (ts) ts.classList.remove('active');
    const tb = document.getElementById('titleBg'); if (tb) tb.classList.remove('active');
    const rr = document.getElementById('readyRoom'); if (rr) rr.classList.add('active');
    const rb = document.getElementById('readyBg'); if (rb) rb.classList.add('active');
    initDSP();
}

function returnToTitle() {
    const rr = document.getElementById('readyRoom'); if (rr) rr.classList.remove('active');
    const rb = document.getElementById('readyBg'); if (rb) rb.classList.remove('active');
    const ts = document.getElementById('titleScreen'); if (ts) ts.classList.add('active');
    const tb = document.getElementById('titleBg'); if (tb) tb.classList.add('active');
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

function generateChart() {
    notes = []; particles = [];
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4;
    const firstBeatOffset = 4 * beatMs;
    let lastLane = 1;

    for (let bar = 0; bar < 145; bar++) {
        lastLane = (lastLane + 1) % 4;
        notes.push({ type: 'tap', lane: lastLane, targetTime: firstBeatOffset + (bar * barMs), hit: false });
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

// 🌟 1943 漸變血條 + 大字體分數
function updateUI() {
    const scoreVal = document.getElementById('scoreVal');
    if (scoreVal) {
        scoreVal.innerText = String(score).padStart(6, '0');
        scoreVal.style.fontSize = "32px"; // 大隻字
        scoreVal.style.fontWeight = "900";
        scoreVal.style.letterSpacing = "3px";
        scoreVal.style.textShadow = "0 0 15px #ffcc00";
    }

    const hpFill = document.getElementById('hpFill');
    if (hpFill) {
        hpFill.style.width = `${hp}%`;
        // 紅/橙/黃/綠 漸變
        hpFill.style.background = "linear-gradient(90deg, #ff0000 0%, #ff8800 35%, #ffff00 70%, #00ff00 100%)";
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

function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, W, H);
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;

    // 📸 戰鬥幻燈片 (加入變數控制透明度)
    if (preloadedSlideImages.length > 0) {
        const slideIndex = Math.floor(currentSec / 5.5);
        if (slideIndex < preloadedSlideImages.length) {
            const img = preloadedSlideImages[slideIndex];
            if (img.complete && img.naturalWidth !== 0) {
                ctx.save(); 
                ctx.globalAlpha = battleBgOpacity; // <--- 讀取 Slider 設定值
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
                ctx.restore();
            });
        }
    });

    const hitY = H - 185; const botX = [W*0.125, W*0.375, W*0.625, W*0.875];
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = laneColors[i].glow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(botX[i], 20); ctx.lineTo(botX[i], H); ctx.stroke();
        ctx.fillStyle = laneColors[i].main; ctx.beginPath(); ctx.arc(botX[i], hitY, 22, 0, Math.PI * 2); ctx.fill();
    }

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
