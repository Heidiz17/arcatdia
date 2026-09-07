const canvas = document.getElementById('battleCanvas');
const ctx = canvas.getContext('2d');

let W = window.innerWidth;
let H = window.innerHeight;

function handleResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    initStars();
}
window.addEventListener('resize', handleResize);
resizeCanvas();

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

let currentPerspectiveMode = 1;

let customSlideImages = [];

function handleCustomWallpaperUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    customSlideImages = [];
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = function(e) {
            customSlideImages.push(e.target.result);
            if (i === 0) {
                const bg = document.getElementById('bgWallpaper');
                if (bg) { bg.className = 'wallpaper-bg'; bg.style.backgroundImage = `url(${e.target.result})`; }
            }
        };
        reader.readAsDataURL(files[i]);
    }
}

function updateGlassOpacity(val) {
    const opacity = val / 100;
    document.documentElement.style.setProperty('--glass-opacity', opacity);
    document.documentElement.style.setProperty('--battle-frost', (opacity * 0.75).toFixed(2));
    const disp = document.getElementById('glassOpacityVal');
    if (disp) disp.innerText = `${val}%`;
}

function toggleWallpaperDrawer() {
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.toggle('open');
}

const songDatabase = [{ id: "01", title: "最大の愛", folder: "songs/01_最大の愛", fileName: "master.mp3", bpm: 175 }];
let currentSong = songDatabase[0];
const masterAudio = new Audio();
masterAudio.src = encodeURI(`${currentSong.folder}/${currentSong.fileName}`);
masterAudio.preload = "auto";
masterAudio.load();
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

function goToReadyRoom() {
    const t = document.getElementById('titleScreen');
    if (t) t.classList.remove('active');
    const r = document.getElementById('readyRoom');
    if (r) r.classList.add('active');
    initDSP();
}

function selectDifficulty(mode) {
    currentMode = mode;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'easy') document.getElementById('btnDiffEasy').classList.add('active');
    if (mode === 'normal') document.getElementById('btnDiffNormal').classList.add('active');
    if (mode === 'test') document.getElementById('btnDiffTest').classList.add('active');
}

function setSpeed(speedVal) {
    scrollSpeedMultiplier = speedVal;
}

function startVoyage() {
    const r = document.getElementById('readyRoom');
    if (r) r.classList.remove('active');
    const hud = document.getElementById('battleHud');
    if (hud) hud.style.display = 'flex';
    const touch = document.getElementById('touchController');
    if (touch) touch.style.display = 'flex';

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

function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 2 + 1, speed: Math.random() * 1.5 + 0.5, alpha: Math.random() });
    }
}
initStars();

function createHitParticles(x, y, color) {
    if (particles.length > 30) particles.splice(0, 10);
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 4 + 2, color: color, alpha: 1.0 });
    }
}

function generateChart() {
    notes = [];
    particles = [];
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4;
    const totalBars = 145;
    let lastLane = 1;
    for (let bar = 0; bar < totalBars; bar++) {
        lastLane = (lastLane + 1) % 4;
        notes.push({ type: 'tap', lane: lastLane, targetTime: barMs + (bar * barMs), hit: false });
    }
    notes.sort((a, b) => a.targetTime - b.targetTime);
}

for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        const press = (e) => { e.preventDefault(); laneBtn.classList.add('pressed'); lanePressed[i] = true; handleTap(i); };
        const release = (e) => { e.preventDefault(); laneBtn.classList.remove('pressed'); lanePressed[i] = false; };
        laneBtn.addEventListener('touchstart', press);
        laneBtn.addEventListener('touchend', release);
        laneBtn.addEventListener('mousedown', press);
        laneBtn.addEventListener('mouseup', release);
    }
}
function pauseGame() {
    if (!isPlaying || isPaused) return;
    isPaused = true;
    pauseStartTime = performance.now();
    masterAudio.pause();
    clearAllTimers();
    const p = document.getElementById('pauseMenu');
    if (p) p.classList.add('active');
}

function resumeGame() {
    if (!isPaused) return;
    const p = document.getElementById('pauseMenu');
    if (p) p.classList.remove('active');
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.remove('open');
    totalPausedDuration += (performance.now() - pauseStartTime);
    isPaused = false;
    masterAudio.play().catch(() => {});
    requestAnimationFrame(gameLoop);
}

function restartFromPause() {
    const p = document.getElementById('pauseMenu');
    if (p) p.classList.remove('active');
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.remove('open');
    isPaused = false;
    startVoyage();
}

function returnToReadyRoom() {
    const p = document.getElementById('pauseMenu');
    if (p) p.classList.remove('active');
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.remove('open');
    const hud = document.getElementById('battleHud');
    if (hud) hud.style.display = 'none';
    const touch = document.getElementById('touchController');
    if (touch) touch.style.display = 'none';
    isPaused = false; isPlaying = false;
    masterAudio.pause(); masterAudio.currentTime = 0;
    clearAllTimers();
    ctx.clearRect(0, 0, W, H);
    const r = document.getElementById('readyRoom');
    if (r) r.classList.add('active');
}

function handleTap(laneIndex) {
    if (!isPlaying || isPaused) return;
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const laneW = W / 4;
    const currentHitY = H - 185;
    const targetX = laneW * laneIndex + (laneW / 2);
    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit);

    if (targetNote) {
        const timeDiff = Math.abs(currentTimeMs - targetNote.targetTime);
        if (timeDiff < 200) {
            targetNote.hit = true;
            score += 1000; combo++; hp = Math.min(100, hp + 2);
            showJudgement("PERFECT!");
            createHitParticles(targetX, currentHitY, "#ffffff");
            updateUI();
        }
    }
}

function updateUI() {
    const scoreElem = document.getElementById('scoreVal');
    if (scoreElem) scoreElem.innerText = String(score).padStart(6, '0');
    const hpFill = document.getElementById('hpFill');
    if (hpFill) hpFill.style.width = `${hp}%`;
    const comboDisp = document.getElementById('comboDisplay');
    if (comboDisp && combo > 1) { comboDisp.innerText = `${combo} COMBO`; comboDisp.style.opacity = '1'; }
}

function showJudgement(text) {
    const disp = document.getElementById('judgementDisplay');
    if (disp) {
        disp.innerText = text;
        disp.style.opacity = '1';
        setTimeout(() => { disp.style.opacity = '0'; }, 300);
    }
}

let countInTimers = [];
let audioStartTimer = null;

function clearAllTimers() {
    countInTimers.forEach(t => clearTimeout(t));
    countInTimers = [];
    if (audioStartTimer) { clearTimeout(audioStartTimer); audioStartTimer = null; }
}

function scheduleCountInAndPlay() {
    clearAllTimers();
    const beatMs = (60 / bpm) * 1000;
    [0, 1, 2, 3].forEach(b => {
        const t = setTimeout(() => {
            if (!isPlaying || isPaused) return;
            playStickClick(b === 3 ? 1800 : 1200);
            showJudgement(`${b + 1}`);
        }, (b * beatMs) / playbackSpeed);
        countInTimers.push(t);
    });

    audioStartTimer = setTimeout(() => {
        if (!isPlaying || isPaused) return;
        masterAudio.playbackRate = playbackSpeed;
        masterAudio.currentTime = 0;
        masterAudio.play().catch(() => {});
    }, (beatMs * 3.5) / playbackSpeed);
}

function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, W, H);

    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;

    // 📸 幻燈片輪播背景（每 5.5 秒切換一張，播完變黑夜星空）
    if (customSlideImages.length > 0) {
        const slideIndex = Math.floor(currentSec / 5.5);
        if (slideIndex < customSlideImages.length) {
            ctx.save();
            const img = new Image();
            img.src = customSlideImages[slideIndex];
            ctx.globalAlpha = 0.35;
            ctx.drawImage(img, 0, 0, W, H);
            ctx.restore();
        }
    }

    // 星星背景
    stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        s.y += s.speed * 1.5;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });

    // 太陽系星球航行
    celestialEvents.forEach(evt => {
        if (currentSec >= evt.timeSec && currentSec <= evt.timeSec + evt.duration) {
            const progress = (currentSec - evt.timeSec) / evt.duration;
            const alpha = Math.sin(progress * Math.PI) * 0.40;
            evt.planets.forEach(p => {
                ctx.save();
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 35;
                const px = W * p.xRatio - (progress * 40);
                const py = H * p.yRatio + (progress * 30);
                ctx.beginPath();
                ctx.arc(px, py, p.radius, 0, Math.PI * 2);
                ctx.fill();

                if (p.hasRing) {
                    ctx.save();
                    ctx.translate(px, py);
                    ctx.rotate(-0.35);
                    ctx.strokeStyle = "rgba(240, 220, 160, 0.55)";
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.45, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.8})`;
                ctx.font = "bold 13px 'Zen Maru Gothic', sans-serif";
                ctx.fillText(p.name, px - 40, py + p.radius + 20);
                ctx.restore();
            });
        }
    });

    const hitZoneY = H - 185;
    const laneW = W / 4;
    const botX = [laneW * 0.5, laneW * 1.5, laneW * 2.5, laneW * 3.5];

    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = laneColors[i].glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(botX[i], 20);
        ctx.lineTo(botX[i], H);
        ctx.stroke();

        ctx.fillStyle = laneColors[i].main;
        ctx.beginPath();
        ctx.arc(botX[i], hitZoneY, 22, 0, Math.PI * 2);
        ctx.fill();
    }

    requestAnimationFrame(gameLoop);
}
