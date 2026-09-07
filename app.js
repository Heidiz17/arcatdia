/* =============================================================
   🔒 Arcatdia Battle Engine v7.8 - Part 1 (Custom Wallpaper & DSP)
   ============================================================= */

const canvas = document.getElementById('battleCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
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
    { main: "#ff2a6d", border: "#ffffff", glow: "rgba(255, 42, 109, 0.8)" },
    { main: "#05d9e8", border: "#ffffff", glow: "rgba(5, 217, 232, 0.8)" },
    { main: "#ffb703", border: "#ffffff", glow: "rgba(255, 183, 3, 0.8)" },
    { main: "#b5179e", border: "#ffffff", glow: "rgba(181, 23, 158, 0.8)" }
];

// 🎯 1. 歌曲配置與音頻初始化
const songDatabase = [
    {
        id: "01",
        title: "最大の愛",
        folder: "songs/01_最大の愛",
        fileName: "master.mp3",
        bpm: 175
    }
];

let currentSong = songDatabase[0];
const masterAudio = new Audio();
masterAudio.src = encodeURI(`${currentSong.folder}/${currentSong.fileName}`);
masterAudio.preload = "auto";
masterAudio.load();
bpm = currentSong.bpm;

masterAudio.onerror = function() {
    alert("❌ 找不到音訊檔案！請檢查路徑:\n" + masterAudio.src);
};

// 🎯 2. 雙軌音量推桿 (Mixer)
let bgmVolume = 0.70;
let seVolume = 1.30;

function updateBgmVolume(val) {
    bgmVolume = val / 100;
    masterAudio.volume = bgmVolume;
    document.getElementById('bgmVolVal').innerText = `${val}%`;
}

function updateSeVolume(val) {
    seVolume = val / 100;
    if (masterDspGain) masterDspGain.gain.value = seVolume;
    document.getElementById('seVolVal').innerText = `${val}%`;
}

// 🎯 3. 磨砂玻璃、自選相簿與三朝壁紙抽屜
function updateGlassOpacity(val) {
    const opacity = val / 100;
    document.documentElement.style.setProperty('--glass-opacity', opacity);
    document.documentElement.style.setProperty('--battle-frost', (opacity * 0.75).toFixed(2));
    document.getElementById('glassOpacityVal').innerText = `${val}%`;
}

function toggleWallpaperDrawer() {
    const drawer = document.getElementById('wallpaperDrawer');
    drawer.classList.toggle('open');
}

// 📸 玩家自選手機相簿處理（自動持久保存）
function handleCustomWallpaperUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const customUrl = e.target.result;
        const bg = document.getElementById('bgWallpaper');
        bg.className = 'wallpaper-bg';
        bg.style.backgroundImage = `url(${customUrl})`;

        document.querySelectorAll('.wp-card').forEach(c => c.classList.remove('active'));

        try {
            localStorage.setItem('arcatdia_custom_bg', customUrl);
        } catch(err) {}
    };
    reader.readAsDataURL(file);
}

// 讀取本地已存相片
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('arcatdia_custom_bg');
    if (saved) {
        const bg = document.getElementById('bgWallpaper');
        bg.className = 'wallpaper-bg';
        bg.style.backgroundImage = `url(${saved})`;
    }
});

function changeWallpaper(theme) {
    const bg = document.getElementById('bgWallpaper');
    bg.style.backgroundImage = '';
    bg.className = `wallpaper-bg theme-${theme}`;
    localStorage.removeItem('arcatdia_custom_bg');

    document.querySelectorAll('.wp-card').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(`wp-${theme}`);
    if (target) target.classList.add('active');
}

// 🎯 4. 初音風格晶瑩金屬高頻 DSP
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let dspCtx = null;
let masterDspGain = null;

function createReverbImpulse(context, duration = 0.35, decay = 3.8) {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const impulse = context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.exp(-t * decay);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
}

function initDSP() {
    try {
        if (!dspCtx) {
            dspCtx = new AudioContextClass();
            masterDspGain = dspCtx.createGain();
            masterDspGain.gain.value = seVolume;

            const convolver = dspCtx.createConvolver();
            convolver.buffer = createReverbImpulse(dspCtx, 0.35, 4.0);

            const dryGain = dspCtx.createGain();
            const wetGain = dspCtx.createGain();
            dryGain.gain.value = 0.95;
            wetGain.gain.value = 0.40;

            masterDspGain.connect(dryGain);
            masterDspGain.connect(convolver);
            convolver.connect(wetGain);

            dryGain.connect(dspCtx.destination);
            wetGain.connect(dspCtx.destination);
        }
        if (dspCtx.state === 'suspended') dspCtx.resume();
    } catch (e) {}
}

function playFastHitSound() {
    if (!dspCtx || !masterDspGain) return;
    try {
        const now = dspCtx.currentTime;

        const snapOsc = dspCtx.createOscillator();
        const snapGain = dspCtx.createGain();
        snapOsc.type = 'sine';
        snapOsc.frequency.setValueAtTime(2800, now);
        snapOsc.frequency.exponentialRampToValueAtTime(950, now + 0.04);

        snapGain.gain.setValueAtTime(0.85, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        snapOsc.connect(snapGain);
        snapGain.connect(masterDspGain);
        snapOsc.start(now);
        snapOsc.stop(now + 0.04);

        const bellOsc = dspCtx.createOscillator();
        const bellGain = dspCtx.createGain();
        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(3900, now);
        bellOsc.frequency.exponentialRampToValueAtTime(1500, now + 0.03);

        bellGain.gain.setValueAtTime(0.6, now);
        bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        bellOsc.connect(bellGain);
        bellGain.connect(masterDspGain);
        bellOsc.start(now);
        bellOsc.stop(now + 0.03);
    } catch (e) {}
}

function playStickClick(freq = 1400) {
    if (!dspCtx || !masterDspGain) return;
    try {
        const now = dspCtx.currentTime;
        const osc = dspCtx.createOscillator();
        const gain = dspCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(masterDspGain);
        osc.start(now);
        osc.stop(now + 0.04);
    } catch (e) {}
}

// 🎯 5. 導航與模式切換
function goToReadyRoom() {
    document.getElementById('titleScreen').classList.remove('active');
    document.getElementById('readyRoom').classList.add('active');
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
    document.querySelectorAll('.speed-btn').forEach(b => {
        b.classList.remove('active');
        if (b.innerText === `${speedVal.toFixed(1)}x`) b.classList.add('active');
    });
}

function startVoyage() {
    document.getElementById('readyRoom').classList.remove('active');
    const info = document.getElementById('hudTrackInfo');
    if (info) info.innerText = `${currentSong.title} (${currentMode.toUpperCase()})`;
    
    score = 0; combo = 0; hp = 100;
    totalPausedDuration = 0;
    updateUI();
    initCelestialJourney();
    generateChart();
    
    isPlaying = true;
    isPaused = false;
    startTime = performance.now();
    scheduleCountInAndPlay();
    requestAnimationFrame(gameLoop);
}

// 🎯 6. 觸控綁定
for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        const press = (e) => {
            e.preventDefault();
            laneBtn.classList.add('pressed');
            lanePressed[i] = true;
            playFastHitSound();
            handleTap(i);
        };
        const release = (e) => {
            e.preventDefault();
            laneBtn.classList.remove('pressed');
            lanePressed[i] = false;
            handleRelease(i);
        };
        laneBtn.addEventListener('touchstart', press);
        laneBtn.addEventListener('touchend', release);
        laneBtn.addEventListener('touchcancel', release);
        laneBtn.addEventListener('mousedown', press);
        laneBtn.addEventListener('mouseup', release);
        laneBtn.addEventListener('mouseleave', release);
    }
}
/* =============================================================
   🔒 Arcatdia Battle Engine v7.8 - Part 2 (Pause & Curved Engine)
   ============================================================= */

// 🎯 7. 暫停與退回整備室
function pauseGame() {
    if (!isPlaying || isPaused) return;
    isPaused = true;
    pauseStartTime = performance.now();
    masterAudio.pause();
    clearAllTimers();
    document.getElementById('pauseMenu').classList.add('active');
}

function resumeGame() {
    if (!isPaused) return;
    document.getElementById('pauseMenu').classList.remove('active');
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.remove('open');

    const pauseElapsed = performance.now() - pauseStartTime;
    totalPausedDuration += pauseElapsed;
    isPaused = false;
    masterAudio.play().catch(() => {});
    requestAnimationFrame(gameLoop);
}

function restartFromPause() {
    document.getElementById('pauseMenu').classList.remove('active');
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.remove('open');
    isPaused = false;
    startVoyage();
}

function returnToReadyRoom() {
    document.getElementById('pauseMenu').classList.remove('active');
    const drawer = document.getElementById('wallpaperDrawer');
    if (drawer) drawer.classList.remove('open');

    isPaused = false;
    isPlaying = false;
    masterAudio.pause();
    masterAudio.currentTime = 0;
    clearAllTimers();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('readyRoom').classList.add('active');
}

// 🎯 8. 判定系統
function handleTap(laneIndex) {
    if (!isPlaying || isPaused) return;
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const W = canvas.width;
    const laneW = W / 4;
    const currentHitY = canvas.height - judgeLineOffsets[judgeLineLevel];
    const targetX = laneW * laneIndex + (laneW / 2);
    const laneColor = laneColors[laneIndex].main;

    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit);

    if (targetNote) {
        const timeDiff = Math.abs(currentTimeMs - targetNote.targetTime);

        if (targetNote.type === 'hold') {
            if (timeDiff < 260) {
                targetNote.holding = true;
                targetNote.lastTick = currentTimeMs;
                score += 500; combo++;
                showJudgement("HOLD!");
                createHitParticles(targetX, currentHitY, laneColor);
                updateUI();
            }
        } else {
            if (timeDiff < 180) {
                targetNote.hit = true;
                score += 1000; combo++;
                hp = Math.min(100, hp + 2);
                showJudgement("PERFECT!");
                createHitParticles(targetX, currentHitY, "#ffffff");
            } else if (timeDiff < 320) {
                targetNote.hit = true;
                score += 500; combo++;
                showJudgement("GREAT");
                createHitParticles(targetX, currentHitY, "#ffaa00");
            }
            updateUI();
        }
    }
}

function handleRelease(laneIndex) {
    if (!isPlaying || isPaused) return;
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const holdingNote = notes.find(n => n.lane === laneIndex && n.type === 'hold' && n.holding && !n.hit);
    if (holdingNote) {
        const endTime = holdingNote.targetTime + holdingNote.duration;
        if (currentTimeMs < endTime - 80) {
            holdingNote.holding = false;
            holdingNote.hit = true;
            combo = 0; hp = Math.max(0, hp - 4);
            showJudgement("BREAK!");
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
    if (comboDisp && combo > 1) {
        comboDisp.innerText = `${combo} COMBO`;
        comboDisp.style.opacity = '1';
    }
}

function showJudgement(text) {
    const disp = document.getElementById('judgementDisplay');
    if (disp) {
        disp.innerText = text;
        disp.style.color = text === "PERFECT!" ? "#ffffff" : (text === "BREAK!" ? "#ff0055" : "#ffd700");
        disp.style.opacity = '1';
        disp.style.transform = 'translate(-50%, -50%) scale(1.15)';
        setTimeout(() => { 
            disp.style.opacity = '0'; 
            disp.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }, 300);
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
    const totalLeadMs = beatMs * 4;

    [0, 1, 2, 3].forEach(b => {
        const t = setTimeout(() => {
            if (!isPlaying || isPaused) return;
            playStickClick(b === 3 ? 1800 : 1300);
            showJudgement(`${b + 1}`);
        }, (b * beatMs) / playbackSpeed);
        countInTimers.push(t);
    });

    const airGapOffset = 550; 
    const playDelay = Math.max(0, totalLeadMs - airGapOffset);

    audioStartTimer = setTimeout(() => {
        if (!isPlaying || isPaused) return;
        masterAudio.playbackRate = playbackSpeed;
        masterAudio.currentTime = 0;
        masterAudio.play().catch(() => {});
    }, playDelay / playbackSpeed);
}

function generateChart() {
    notes = [];
    particles = [];
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4;
    const firstHitTime = barMs; 
    const totalBars = 145; 
    const holdDuration = beatMs * 0.5;
    let lastLane = 1;

    for (let bar = 0; bar < totalBars; bar++) {
        const barStart = firstHitTime + (bar * barMs);
        const roll = Math.random();
        lastLane = (lastLane + 1) % 4;
        if (roll < 0.6) {
            notes.push({ type: 'tap', lane: lastLane, targetTime: barStart, hit: false });
        } else {
            notes.push({ type: 'hold', lane: lastLane, targetTime: barStart, duration: holdDuration, holding: false, hit: false, lastTick: 0 });
        }
    }
    notes.sort((a, b) => a.targetTime - b.targetTime);
}

function initStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 1.5 + 0.5,
            alpha: Math.random()
        });
    }
}
initStars();

function initCelestialJourney() {
    celestialEvents = [
        { timeSec: 2, duration: 8, planets: [{ name: "🌍 地球起航", color: "rgba(0, 160, 255, 0.28)", radius: 65, xRatio: 0.72, yRatio: 0.20 }] },
        { timeSec: 25, duration: 8, planets: [{ name: "🌟 金星晨曦", color: "rgba(255, 205, 80, 0.28)", radius: 60, xRatio: 0.70, yRatio: 0.22 }] },
        { timeSec: 52, duration: 11, planets: [
            { name: "🪐 木星", color: "rgba(235, 140, 60, 0.28)", radius: 75, xRatio: 0.60, yRatio: 0.18 }
        ]}
    ];
}

function createHitParticles(x, y, color) {
    if (particles.length > 25) particles.splice(0, 8);
    for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 2, color: color, alpha: 1.0
        });
    }
}

// 🎯 9. 核心主渲染循環（真・3D 碗型拋物線弧面）
function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;
    const W = canvas.width;
    const H = canvas.height;
    const hitZoneY = H - judgeLineOffsets[judgeLineLevel];
    const startY = 40;

    stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
        s.y += s.speed * (playbackSpeed * 1.5);
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });

    const topTrackWidth = W * 0.40;
    const botTrackWidth = W * 0.94;
    const topStartX = (W - topTrackWidth) / 2;
    const botStartX = (W - botTrackWidth) / 2;

    const laneTopLeft = [];
    const laneBotLeft = [];
    for (let i = 0; i <= 4; i++) {
        laneTopLeft.push(topStartX + (topTrackWidth / 4) * i);
        laneBotLeft.push(botStartX + (botTrackWidth / 4) * i);
    }

    // 繪製碗型曲面軌道
    for (let i = 0; i <= 4; i++) {
        ctx.strokeStyle = (i === 0 || i === 4) ? "rgba(0, 255, 204, 0.45)" : "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = (i === 0 || i === 4) ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(laneTopLeft[i], startY);
        const ctrlX = (laneTopLeft[i] + laneBotLeft[i]) / 2 + (i - 2) * 8;
        const ctrlY = (startY + H) * 0.55;
        ctx.quadraticCurveTo(ctrlX, ctrlY, laneBotLeft[i], H);
        ctx.stroke();
    }

    // 弧形碗底判定線
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#00ffcc";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(botStartX - 10, hitZoneY - 4);
    ctx.quadraticCurveTo(W / 2, hitZoneY + 12, botStartX + botTrackWidth + 10, hitZoneY - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const beatMs = (60 / bpm) * 1000;
    const travelDuration = (beatMs * 2) / scrollSpeedMultiplier;

    notes.forEach(note => {
        if (note.hit) return;
        const i = note.lane;
        const timeTillHit = note.targetTime - currentTimeMs;
        const rawProgress = 1.0 - (timeTillHit / travelDuration);

        if (rawProgress > 0 && rawProgress < 1.12) {
            const curvedProgress = Math.pow(Math.max(0, rawProgress), 1.55);
            const curY = startY + (hitZoneY - startY) * curvedProgress;
            const curLeft = laneTopLeft[i] + (laneBotLeft[i] - laneTopLeft[i]) * curvedProgress;
            const curRight = laneTopLeft[i+1] + (laneBotLeft[i+1] - laneTopLeft[i+1]) * curvedProgress;

            const barWidth = curRight - curLeft - 4;
            const barHeight = 12 + curvedProgress * 4;
            const barX = curLeft + 2;
            const barY = curY - (barHeight / 2);

            ctx.fillStyle = laneColors[i].main;
            ctx.fillRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(barX + 2, barY + 2, barWidth - 4, 3);
        }

        if (rawProgress > 1.08 && !note.hit) {
            note.hit = true;
            combo = 0; hp = Math.max(0, hp - 5);
            showJudgement("MISS");
            updateUI();
        }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.06;
        if (p.alpha <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}
