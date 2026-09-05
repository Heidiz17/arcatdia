/* =============================================================
   🔒 Arcatdia Battle Engine v4.0 - Part 1 (1.0x 預設鎖死 & 精準圖表)
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
let score = 0;
let combo = 0;
let hp = 100;
let notes = [];
let particles = [];
let stars = [];
let startTime = 0;

// 🎯 預設鎖死 1.0x 原速，徹底消滅幽靈速度
let playbackSpeed = 1.0;

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

function togglePerspectiveMode() {
    currentPerspectiveMode = currentPerspectiveMode === 1 ? 2 : 1;
    const btn = document.getElementById('modeToggleBtn');
    if (btn) {
        btn.innerText = currentPerspectiveMode === 1 ? "🏊 2D 直軌" : "🚀 3D 尖角";
    }
}

function togglePlaybackSpeed() {
    // 循環速度：1.0x -> 0.8x -> 0.6x -> 0.5x
    const speeds = [1.0, 0.8, 0.6, 0.5];
    let idx = speeds.indexOf(playbackSpeed);
    if (idx === -1) idx = 0;
    playbackSpeed = speeds[(idx + 1) % speeds.length];
    
    Object.keys(audioElements).forEach(key => {
        audioElements[key].playbackRate = playbackSpeed;
    });

    const speedBtn = document.getElementById('speedToggleBtn');
    if (speedBtn) {
        speedBtn.innerText = `🎵 ${playbackSpeed.toFixed(1)}x`;
    }
    showJudgement(`速度: ${playbackSpeed.toFixed(1)}x`, "#00ccff");
}

function toggleJudgeLineLevel() {
    judgeLineLevel = (judgeLineLevel + 1) % judgeLineOffsets.length;
    showJudgement(`線位: LV ${judgeLineLevel + 1}`, "#ccff00");
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

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let dspCtx = null;

function initDSP() {
    try {
        if (!dspCtx) dspCtx = new AudioContextClass();
        if (dspCtx.state === 'suspended') dspCtx.resume();
    } catch (e) {}
}

// 🎯 打擊音效 (Hi-Hat)
function playHiHatHitSound() {
    if (!dspCtx) return;
    try {
        const bufferSize = dspCtx.sampleRate * 0.03;
        const buffer = dspCtx.createBuffer(1, bufferSize, dspCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = dspCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = dspCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7500;

        const gain = dspCtx.createGain();
        gain.gain.setValueAtTime(0.5, dspCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, dspCtx.currentTime + 0.03);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(dspCtx.destination);

        noise.start();
    } catch (e) {}
}

// 🎯 預備拍專用：木質鼓棍敲擊聲 (Stick Click)
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

function createHitParticles(x, y, color) {
    if (particles.length > 30) particles.splice(0, 10);
    for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 2,
            color: color, alpha: 1.0
        });
    }
}

const stemFiles = {
    drums: "最大の愛(original jp)_drums_mixed.mp3",
    guitars: "最大の愛(original jp)_guitars_mixed.mp3",
    piano: "最大の愛(original jp)_piano_mixed.mp3",
    bass: "最大の愛(original jp)_bass_mixed.mp3",
    vocals: "最大の愛(original jp)_vocals_mixed.mp3",
    other: "最大の愛(original jp)_other_mixed.mp3"
};

const audioElements = {};
Object.keys(stemFiles).forEach(key => {
    const audio = new Audio();
    audio.src = stemFiles[key];
    audio.preload = "auto";
    audioElements[key] = audio;
});

// 🎯 譜面生成：第一粒音目標時間精確咬死在第 4 拍完結點 (1371.4ms)
function generateChart() {
    notes = [];
    particles = [];
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4; // 1371.4ms (1 個小節)

    const firstHitTime = barMs; 

    for (let i = 0; i < 150; i++) {
        notes.push({
            type: 'tap',
            lane: 1, // L2 黃色軌
            targetTime: firstHitTime + (i * barMs),
            hit: false
        });
    }
}

// 🎯 綁定軌道觸控與點擊
for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        laneBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            laneBtn.classList.add('pressed');
            lanePressed[i] = true;
            playHiHatHitSound();
            handleTap(i);
        });
        laneBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            laneBtn.classList.remove('pressed');
            lanePressed[i] = false;
        });
        laneBtn.addEventListener('mousedown', () => {
            laneBtn.classList.add('pressed');
            lanePressed[i] = true;
            playHiHatHitSound();
            handleTap(i);
        });
        laneBtn.addEventListener('mouseup', () => {
            laneBtn.classList.remove('pressed');
            lanePressed[i] = false;
        });
    }
}

// 🎯 開波強制同步速度按鈕文字為 1.0x
const speedBtnInit = document.getElementById('speedToggleBtn');
if (speedBtnInit) {
    speedBtnInit.innerText = `🎵 ${playbackSpeed.toFixed(1)}x`;
}
/* =============================================================
   🔒 Arcatdia Battle Engine v4.0 - Part 2
   ============================================================= */

let countInTimers = [];
let audioStartTimer = null;

let firstNoteBornTime = null;
let firstNoteHitTime = null;
let recordedTravelTime = "--";

function handleTap(laneIndex) {
    if (!isPlaying) return;
    const currentTimeMs = (performance.now() - startTime) * playbackSpeed;
    const W = canvas.width;
    const laneW = W / 4;
    const currentHitY = canvas.height - judgeLineOffsets[judgeLineLevel];
    const targetX = laneW * laneIndex + (laneW / 2);
    const laneColor = laneColors[laneIndex].main;

    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit);

    if (targetNote) {
        const timeDiff = Math.abs(currentTimeMs - targetNote.targetTime);

        if (targetNote === notes[0] && firstNoteBornTime !== null && firstNoteHitTime === null) {
            firstNoteHitTime = currentTimeMs;
            recordedTravelTime = (firstNoteHitTime - firstNoteBornTime).toFixed(1);
        }

        if (timeDiff < 180) {
            targetNote.hit = true;
            score += 1000;
            combo++;
            hp = Math.min(100, hp + 2);
            showJudgement("PERFECT!", laneColor);
            createHitParticles(targetX, currentHitY, laneColor);
        } else if (timeDiff < 320) {
            targetNote.hit = true;
            score += 500;
            combo++;
            showJudgement("GREAT", "#ffaa00");
            createHitParticles(targetX, currentHitY, "#ffaa00");
        }
        updateUI();
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

function showJudgement(text, color) {
    const disp = document.getElementById('judgementDisplay');
    if (disp) {
        disp.innerText = text;
        disp.style.color = color;
        disp.style.opacity = '1';
        setTimeout(() => { disp.style.opacity = '0'; }, 350);
    }
}

function playAllAudio() {
    Object.keys(audioElements).forEach(key => {
        audioElements[key].playbackRate = playbackSpeed;
        audioElements[key].currentTime = 0;
        audioElements[key].play().catch(() => {});
    });
}

function pauseAllAudio() {
    Object.keys(audioElements).forEach(key => {
        audioElements[key].pause();
    });
}

function clearAllTimers() {
    countInTimers.forEach(t => clearTimeout(t));
    countInTimers = [];
    if (audioStartTimer) {
        clearTimeout(audioStartTimer);
        audioStartTimer = null;
    }
}

// 🎯 核心調度：Count-in 與提前 90ms 預熱 MP3 食晒空氣仔
function scheduleCountInAndPlay() {
    clearAllTimers();
    const beatMs = (60 / bpm) * 1000; // ~342.8ms
    const totalLeadMs = beatMs * 4;   // 1371.4ms (整整 1 個 Bar)

    // 敲 4 下預備拍 (1, 2, 3, 4)
    [0, 1, 2, 3].forEach(b => {
        const t = setTimeout(() => {
            if (!isPlaying) return;
            playStickClick(b === 3 ? 1800 : 1200);
            showJudgement(`${b + 1}`, "#00ffcc");
        }, (b * beatMs) / playbackSpeed);
        countInTimers.push(t);
    });

    // 🎯 提前 90ms 預熱啟動音訊，剛好抵消 Android 音訊硬體解碼延遲
    const airGapOffset = 90; 
    const playDelay = Math.max(0, totalLeadMs - airGapOffset);

    audioStartTimer = setTimeout(() => {
        if (!isPlaying) return;
        playAllAudio();
    }, playDelay / playbackSpeed);
}

function togglePlay() {
    initDSP();
    const playBtn = document.getElementById('mainPlayBtn');
    if (!isPlaying) {
        isPlaying = true;
        score = 0;
        combo = 0;
        hp = 100;
        firstNoteBornTime = null;
        firstNoteHitTime = null;
        recordedTravelTime = "--";
        updateUI();
        generateChart();
        startTime = performance.now();
        scheduleCountInAndPlay();
        if (playBtn) playBtn.innerText = "⏸ PAUSE";
        requestAnimationFrame(gameLoop);
    } else {
        isPlaying = false;
        clearAllTimers();
        pauseAllAudio();
        if (playBtn) playBtn.innerText = "▶ PLAY";
    }
}

function startCalibration() {
    const mask = document.getElementById('startMask');
    if (mask) mask.style.display = 'none';
    togglePlay();
}

function startBattle() {
    startCalibration();
}

function gameLoop() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        s.y += s.speed * (playbackSpeed * 1.5);
        if (s.y > canvas.height) {
            s.y = 0;
            s.x = Math.random() * canvas.width;
        }
    });

    const currentTimeMs = (performance.now() - startTime) * playbackSpeed;
    const beatMs = (60 / bpm) * 1000;
    const travelDuration = beatMs * 2; // 下落固定 2 拍 (~685.7ms)

    const W = canvas.width;
    const H = canvas.height;
    
    const hitZoneY = H - judgeLineOffsets[judgeLineLevel];
    const startY = 20;

    const laneW = W / 4;
    const botX = [laneW * 0.5, laneW * 1.5, laneW * 2.5, laneW * 3.5];
    const topX = (currentPerspectiveMode === 1) ? botX : [W * 0.44, W * 0.48, W * 0.52, W * 0.56];

    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = laneColors[i].glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topX[i], startY);
        ctx.lineTo(botX[i], H);
        ctx.stroke();

        ctx.fillStyle = laneColors[i].main;
        ctx.shadowColor = laneColors[i].main;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(botX[i], hitZoneY, 22, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(0, 255, 204, 0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00ffcc";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY);
    ctx.lineTo(W, hitZoneY);
    ctx.stroke();

    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 11px Courier New";
    ctx.fillText(`🎯 判定線 [檔位 ${judgeLineLevel + 1}/4]`, 10, hitZoneY - 8);

    notes.forEach(note => {
        const laneIndex = note.lane;
        const tx = topX[laneIndex];
        const bx = botX[laneIndex];
        const colorObj = laneColors[laneIndex];

        if (note.hit) return;
        const timeTillHit = note.targetTime - currentTimeMs;
        const rawProgress = 1.0 - (timeTillHit / travelDuration);

        // 🎯 捕捉第一粒音在頂部出世時間
        if (note === notes[0] && rawProgress >= 0 && firstNoteBornTime === null) {
            firstNoteBornTime = currentTimeMs;
        }

        if (rawProgress > 0 && rawProgress < 1.15) {
            const currentX = tx + (bx - tx) * rawProgress;
            const currentY = startY + (hitZoneY - startY) * rawProgress;

            ctx.fillStyle = colorObj.main;
            ctx.shadowColor = colorObj.main;
            ctx.shadowBlur = 20 * rawProgress;
            ctx.beginPath();

            if (currentPerspectiveMode === 1) {
                ctx.ellipse(currentX, currentY, 26, 32, 0, 0, Math.PI * 2);
            } else {
                const rx = (10 * (1.0 - rawProgress)) + (52 * rawProgress);
                const ry = (32 * (1.0 - rawProgress)) + (14 * rawProgress);
                ctx.ellipse(currentX, currentY, rx, ry, 0, 0, Math.PI * 2);
            }
            ctx.fill();
        }

        // 過線判定 MISS
        if (rawProgress > 1.08 && !note.hit) {
            if (note === notes[0] && firstNoteBornTime !== null && firstNoteHitTime === null) {
                firstNoteHitTime = currentTimeMs;
                recordedTravelTime = (firstNoteHitTime - firstNoteBornTime).toFixed(1);
            }
            note.hit = true;
            combo = 0;
            hp = Math.max(0, hp - 5);
            showJudgement("MISS", "#ff0055");
            updateUI();
        }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.05;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    // 🎯 實時遙測 HUD：定格數據白紙黑字
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(8, 55, 230, 95);
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 55, 230, 95);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Courier New";
    ctx.fillText(`⏱️ 音樂時間: ${currentTimeMs.toFixed(0)} ms`, 15, 75);
    ctx.fillText(`🚀 出生時間: ${firstNoteBornTime ? firstNoteBornTime.toFixed(0) + ' ms' : '未現身'}`, 15, 95);
    ctx.fillText(`🎯 撞線時間: ${firstNoteHitTime ? firstNoteHitTime.toFixed(0) + ' ms' : '飛行中...'}`, 15, 115);
    
    ctx.fillStyle = "#ccff00";
    ctx.font = "bold 12px Courier New";
    ctx.fillText(`📊 實測飛行: ${recordedTravelTime} ms`, 15, 138);
    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// 🎯 初始化畫布靜態軌道
(function initialDraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;
    const hitZoneY = H - judgeLineOffsets[judgeLineLevel];
    const laneW = W / 4;
    for (let i = 0; i < 4; i++) {
        const x = laneW * i + laneW * 0.5;
        ctx.strokeStyle = laneColors[i].glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, H);
        ctx.stroke();

        ctx.fillStyle = laneColors[i].main;
        ctx.beginPath();
        ctx.arc(x, hitZoneY, 22, 0, Math.PI * 2);
        ctx.fill();
    }
})();
