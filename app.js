/* =============================================================
   🔒 Arcatdia Battle Engine v1.5 - SEKAI Hi-Speed Edition
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

// 🎯 下落速度設定 (1.0x ~ 10.0x)
let noteSpeed = 6.0; 

const lanePressed = [false, false, false, false];

/* -------------------------------------------------------------
   📐 視角與速度切換 (Mode & Speed Selector)
   ------------------------------------------------------------- */
let currentPerspectiveMode = 1;

const mode1TopX = [280, 376, 473, 570];
const mode2TopX = [390, 413, 436, 460];

const vanishingPoint = { x: 425, y: 30 };
const bottomLanesX = [106, 318, 530, 742]; 
const hitZoneY = 380;                      

function getActiveTopX() {
    return currentPerspectiveMode === 1 ? mode1TopX : mode2TopX;
}

function togglePerspectiveMode() {
    currentPerspectiveMode = currentPerspectiveMode === 1 ? 2 : 1;
    const btn = document.getElementById('modeToggleBtn');
    if (btn) {
        btn.innerText = currentPerspectiveMode === 1 ? "MODE: 1 (舒適)" : "MODE: 2 (尖角)";
    }
}

// 🎯 一鍵切換下落速度 (Hi-Speed Toggle)
function toggleNoteSpeed() {
    const speeds = [2.0, 4.0, 6.0, 8.0, 10.0];
    let idx = speeds.indexOf(noteSpeed);
    noteSpeed = speeds[(idx + 1) % speeds.length];
    const btn = document.getElementById('speedToggleBtn');
    if (btn) {
        btn.innerText = `SPEED: ${noteSpeed.toFixed(1)}x`;
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

function generate175BpmChart() {
    notes = [];
    const beatMs = (60 / bpm) * 1000;

    let currentMs = audioOffsetMs;

    for (let i = 0; i < 120; i++) {
        if (i % 8 === 3) {
            notes.push({
                type: 'hold',
                lane: (i % 4),
                startTime: currentMs,
                endTime: currentMs + (beatMs * 2.5),
                holding: false,
                completed: false,
                hit: false
            });
            currentMs += beatMs * 3.5;
        } else {
            const pattern = [[0], [2], [1], [3], [0, 2], [1, 3]][i % 6];
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

    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit && !n.completed);

    if (targetNote) {
        if (targetNote.type === 'tap') {
            const timeDiff = Math.abs(currentTimeMs - targetNote.targetTime);
            const targetX = bottomLanesX[laneIndex];

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
    const currentTopX = getActiveTopX();

    // 🎯 速度動態計算 (Travel Duration Base = 7200 / noteSpeed)
    const travelDuration = 7200 / noteSpeed; 

    for (let i = 0; i < 4; i++) {
        const topX = currentTopX[i];
        const botX = bottomLanesX[i];

        ctx.strokeStyle = "rgba(0, 255, 204, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topX, vanishingPoint.y);
        ctx.lineTo(botX, canvas.height);
        ctx.stroke();

        ctx.fillStyle = "#ff0077";
        ctx.shadowColor = "#ff0077";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(botX, hitZoneY, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    notes.forEach(note => {
        const laneIndex = note.lane;
        const topX = currentTopX[laneIndex];
        const botX = bottomLanesX[laneIndex];

        if (note.type === 'tap') {
            if (note.hit) return;
            const timeTillHit = note.targetTime - currentTimeMs;
            
            const rawProgress = 1.0 - (timeTillHit / travelDuration);
            const progress = Math.max(0, Math.min(1.1, Math.pow(rawProgress, 1.2)));

            if (progress > 0 && progress < 1.1) {
                const currentX = topX + (botX - topX) * progress;
                const currentY = vanishingPoint.y + (hitZoneY - vanishingPoint.y) * progress;
                const currentRadius = 5 + (13 * progress); 

                ctx.fillStyle = "#00ffcc";
                ctx.shadowColor = "#00ffcc";
                ctx.shadowBlur = 10 * progress;
                ctx.beginPath();
                ctx.arc(currentX, currentY, currentRadius, 0, Math.PI * 2);
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
                const headY = Math.min(hitZoneY, vanishingPoint.y + (hitZoneY - vanishingPoint.y) * headProgress);
                const tailY = Math.max(vanishingPoint.y, vanishingPoint.y + (hitZoneY - vanishingPoint.y) * tailProgress);

                const headX = topX + (botX - topX) * headProgress;
                const tailX = topX + (botX - topX) * tailProgress;

                ctx.strokeStyle = note.holding ? "rgba(0, 255, 204, 0.8)" : "rgba(0, 255, 204, 0.4)";
                ctx.lineWidth = note.holding ? 16 : 10;
                ctx.shadowColor = "#00ffcc";
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(headX, headY);
                ctx.stroke();
            }

            if (note.holding && lanePressed[laneIndex]) {
                if (Math.random() < 0.4) {
                    createHitParticles(botX, hitZoneY, "#00ffcc");
                    score += 50;
                    combo++;
                    updateUI();
                }

                if (currentTimeMs >= note.endTime) {
                    note.completed = true;
                    note.holding = false;
                    score += 2000;
                    showJudgement("PERFECT!", "#00ffcc");
                    createHitParticles(botX, hitZoneY, "#00ffcc");
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
