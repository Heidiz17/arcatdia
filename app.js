/* =============================================================
   🔒 Arcatdia Battle Engine v1.7 - Perfect Perspective Logic
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
let startTime = 0;

const audioOffsetMs = 250; 
let noteSpeed = 6.0; 

const lanePressed = [false, false, false, false];

/* -------------------------------------------------------------
   📐 視角 Mode 定義：
   Mode 1: 🏊 2D 純垂直直軌 (遊水賽道模式 - 方便打 20 萬高分！)
   Mode 2: 🚀 3D 尖角消失點 (遠處企直 ➔ 衝到眼前旋轉打橫瞓喺度)
   ------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   🎛️ DSP 高音 Hi-Hat 切切聲
   ------------------------------------------------------------- */
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
        const bufferSize = dspCtx.sampleRate * 0.04;
        const buffer = dspCtx.createBuffer(1, bufferSize, dspCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = dspCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = dspCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = dspCtx.createGain();
        gain.gain.setValueAtTime(0.6, dspCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, dspCtx.currentTime + 0.04);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(dspCtx.destination);

        noise.start();
    } catch (e) {}
}

/* -------------------------------------------------------------
   ✨ 打擊爆發火花粒子
   ------------------------------------------------------------- */
function createHitParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 4 + 2,
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

/* -------------------------------------------------------------
   🎼 譜面生成：貫穿整首 3.5 分鐘全曲《最大的愛》(約 600+ 音符)
   ------------------------------------------------------------- */
function generate175BpmChart() {
    notes = [];
    const beatMs = (60 / bpm) * 1000;

    let currentMs = audioOffsetMs;

    // 涵蓋整首 3 分多鐘 (約 620 個 Beats)
    for (let i = 0; i < 620; i++) {
        // 長按條 (Hold Note)
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
            // 單擊 (Tap) - Verse / Chorus / Guitar Solo 節奏變化
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
    const hitZoneY = canvas.height - 110;
    const laneWidth = canvas.width / 4;
    const targetX = laneWidth * laneIndex + (laneWidth / 2);

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
    const hitZoneY = canvas.height - 110;
    const startY = 40;

    const W = canvas.width;
    const laneW = W / 4;

    // 定義兩套軌道頂部與底部的 X 座標
    // Mode 1: 2D 遊水賽道直軌 | Mode 2: 3D 尖角
    const topX = (currentPerspectiveMode === 1) 
        ? [laneW*0.5, laneW*1.5, laneW*2.5, laneW*3.5]
        : [W*0.42, W*0.47, W*0.53, W*0.58];

    const botX = [laneW*0.5, laneW*1.5, laneW*2.5, laneW*3.5];

    // 1. 畫 4 條軌道
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = "rgba(0, 255, 204, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topX[i], startY);
        ctx.lineTo(botX[i], canvas.height);
        ctx.stroke();

        ctx.fillStyle = "#ff0077";
        ctx.shadowColor = "#ff0077";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(botX[i], hitZoneY, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. 畫 Notes 樂譜
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
                ctx.shadowBlur = 12 * progress;
                ctx.beginPath();

                if (currentPerspectiveMode === 1) {
                    // 🏊 Mode 1 (2D 直軌): 完全企直，安安份份直落！
                    ctx.ellipse(currentX, currentY, 12, 18, 0, 0, Math.PI * 2);
                } else {
                    // 🚀 Mode 2 (3D 尖角): 正宗幾何透視——遠處企直 (Rx < Ry) ➔ 衝到眼前旋轉打橫瞓喺度 (Rx > Ry)！
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
                ctx.lineWidth = note.holding ? 18 : 12;
                ctx.shadowColor = "#00ffcc";
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(headX, headY);
                ctx.stroke();
            }

            if (note.holding && lanePressed[laneIndex]) {
                if (Math.random() < 0.4) {
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

    // 3. 粒子爆發
    particles.forEach((p, index) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;

        if (p.alpha <= 0) particles.splice(index, 1);
    });

    requestAnimationFrame(gameLoop);
}
