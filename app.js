/* =============================================================
   🔒 Arcatdia Battle Engine v6.0 - Part 1 (世界計劃標準立體磚面版)
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
let celestialEvents = [];
let startTime = 0;

let playbackSpeed = 1.0;
let scrollSpeedMultiplier = 1.0; 
let currentMode = 'easy';

const judgeLineOffsets = [165, 185, 205, 225];
let judgeLineLevel = 1; 

const lanePressed = [false, false, false, false];

// 🎨 世界計劃風格經典 4 色（高對比度、乾淨霓虹光）
const laneColors = [
    { main: "#ff2a6d", border: "#ffffff", glow: "rgba(255, 42, 109, 0.7)" },  // 櫻粉紅
    { main: "#05d9e8", border: "#ffffff", glow: "rgba(5, 217, 232, 0.7)" },   // 亮青藍
    { main: "#ffb703", border: "#ffffff", glow: "rgba(255, 183, 3, 0.7)" },   // 燦金黃
    { main: "#b5179e", border: "#ffffff", glow: "rgba(181, 23, 158, 0.7)" }   // 幻夜紫
];

let currentPerspectiveMode = 2; // 預設鎖定 3D 經典世界計劃梯形視角

function chooseDifficultyAndStart(mode) {
    currentMode = mode;
    const mask = document.getElementById('startMask');
    if (mask) mask.style.display = 'none';

    const info = document.getElementById('hudTrackInfo');
    if (info) {
        if (currentMode === 'easy') info.innerText = "01_EASY (4拍/2拍 慢悠舒適)";
        else if (currentMode === 'normal') info.innerText = "01_NORMAL (2拍/1拍 正音連動)";
        else info.innerText = "01_TEST (校準實驗場)";
    }

    updateHeaderButtons();
    togglePlay();
}

function restartSong() {
    clearAllTimers();
    pauseAllAudio();
    isPlaying = false;

    score = 0;
    combo = 0;
    hp = 100;
    firstNoteBornTime = null;
    firstNoteHitTime = null;
    recordedTravelTime = "--";
    updateUI();

    showJudgement("🔄 RESTART!");

    isPlaying = true;
    initCelestialJourney();
    generateChart();
    startTime = performance.now();
    scheduleCountInAndPlay();

    const playBtn = document.getElementById('mainPlayBtn');
    if (playBtn) playBtn.innerText = "⏸ PAUSE";

    requestAnimationFrame(gameLoop);
}

function toggleSpeedButton() {
    if (currentMode === 'test') {
        const speeds = [1.0, 0.8, 0.6, 0.5];
        let idx = speeds.indexOf(playbackSpeed);
        if (idx === -1) idx = 0;
        playbackSpeed = speeds[(idx + 1) % speeds.length];
        
        Object.keys(audioElements).forEach(key => {
            audioElements[key].playbackRate = playbackSpeed;
        });
        showJudgement(`歌曲慢速: ${playbackSpeed.toFixed(1)}x`);
    } else {
        const scrollMultipliers = [1.0, 1.5, 2.0, 0.7];
        let idx = scrollMultipliers.indexOf(scrollSpeedMultiplier);
        if (idx === -1) idx = 0;
        scrollSpeedMultiplier = scrollMultipliers[(idx + 1) % scrollMultipliers.length];
        showJudgement(`流速: ${scrollSpeedMultiplier.toFixed(1)}x`);
    }
    updateHeaderButtons();
}

function updateHeaderButtons() {
    const speedBtn = document.getElementById('speedToggleBtn');
    if (speedBtn) {
        if (currentMode === 'test') {
            speedBtn.innerText = `🎵 ${playbackSpeed.toFixed(1)}x`;
            speedBtn.style.color = "#00ffcc";
            speedBtn.style.borderColor = "#00ffcc";
        } else {
            speedBtn.innerText = `🚀 ${scrollSpeedMultiplier.toFixed(1)}x`;
            speedBtn.style.color = "#ffaa00";
            speedBtn.style.borderColor = "#ffaa00";
        }
    }
}

function toggleJudgeLineLevel() {
    judgeLineLevel = (judgeLineLevel + 1) % judgeLineOffsets.length;
    showJudgement(`線位: LV ${judgeLineLevel + 1}`);
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
            { name: "🪐 木星", color: "rgba(235, 140, 60, 0.28)", radius: 75, xRatio: 0.60, yRatio: 0.18 },
            { name: "🪐 土星環", color: "rgba(240, 210, 140, 0.28)", radius: 52, xRatio: 0.82, yRatio: 0.26, hasRing: true }
        ]},
        { timeSec: 88, duration: 11, planets: [
            { name: "🧊 天王星", color: "rgba(120, 235, 235, 0.28)", radius: 50, xRatio: 0.62, yRatio: 0.20 },
            { name: "🌊 海王星", color: "rgba(65, 105, 225, 0.30)", radius: 48, xRatio: 0.80, yRatio: 0.25 }
        ]},
        { timeSec: 122, duration: 9, planets: [{ name: "❄️ 冥王星界", color: "rgba(195, 220, 240, 0.25)", radius: 40, xRatio: 0.72, yRatio: 0.22 }] },
        { timeSec: 148, duration: 12, planets: [{ name: "🌌 阿卡迪亞星雲", color: "rgba(180, 60, 255, 0.32)", radius: 95, xRatio: 0.70, yRatio: 0.18 }] },
        { timeSec: 175, duration: 25, planets: [{ name: "🐾 降落：阿卡迪亞貓星", color: "rgba(255, 105, 180, 0.40)", radius: 115, xRatio: 0.68, yRatio: 0.18 }] }
    ];
}

// 🎯 音頻引擎：極簡低負載 DSP
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let dspCtx = null;
let tapBuffer = null;

function initDSP() {
    try {
        if (!dspCtx) {
            dspCtx = new AudioContextClass();
            // 預先生成一小段極脆、零運算負荷的打擊 Buffer (音遊標準)
            const bufferSize = dspCtx.sampleRate * 0.025;
            tapBuffer = dspCtx.createBuffer(1, bufferSize, dspCtx.sampleRate);
            const data = tapBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
            }
        }
        if (dspCtx.state === 'suspended') dspCtx.resume();
    } catch (e) {}
}

function playFastHitSound() {
    if (!dspCtx || !tapBuffer) return;
    try {
        const src = dspCtx.createBufferSource();
        src.buffer = tapBuffer;
        const gain = dspCtx.createGain();
        gain.gain.value = 0.6;
        src.connect(gain);
        gain.connect(dspCtx.destination);
        src.start();
    } catch (e) {}
}

function playStickClick(freq = 1200) {
    if (!dspCtx) return;
    try {
        const osc = dspCtx.createOscillator();
        const gain = dspCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, dspCtx.currentTime);
        gain.gain.setValueAtTime(0.7, dspCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, dspCtx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(dspCtx.destination);
        osc.start();
        osc.stop(dspCtx.currentTime + 0.04);
    } catch (e) {}
}

function createHitParticles(x, y, color) {
    if (particles.length > 25) particles.splice(0, 8);
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

function getNextLane(lastLane) {
    let next = Math.floor(Math.random() * 4);
    while (next === lastLane) {
        next = Math.floor(Math.random() * 4);
    }
    return next;
}

function generateChart() {
    notes = [];
    particles = [];
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4;
    const firstHitTime = barMs; 
    const totalBars = 145; 
    const holdDuration = beatMs * 0.5; // 半拍短 Hold

    let lastLane = 1;

    if (currentMode === 'test') {
        for (let i = 0; i < totalBars; i++) {
            notes.push({ type: 'tap', lane: 1, targetTime: firstHitTime + (i * barMs), hit: false });
        }
    } else if (currentMode === 'easy') {
        for (let bar = 0; bar < totalBars; bar++) {
            const barStart = firstHitTime + (bar * barMs);
            const roll = Math.random();

            if (roll < 0.55) {
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'tap', lane: lastLane, targetTime: barStart, hit: false });
            } else if (roll < 0.8) {
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'hold', lane: lastLane, targetTime: barStart, duration: holdDuration, holding: false, hit: false, lastTick: 0 });
            } else {
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'tap', lane: lastLane, targetTime: barStart, hit: false });
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'tap', lane: lastLane, targetTime: barStart + (beatMs * 2), hit: false });
            }
        }
    } else if (currentMode === 'normal') {
        for (let bar = 0; bar < totalBars; bar++) {
            const barStart = firstHitTime + (bar * barMs);
            const roll = Math.random();

            if (roll < 0.6) {
                for (let b = 0; b < 4; b++) {
                    lastLane = getNextLane(lastLane);
                    notes.push({ type: 'tap', lane: lastLane, targetTime: barStart + (beatMs * b), hit: false });
                }
            } else if (roll < 0.85) {
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'hold', lane: lastLane, targetTime: barStart, duration: holdDuration, holding: false, hit: false, lastTick: 0 });
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'tap', lane: lastLane, targetTime: barStart + (beatMs * 2), hit: false });
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'tap', lane: lastLane, targetTime: barStart + (beatMs * 3), hit: false });
            } else {
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'tap', lane: lastLane, targetTime: barStart, hit: false });
                lastLane = getNextLane(lastLane);
                notes.push({ type: 'tap', lane: lastLane, targetTime: barStart + (beatMs * 2), hit: false });
            }
        }
    }
    notes.sort((a, b) => a.targetTime - b.targetTime);
}

// 🎯 觸控綁定
for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        laneBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            laneBtn.classList.add('pressed');
            lanePressed[i] = true;
            playFastHitSound();
            handleTap(i);
        });
        const handleTouchRelease = (e) => {
            e.preventDefault();
            laneBtn.classList.remove('pressed');
            lanePressed[i] = false;
            handleRelease(i);
        };
        laneBtn.addEventListener('touchend', handleTouchRelease);
        laneBtn.addEventListener('touchcancel', handleTouchRelease);

        laneBtn.addEventListener('mousedown', () => {
            laneBtn.classList.add('pressed');
            lanePressed[i] = true;
            playFastHitSound();
            handleTap(i);
        });
        laneBtn.addEventListener('mouseup', () => {
            laneBtn.classList.remove('pressed');
            lanePressed[i] = false;
            handleRelease(i);
        });
        laneBtn.addEventListener('mouseleave', () => {
            if (lanePressed[i]) {
                laneBtn.classList.remove('pressed');
                lanePressed[i] = false;
                handleRelease(i);
            }
        });
    }
}
/* =============================================================
   🔒 Arcatdia Battle Engine v6.0 - Part 2 (立體橫磚渲染核心)
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

        if (targetNote.type === 'hold') {
            if (timeDiff < 260) {
                targetNote.holding = true;
                targetNote.lastTick = currentTimeMs;
                score += 500;
                combo++;
                showJudgement("HOLD!");
                createHitParticles(targetX, currentHitY, laneColor);
                updateUI();
            }
        } else {
            if (timeDiff < 180) {
                targetNote.hit = true;
                score += 1000;
                combo++;
                hp = Math.min(100, hp + 2);
                showJudgement("PERFECT!");
                createHitParticles(targetX, currentHitY, "#ffffff");
            } else if (timeDiff < 320) {
                targetNote.hit = true;
                score += 500;
                combo++;
                showJudgement("GREAT");
                createHitParticles(targetX, currentHitY, "#ffaa00");
            }
            updateUI();
        }
    }
}

function handleRelease(laneIndex) {
    if (!isPlaying) return;
    const currentTimeMs = (performance.now() - startTime) * playbackSpeed;
    const holdingNote = notes.find(n => n.lane === laneIndex && n.type === 'hold' && n.holding && !n.hit);
    if (holdingNote) {
        const endTime = holdingNote.targetTime + holdingNote.duration;
        if (currentTimeMs < endTime - 80) {
            holdingNote.holding = false;
            holdingNote.hit = true;
            combo = 0;
            hp = Math.max(0, hp - 4);
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
        if (text === "PERFECT!") {
            disp.style.color = "#ffffff";
            disp.style.textShadow = "0 0 10px #fff, 0 0 25px #ffd700, 0 0 45px #ffaa00";
        } else if (text === "GREAT" || text === "HOLD!") {
            disp.style.color = "#ffd700";
            disp.style.textShadow = "0 0 15px rgba(255, 215, 0, 0.8)";
        } else if (text.includes("RESTART")) {
            disp.style.color = "#00ffcc";
            disp.style.textShadow = "0 0 20px #00ffcc";
        } else {
            disp.style.color = "#ff0055";
            disp.style.textShadow = "0 0 15px rgba(255, 0, 85, 0.8)";
        }
        disp.style.opacity = '1';
        disp.style.transform = 'translate(-50%, -50%) scale(1.15)';
        setTimeout(() => { 
            disp.style.opacity = '0'; 
            disp.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }, 300);
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

function scheduleCountInAndPlay() {
    clearAllTimers();
    const beatMs = (60 / bpm) * 1000;
    const totalLeadMs = beatMs * 4;

    [0, 1, 2, 3].forEach(b => {
        const t = setTimeout(() => {
            if (!isPlaying) return;
            playStickClick(b === 3 ? 1800 : 1200);
            showJudgement(`${b + 1}`);
        }, (b * beatMs) / playbackSpeed);
        countInTimers.push(t);
    });

    const airGapOffset = 550; 
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
        initCelestialJourney();
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

function gameLoop() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentTimeMs = (performance.now() - startTime) * playbackSpeed;
    const currentSec = currentTimeMs / 1000;
    const W = canvas.width;
    const H = canvas.height;
    const hitZoneY = H - judgeLineOffsets[judgeLineLevel];
    const startY = 40;

    // 🎯 1. 繁星背景
    stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
        s.y += s.speed * (playbackSpeed * 1.5);
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });

    // 🎯 2. 行星事件背景
    celestialEvents.forEach(evt => {
        if (currentSec >= evt.timeSec && currentSec <= evt.timeSec + evt.duration) {
            const progress = (currentSec - evt.timeSec) / evt.duration;
            const alpha = Math.sin(progress * Math.PI) * 0.40;
            evt.planets.forEach(p => {
                ctx.save();
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 45;
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

    // 🎯 3. 世界計劃經典梯形 4 軌幾何計算
    const topTrackWidth = W * 0.42;
    const botTrackWidth = W * 0.96;
    const topStartX = (W - topTrackWidth) / 2;
    const botStartX = (W - botTrackWidth) / 2;

    const laneTopLeft = [];
    const laneBotLeft = [];
    for (let i = 0; i <= 4; i++) {
        laneTopLeft.push(topStartX + (topTrackWidth / 4) * i);
        laneBotLeft.push(botStartX + (botTrackWidth / 4) * i);
    }

    // 繪製軌道分割線（透視雷射線）
    for (let i = 0; i <= 4; i++) {
        ctx.strokeStyle = (i === 0 || i === 4) ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = (i === 0 || i === 4) ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(laneTopLeft[i], startY);
        ctx.lineTo(laneBotLeft[i], H);
        ctx.stroke();
    }

    // 🎯 4. 判定線（白金光芒）
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#00ffcc";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(botStartX - 10, hitZoneY);
    ctx.lineTo(botStartX + botTrackWidth + 10, hitZoneY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 🎯 5. 繪製音符（世界計劃經典發光橫磚）
    const beatMs = (60 / bpm) * 1000;
    const baseTravelDuration = beatMs * 2;
    const travelDuration = baseTravelDuration / scrollSpeedMultiplier;

    notes.forEach(note => {
        if (note.hit) return;
        const i = note.lane;
        const timeTillHit = note.targetTime - currentTimeMs;
        const rawProgress = 1.0 - (timeTillHit / travelDuration);

        // 🎯 Hold 長按（半透明立體光帶）
        if (note.type === 'hold') {
            const endTime = note.targetTime + note.duration;
            const timeTillEnd = endTime - currentTimeMs;
            const endProgress = 1.0 - (timeTillEnd / travelDuration);

            if (note.holding) {
                if (currentTimeMs - note.lastTick >= 80) {
                    note.lastTick = currentTimeMs;
                    score += 100;
                    combo++;
                    createHitParticles((laneBotLeft[i] + laneBotLeft[i+1]) / 2, hitZoneY, laneColors[i].main);
                    updateUI();
                }
                if (currentTimeMs >= endTime) {
                    note.hit = true;
                    note.holding = false;
                    score += 500;
                    combo++;
                    hp = Math.min(100, hp + 3);
                    showJudgement("PERFECT!");
                    createHitParticles((laneBotLeft[i] + laneBotLeft[i+1]) / 2, hitZoneY, "#ffffff");
                    updateUI();
                }
            }

            if (rawProgress > 0 && endProgress < 1.15) {
                const headP = Math.min(1.0, Math.max(0, rawProgress));
                const tailP = Math.min(1.0, Math.max(0, endProgress));

                const hy = startY + (hitZoneY - startY) * headP;
                const ty = startY + (hitZoneY - startY) * tailP;

                const hxL = laneTopLeft[i] + (laneBotLeft[i] - laneTopLeft[i]) * headP;
                const hxR = laneTopLeft[i+1] + (laneBotLeft[i+1] - laneTopLeft[i+1]) * headP;
                const txL = laneTopLeft[i] + (laneBotLeft[i] - laneTopLeft[i]) * tailP;
                const txR = laneTopLeft[i+1] + (laneBotLeft[i+1] - laneTopLeft[i+1]) * tailP;

                // 畫光柱長帶
                ctx.save();
                ctx.fillStyle = note.holding ? "rgba(255, 255, 255, 0.45)" : laneColors[i].glow;
                ctx.beginPath();
                ctx.moveTo(hxL, hy);
                ctx.lineTo(hxR, hy);
                ctx.lineTo(txR, ty);
                ctx.lineTo(txL, ty);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // 頭部發光橫磚
                drawSekaiBar(hxL, hxR, hy, laneColors[i]);
            }

            if (rawProgress > 1.15 && !note.holding && !note.hit) {
                note.hit = true;
                combo = 0;
                hp = Math.max(0, hp - 5);
                showJudgement("MISS");
                updateUI();
            }

        } else {
            // 🎯 Tap 單擊：立體發光長方形橫磚
            if (rawProgress > 0 && rawProgress < 1.12) {
                const curY = startY + (hitZoneY - startY) * rawProgress;
                const curLeft = laneTopLeft[i] + (laneBotLeft[i] - laneTopLeft[i]) * rawProgress;
                const curRight = laneTopLeft[i+1] + (laneBotLeft[i+1] - laneTopLeft[i+1]) * rawProgress;

                drawSekaiBar(curLeft, curRight, curY, laneColors[i]);
            }

            if (rawProgress > 1.08 && !note.hit) {
                note.hit = true;
                combo = 0;
                hp = Math.max(0, hp - 5);
                showJudgement("MISS");
                updateUI();
            }
        }
    });

    // 🎯 輔助：繪製世界計劃發光橫磚 (GPU 極速繪製)
    function drawSekaiBar(x1, x2, y, colorObj) {
        const barWidth = x2 - x1 - 4;
        const barHeight = 14; 
        const barX = x1 + 2;
        const barY = y - (barHeight / 2);

        // 外層主色橫磚
        ctx.fillStyle = colorObj.main;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // 頂部高光（白色條紋，塑造立體感）
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(barX + 2, barY + 2, barWidth - 4, 3);

        // 底部陰影加強質感
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(barX, barY + barHeight - 3, barWidth, 3);
    }

    // 🎯 6. 打擊粒子爆發
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.06;
        if (p.alpha <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}

(function initialDraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
})();
