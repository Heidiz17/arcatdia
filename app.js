/* =============================================================
   🔒 Arcatdia Battle Engine v4.6 - Part 1 (架構與純淨譜面)
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

let playbackSpeed = 1.0;
let currentMode = 'easy'; // 'easy' | 'normal' | 'test'

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

// 🎯 首頁難度選擇
function chooseDifficultyAndStart(mode) {
    currentMode = mode;
    const mask = document.getElementById('startMask');
    if (mask) mask.style.display = 'none';

    const info = document.getElementById('hudTrackInfo');
    if (info) {
        if (currentMode === 'easy') info.innerText = "01_EASY (4拍/2拍)";
        else if (currentMode === 'normal') info.innerText = "01_NORMAL (2拍/1拍)";
        else info.innerText = "01_TEST (全音符校準)";
    }

    togglePlay();
}

function togglePlaybackSpeed() {
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

// 🎯 譜面生成：嚴格杜絕半拍，Easy (4拍/2拍) 與 Normal (2拍/1拍)
function generateChart() {
    notes = [];
    particles = [];
    const beatMs = (60 / bpm) * 1000; // ~342.8ms
    const barMs = beatMs * 4;         // 1371.4ms
    const firstHitTime = barMs; 

    if (currentMode === 'test') {
        for (let i = 0; i < 150; i++) {
            notes.push({
                type: 'tap',
                lane: 1, 
                targetTime: firstHitTime + (i * barMs),
                hit: false
            });
        }
    } else if (currentMode === 'easy') {
        for (let bar = 0; bar < 80; bar++) {
            const barStart = firstHitTime + (bar * barMs);
            const cycle = bar % 4;

            if (cycle === 0) {
                notes.push({ type: 'tap', lane: 1, targetTime: barStart, hit: false });
                notes.push({ type: 'tap', lane: 2, targetTime: barStart + (beatMs * 2), hit: false });
            } else if (cycle === 1) {
                notes.push({ 
                    type: 'hold', lane: 0, 
                    targetTime: barStart, duration: beatMs * 2, 
                    holding: false, hit: false, lastTick: 0 
                });
                notes.push({ type: 'tap', lane: 3, targetTime: barStart + (beatMs * 2), hit: false });
            } else if (cycle === 2) {
                notes.push({ type: 'tap', lane: 1, targetTime: barStart, hit: false });
            } else {
                notes.push({ 
                    type: 'hold', lane: 2, 
                    targetTime: barStart, duration: beatMs * 2, 
                    holding: false, hit: false, lastTick: 0 
                });
                notes.push({ type: 'tap', lane: 0, targetTime: barStart + (beatMs * 2), hit: false });
                notes.push({ type: 'tap', lane: 3, targetTime: barStart + (beatMs * 2), hit: false });
            }
        }
    } else if (currentMode === 'normal') {
        for (let bar = 0; bar < 80; bar++) {
            const barStart = firstHitTime + (bar * barMs);
            const cycle = bar % 4;

            if (cycle === 0) {
                notes.push({ type: 'tap', lane: 1, targetTime: barStart, hit: false });
                notes.push({ type: 'tap', lane: 2, targetTime: barStart + (beatMs * 1), hit: false });
                notes.push({ type: 'tap', lane: 0, targetTime: barStart + (beatMs * 2), hit: false });
                notes.push({ type: 'tap', lane: 3, targetTime: barStart + (beatMs * 3), hit: false });
            } else if (cycle === 1) {
                notes.push({ 
                    type: 'hold', lane: 1, 
                    targetTime: barStart, duration: beatMs * 2, 
                    holding: false, hit: false, lastTick: 0 
                });
                notes.push({ type: 'tap', lane: 0, targetTime: barStart + (beatMs * 2), hit: false });
                notes.push({ type: 'tap', lane: 2, targetTime: barStart + (beatMs * 3), hit: false });
            } else if (cycle === 2) {
                notes.push({ type: 'tap', lane: 0, targetTime: barStart, hit: false });
                notes.push({ type: 'tap', lane: 3, targetTime: barStart, hit: false });
                notes.push({ type: 'tap', lane: 1, targetTime: barStart + (beatMs * 2), hit: false });
                notes.push({ type: 'tap', lane: 2, targetTime: barStart + (beatMs * 2), hit: false });
            } else {
                notes.push({ type: 'tap', lane: 0, targetTime: barStart, hit: false });
                notes.push({ type: 'tap', lane: 1, targetTime: barStart + (beatMs * 1), hit: false });
                notes.push({ 
                    type: 'hold', lane: 2, 
                    targetTime: barStart + (beatMs * 2), duration: beatMs * 2, 
                    holding: false, hit: false, lastTick: 0 
                });
            }
        }
    }

    notes.sort((a, b) => a.targetTime - b.targetTime);
}

// 🎯 綁定軌道觸控
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
            playHiHatHitSound();
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
   🔒 Arcatdia Battle Engine v4.6 - Part 2 (判定與遊戲循環)
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

        if (targetNote.type === 'hold') {
            if (timeDiff < 250) {
                targetNote.holding = true;
                targetNote.lastTick = currentTimeMs;
                score += 500;
                combo++;
                showJudgement("HOLD!", laneColor);
                createHitParticles(targetX, currentHitY, laneColor);
                updateUI();
            }
        } else {
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
}

function handleRelease(laneIndex) {
    if (!isPlaying) return;
    const currentTimeMs = (performance.now() - startTime) * playbackSpeed;

    const holdingNote = notes.find(n => n.lane === laneIndex && n.type === 'hold' && n.holding && !n.hit);
    if (holdingNote) {
        const endTime = holdingNote.targetTime + holdingNote.duration;
        if (currentTimeMs < endTime - 150) {
            holdingNote.holding = false;
            holdingNote.hit = true;
            combo = 0;
            hp = Math.max(0, hp - 4);
            showJudgement("BREAK!", "#ff0055");
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

// 🎯 核心調度：550ms 空氣差咬死對齊
function scheduleCountInAndPlay() {
    clearAllTimers();
    const beatMs = (60 / bpm) * 1000;
    const totalLeadMs = beatMs * 4;

    [0, 1, 2, 3].forEach(b => {
        const t = setTimeout(() => {
            if (!isPlaying) return;
            playStickClick(b === 3 ? 1800 : 1200);
            showJudgement(`${b + 1}`, "#00ffcc");
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
    const travelDuration = beatMs * 2;

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

        if (note === notes[0] && rawProgress >= 0 && firstNoteBornTime === null) {
            firstNoteBornTime = currentTimeMs;
        }

        if (note.type === 'hold') {
            const endTime = note.targetTime + note.duration;
            const timeTillEnd = endTime - currentTimeMs;
            const endProgress = 1.0 - (timeTillEnd / travelDuration);

            if (note.holding) {
                if (currentTimeMs - note.lastTick >= 120) {
                    note.lastTick = currentTimeMs;
                    score += 150;
                    combo++;
                    createHitParticles(bx, hitZoneY, colorObj.main);
                    updateUI();
                }

                if (currentTimeMs >= endTime) {
                    note.hit = true;
                    note.holding = false;
                    score += 800;
                    combo++;
                    hp = Math.min(100, hp + 3);
                    showJudgement("COMPLETE!", "#00ffcc");
                    createHitParticles(bx, hitZoneY, "#00ffcc");
                    updateUI();
                }
            }

            if (rawProgress > 0 && endProgress < 1.15) {
                const headP = Math.min(1.0, Math.max(0, rawProgress));
                const tailP = Math.min(1.0, Math.max(0, endProgress));

                const hy = startY + (hitZoneY - startY) * headP;
                const hx = tx + (bx - tx) * headP;
                const ty = startY + (hitZoneY - startY) * tailP;
                const txPos = tx + (bx - tx) * tailP;

                ctx.save();
                ctx.strokeStyle = note.holding ? "#ffffff" : colorObj.glow;
                ctx.lineWidth = note.holding ? 32 : 24;
                ctx.lineCap = "round";
                ctx.shadowColor = colorObj.main;
                ctx.shadowBlur = note.holding ? 25 : 12;
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                ctx.lineTo(txPos, ty);
                ctx.stroke();
                ctx.restore();

                ctx.fillStyle = colorObj.main;
                ctx.beginPath();
                ctx.arc(hx, hy, 24, 0, Math.PI * 2);
                ctx.fill();
            }

            if (rawProgress > 1.15 && !note.holding && !note.hit) {
                note.hit = true;
                combo = 0;
                hp = Math.max(0, hp - 5);
                showJudgement("MISS", "#ff0055");
                updateUI();
            }

        } else {
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

    // 🎯 測試模式才顯示綠色 HUD 遙測盒
    if (currentMode === 'test') {
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
    }

    requestAnimationFrame(gameLoop);
}

// 🎯 初始化畫布
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
