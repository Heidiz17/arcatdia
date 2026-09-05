/* =============================================================
   🔒 Arcatdia Battle Engine v3.2 - Whole Note (全音符 4拍一粒) (Part 1)
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

const audioOffsetMs = 250; 
let noteSpeed = 6.0; 
let playbackSpeed = 0.8; // 預設 0.8x 慢速

// 🎯 4 檔判定線高低微調
const judgeLineOffsets = [85, 105, 125, 145];
let judgeLineLevel = 1; 

const lanePressed = [false, false, false, false];

const laneColors = [
    { main: "#ff0055", glow: "rgba(255, 0, 85, 0.8)" },
    { main: "#ccff00", glow: "rgba(204, 255, 0, 0.8)" }, // L2 黃色
    { main: "#00ccff", glow: "rgba(0, 204, 255, 0.8)" },
    { main: "#aa00ff", glow: "rgba(170, 0, 255, 0.8)" }
];

let currentPerspectiveMode = 1; // 預設 2D 直軌

function togglePerspectiveMode() {
    currentPerspectiveMode = currentPerspectiveMode === 1 ? 2 : 1;
    const btn = document.getElementById('modeToggleBtn');
    if (btn) {
        btn.innerText = currentPerspectiveMode === 1 ? "🏊 2D 直軌" : "🚀 3D 尖角";
    }
}

function togglePlaybackSpeed() {
    const speeds = [0.7, 0.8, 0.9, 1.0];
    let idx = speeds.indexOf(playbackSpeed);
    playbackSpeed = speeds[(idx + 1) % speeds.length];
    
    Object.keys(audioElements).forEach(key => {
        audioElements[key].playbackRate = playbackSpeed;
    });

    const speedBtn = document.getElementById('speedToggleBtn');
    if (speedBtn) {
        speedBtn.innerText = `🎵 ${playbackSpeed.toFixed(1)}x`;
    }
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

// 🎯 全音符（Whole Note）模式：每 4 拍先出一粒！
function generateChart() {
    notes = [];
    particles = [];
    const beatMs = (60 / bpm) * 1000;
    const wholeNoteMs = beatMs * 4; // 🎯 整整一小節（4 拍）先一粒！
    let currentMs = audioOffsetMs;

    // 全曲 150 個小節，每小節第 1 拍落一粒特大黃色全音符
    for (let i = 0; i < 150; i++) {
        notes.push({
            type: 'tap',
            lane: 1, // L2 黃色軌道
            targetTime: currentMs,
            hit: false
        });
        currentMs += wholeNoteMs; // 隔足 4 拍先落下一粒
    }
}

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
/* =============================================================
   🔒 Arcatdia Battle Engine v3.2 - Whole Note (Part 2)
   ============================================================= */

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

        if (timeDiff < 200) {
            targetNote.hit = true;
            score += 1000;
            combo++;
            hp = Math.min(100, hp + 2);
            showJudgement("PERFECT!", laneColor);
            createHitParticles(targetX, currentHitY, laneColor);
        } else if (timeDiff < 350) {
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

function togglePlay() {
    initDSP();
    const playBtn = document.getElementById('mainPlayBtn');
    if (!isPlaying) {
        isPlaying = true;
        score = 0;
        combo = 0;
        hp = 100;
        updateUI();
        generateChart();
        playAllAudio();
        startTime = performance.now();
        if (playBtn) playBtn.innerText = "⏸ PAUSE";
        requestAnimationFrame(gameLoop);
    } else {
        isPlaying = false;
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
    const travelDuration = (7200 / noteSpeed); 
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
        ctx.arc(botX[i], hitZoneY, 20, 0, Math.PI * 2);
        ctx.fill();
    }

    // 🎯 橫向判定線
    ctx.strokeStyle = "rgba(0, 255, 204, 0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00ffcc";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY);
    ctx.lineTo(W, hitZoneY);
    ctx.stroke();

    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 12px Courier New";
    ctx.fillText(`🎯 判定線 [檔位 ${judgeLineLevel + 1}/4] - 全音符4拍模式`, 15, hitZoneY - 8);

    // 🎯 渲染全音符：特大亮眼光環，代表整小節第 1 拍重音
    notes.forEach(note => {
        const laneIndex = note.lane;
        const tx = topX[laneIndex];
        const bx = botX[laneIndex];
        const colorObj = laneColors[laneIndex];

        if (note.hit) return;
        const timeTillHit = note.targetTime - currentTimeMs;
        
        const rawProgress = 1.0 - (timeTillHit / travelDuration);
        const progress = Math.max(0, Math.min(1.1, Math.pow(rawProgress, 1.2)));

        if (progress > 0 && progress < 1.1) {
            const currentX = tx + (bx - tx) * progress;
            const currentY = startY + (hitZoneY - startY) * progress;

            ctx.fillStyle = colorObj.main;
            ctx.shadowColor = colorObj.main;
            ctx.shadowBlur = 20 * progress;
            ctx.beginPath();

            if (currentPerspectiveMode === 1) {
                // 🏊 特大全音符 (直軌)
                ctx.ellipse(currentX, currentY, 26, 32, 0, 0, Math.PI * 2);
            } else {
                // 🚀 3D 尖角
                const rx = (10 * (1.0 - progress)) + (52 * progress);
                const ry = (32 * (1.0 - progress)) + (14 * progress);
                ctx.ellipse(currentX, currentY, rx, ry, 0, 0, Math.PI * 2);
            }
            ctx.fill();
        }

        if (timeTillHit < -350 && !note.hit) {
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

    requestAnimationFrame(gameLoop);
}
