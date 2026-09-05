/* =============================================================
   🔒 Arcatdia Battle Engine v1.8 - Memory Safe & Safe Area Edition
   ============================================================= */

const canvas = document.getElementById('battleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 850; 
canvas.height = 420;

let bpm = 175;
let isPlaying = false;
let score = 0;
let combo = 0;
let hp = 100;
let notes = [];
let particles = [];
let startTime = 0;

const audioOffsetMs = 250; 
let noteSpeed = 6.0; 

const lanePressed = [false, false, false, false];

let currentPerspectiveMode = 1;

function togglePerspectiveMode() {
    currentPerspectiveMode = currentPerspectiveMode === 1 ? 2 : 1;
    const btn = document.getElementById('modeToggleBtn');
    if (btn) {
        btn.innerText = currentPerspectiveMode === 1 ? "🏊 2D 直軌" : "🚀 3D 尖角";
    }
}

function toggleNoteSpeed() {
    const speeds = [2.0, 4.0, 6.0, 8.0, 10.0];
    let idx = speeds.indexOf(noteSpeed);
    noteSpeed = speeds[(idx + 1) % speeds.length];
    const btn = document.getElementById('speedToggleBtn');
    if (btn) {
        btn.innerText = `⚡ ${noteSpeed.toFixed(1)}x`;
    }
}

/* 🎛️ DSP 高音 Hi-Hat */
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

/* ✨ 記憶體安全粒子系統（上限 30 粒，防爆 GPU 防 Hang 機） */
function createHitParticles(x, y, color) {
    if (particles.length > 30) {
        particles.splice(0, 10); // 清除舊粒子，防止 Hang 機！
    }
    for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 2,
            color: color,
            alpha: 1.0
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

function generate175BpmChart() {
    notes = [];
    particles = []; // 重置粒子
    const beatMs = (60 / bpm) * 1000;

    let currentMs = audioOffsetMs;

    for (let i = 0; i < 600; i++) {
        if (i % 16 === 7) {
            notes.push({
                type: 'hold',
                lane: (i % 4),
                startTime: currentMs,
                endTime: currentMs + (beatMs * 3.0),
                holding: false,
                completed: false,
                hit: false
            });
            currentMs += beatMs * 4.0;
        } else {
            const pattern = [
                [0], [2], [1], [3], 
                [0, 2], [1], [3], [0], 
                [1, 3], [2], [0], [3]
            ][i % 12];

            pattern.forEach(laneIndex => {
                notes.push({
                    type: 'tap',
                    lane: laneIndex,
                    targetTime: currentMs,
                    hit: false
                });
            });
            currentMs += beatMs;
        }
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
            handleRelease(i);
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
            handleRelease(i);
        });
    }
}

function handleTap(laneIndex) {
    if (!isPlaying) return;
    const currentTimeMs = performance.now() - startTime;
    const bottomLanesX = [106, 318, 530, 742];
    const hitZoneY = 380;
    const targetX = bottomLanesX[laneIndex];

    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit && !n.completed);

    if (targetNote) {
        if (targetNote.type === 'tap') {
            const timeDiff = Math.abs(currentTimeMs - targetNote.targetTime);

            if (timeDiff < 180) {
                targetNote.hit = true;
                score += 1000;
                combo++;
                hp = Math.min(100, hp + 2);
                showJudgement("PERFECT!", "#00ffcc");
                createHitParticles(targetX, hitZoneY, "#00ffcc");
            } else if (timeDiff < 300) {
                targetNote.hit = true;
                score += 500;
                combo++;
                showJudgement("GREAT", "#ffaa00");
                createHitParticles(targetX, hitZoneY, "#ffaa00");
            }
        } else if (targetNote.type === 'hold') {
            const timeDiff = Math.abs(currentTimeMs - targetNote.startTime);
            if (timeDiff < 300) {
                targetNote.holding = true;
                showJudgement("HOLD!", "#00ffcc");
            }
        }
        updateUI();
    }
}

function handleRelease(laneIndex) {
    if (!isPlaying) return;
    const currentTimeMs = performance.now() - startTime;

    const holdNote = notes.find(n => n.lane === laneIndex && n.type === 'hold' && n.holding && !n.completed);
    if (holdNote) {
        if (currentTimeMs < holdNote.endTime - 150) {
            holdNote.holding = false;
            holdNote.completed = true;
            combo = 0;
            hp = Math.max(0, hp - 8);
            showJudgement("MISS (RELEASE)", "#ff0055");
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
        setTimeout(() => { disp.style.opacity = '0'; }, 250);
    }
}

function playAllAudio() {
    Object.keys(audioElements).forEach(key => {
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
        generate175BpmChart();
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

function startBattle() {
    initDSP();
    const mask = document.getElementById('startMask');
    if (mask) mask.style.display = 'none';
    togglePlay();
}

function gameLoop() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentTimeMs = performance.now() - startTime;
    const travelDuration = 7200 / noteSpeed; 
    const hitZoneY = 380;
    const startY = 30;

    const bottomLanesX = [106, 318, 530, 742];

    // Mode 1: 2D 直軌 | Mode 2: 3D 尖角
    const topX = (currentPerspectiveMode === 1) 
        ? [106, 318, 530, 742]
        : [390, 413, 436, 460];

    const botX = bottomLanesX;

    // 1. 畫軌道
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = "rgba(0, 255, 204, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topX[i], startY);
        ctx.lineTo(botX[i], canvas.height);
        ctx.stroke();

        ctx.fillStyle = "#ff0077";
        ctx.shadowColor = "#ff0077";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(botX[i], hitZoneY, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. 畫 Notes
    notes.forEach(note => {
        const laneIndex = note.lane;
        const tx = topX[laneIndex];
        const bx = botX[laneIndex];

        if (note.type === 'tap') {
            if (note.hit) return;
            const timeTillHit = note.targetTime - currentTimeMs;
            
            const rawProgress = 1.0 - (timeTillHit / travelDuration);
            const progress = Math.max(0, Math.min(1.1, Math.pow(rawProgress, 1.2)));

            if (progress > 0 && progress < 1.1) {
                const currentX = tx + (bx - tx) * progress;
                const currentY = startY + (hitZoneY - startY) * progress;

                ctx.fillStyle = "#00ffcc";
                ctx.shadowColor = "#00ffcc";
                ctx.shadowBlur = 10 * progress;
                ctx.beginPath();

                if (currentPerspectiveMode === 1) {
                    ctx.ellipse(currentX, currentY, 12, 18, 0, 0, Math.PI * 2);
                } else {
                    const rx = (6 * (1.0 - progress)) + (20 * progress);
                    const ry = (18 * (1.0 - progress)) + (8 * progress);
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
        } 
        else if (note.type === 'hold') {
            if (note.completed) return;

            const rawHead = 1.0 - ((note.startTime - currentTimeMs) / travelDuration);
            const rawTail = 1.0 - ((note.endTime - currentTimeMs) / travelDuration);

            const headProgress = Math.pow(Math.max(0, Math.min(1, rawHead)), 1.2);
            const tailProgress = Math.pow(Math.max(0, Math.min(1, rawTail)), 1.2);

            if (headProgress > 0 && tailProgress < 1.1) {
                const headY = Math.min(hitZoneY, startY + (hitZoneY - startY) * headProgress);
                const tailY = Math.max(startY, startY + (hitZoneY - startY) * tailProgress);

                const headX = tx + (bx - tx) * headProgress;
                const tailX = tx + (bx - tx) * tailProgress;

                ctx.strokeStyle = note.holding ? "rgba(0, 255, 204, 0.8)" : "rgba(0, 255, 204, 0.4)";
                ctx.lineWidth = note.holding ? 16 : 10;
                ctx.shadowColor = "#00ffcc";
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(headX, headY);
                ctx.stroke();
            }

            if (note.holding && lanePressed[laneIndex]) {
                if (Math.random() < 0.3) {
                    createHitParticles(bx, hitZoneY, "#00ffcc");
                    score += 50;
                    combo++;
                    updateUI();
                }

                if (currentTimeMs >= note.endTime) {
                    note.completed = true;
                    note.holding = false;
                    score += 2000;
                    showJudgement("PERFECT!", "#00ffcc");
                    createHitParticles(bx, hitZoneY, "#00ffcc");
                    updateUI();
                }
            }

            if (currentTimeMs > note.startTime + 300 && !note.holding && !note.completed) {
                note.completed = true;
                combo = 0;
                hp = Math.max(0, hp - 8);
                showJudgement("MISS (HOLD)", "#ff0055");
                updateUI();
            }
        }
    });

    // 3. 粒子渲染與自動清理
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
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
