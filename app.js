/* =============================================================
   🔒 Arcatdia Battle Engine v1.2 - Clean & Secure Edition
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

/* -------------------------------------------------------------
   📐 3D 消失點 (Vanishing Point) 設定
   ------------------------------------------------------------- */
const vanishingPoint = { x: 425, y: 50 };
const topLanesX = [350, 400, 450, 500];   
const bottomLanesX = [106, 318, 530, 742]; 
const hitZoneY = 380;                      

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
    for (let i = 0; i < 16; i++) {
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

    const rhythmBlocks = [
        [0], [2], [1], [3],       
        [0, 2],                   
        [1], [3], [0], [2],       
        [1, 3]                    
    ];

    let currentMs = audioOffsetMs;

    for (let i = 0; i < 300; i++) {
        const pattern = rhythmBlocks[i % rhythmBlocks.length];
        pattern.forEach(laneIndex => {
            notes.push({
                lane: laneIndex,
                targetTime: currentMs,
                hit: false
            });
        });
        currentMs += beatMs;
    }
}

for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        laneBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            laneBtn.classList.add('pressed');
            playHiHatHitSound();
            handleTap(i);
        });
        laneBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            laneBtn.classList.remove('pressed');
        });
        laneBtn.addEventListener('mousedown', () => {
            laneBtn.classList.add('pressed');
            playHiHatHitSound();
            handleTap(i);
        });
        laneBtn.addEventListener('mouseup', () => laneBtn.classList.remove('pressed'));
    }
}

function handleTap(laneIndex) {
    if (!isPlaying) return;
    const currentTimeMs = performance.now() - startTime;
    const targetNote = notes.find(n => n.lane === laneIndex && !n.hit);

    if (targetNote) {
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

    for (let i = 0; i < 4; i++) {
        const topX = topLanesX[i];
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
        if (note.hit) return;

        const timeTillHit = note.targetTime - currentTimeMs;
        const progress = 1.0 - (timeTillHit / 1200); 

        if (progress > 0 && progress < 1.1) {
            const laneIndex = note.lane;
            const topX = topLanesX[laneIndex];
            const botX = bottomLanesX[laneIndex];

            const currentX = topX + (botX - topX) * progress;
            const currentY = vanishingPoint.y + (hitZoneY - vanishingPoint.y) * progress;
            const currentRadius = 4 + (14 * progress); 

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
