/* =============================================================
   🔒 Arcatdia Battle Engine - Part 1/4 (A/B/C真濾波矩陣旗艦版)
   ============================================================= */
const canvas = document.getElementById('battleCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let W = window.innerWidth; let H = window.innerHeight;

let bpm = 175;
let isPlaying = false; let isPaused = false;
let score = 0; let combo = 0; let hp = 100;
let notes = []; let particles = []; let stars = []; 
let celestialEvents = [];
let startTime = 0; let pauseStartTime = 0; let totalPausedDuration = 0;
let playbackSpeed = 1.0; let scrollSpeedMultiplier = 1.0; 
let currentMode = 'normal';

let spawnDelayMs = 0; 
let freezeState = 'idle'; 
let freezeCountInTimers = [];

window.goToReadyRoom = function() {
    const ts = document.getElementById('titleScreen');
    const tb = document.getElementById('titleBg');
    const rr = document.getElementById('readyRoom');
    const rb = document.getElementById('readyBg');
    if (ts) ts.classList.remove('active');
    if (tb) tb.classList.remove('active');
    if (rr) rr.classList.add('active');
    if (rb) rb.classList.add('active');
    initAudioEngine();
    renderSectionInputs();
};

let defaultSections = [
    { id: 1,  name: "01.前奏", startBar: 1,   endBar: 22,  useA: true,  useB: false, useC: false },
    { id: 2,  name: "02.主歌A", startBar: 23,  endBar: 54,  useA: true,  useB: true,  useC: false },
    { id: 3,  name: "03.過門",  startBar: 55,  endBar: 70,  useA: true,  useB: false, useC: false },
    { id: 4,  name: "04.副前",  startBar: 71,  endBar: 104, useA: true,  useB: true,  useC: false },
    { id: 5,  name: "05.副歌",  startBar: 105, endBar: 130, useA: true,  useB: true,  useC: true  },
    { id: 6,  name: "06.間奏",  startBar: 0,   endBar: 0,   useA: true,  useB: false, useC: false },
    { id: 7,  name: "07.主歌B", startBar: 0,   endBar: 0,   useA: true,  useB: true,  useC: false },
    { id: 8,  name: "08.副前2", startBar: 0,   endBar: 0,   useA: true,  useB: true,  useC: false },
    { id: 9,  name: "09.副歌2", startBar: 0,   endBar: 0,   useA: true,  useB: true,  useC: true  },
    { id: 10, name: "10.獨奏",  startBar: 0,   endBar: 0,   useA: true,  useB: true,  useC: true  },
    { id: 11, name: "11.橋段",  startBar: 0,   endBar: 0,   useA: false, useB: true,  useC: false },
    { id: 12, name: "12.終副",  startBar: 0,   endBar: 0,   useA: true,  useB: true,  useC: true  },
    { id: 13, name: "13.尾奏",  startBar: 0,   endBar: 0,   useA: true,  useB: false, useC: false },
    { id: 14, name: "14.終局",  startBar: 0,   endBar: 0,   useA: true,  useB: true,  useC: true  }
];

let songSections = [...defaultSections];

function renderSectionInputs() {
    const container = document.getElementById('sectionRowsContainer');
    if (!container) return;
    container.innerHTML = "";
    songSections.forEach((sec, idx) => {
        const row = document.createElement('div');
        row.style.cssText = "display:grid; grid-template-columns: 2fr 1fr 1fr 1.6fr; gap: 3px; align-items:center;";
        
        const startVal = sec.startBar > 0 ? sec.startBar : "";
        const endVal = sec.endBar > 0 ? sec.endBar : "";

        row.innerHTML = `
            <span style="color:#00ffcc; font-size:10px; white-space:nowrap; overflow:hidden;">${sec.name}</span>
            <input type="number" id="secStart_${idx}" value="${startVal}" placeholder="-" style="background:#111; color:#fff; border:1px solid #444; border-radius:3px; padding:2px; text-align:center; font-size:11px; width:100%;">
            <input type="number" id="secEnd_${idx}" value="${endVal}" placeholder="-" style="background:#111; color:#fff; border:1px solid #444; border-radius:3px; padding:2px; text-align:center; font-size:11px; width:100%;">
            <div style="display:flex; gap:2px; justify-content:center;">
                <button type="button" id="btnA_${idx}" onclick="toggleBand(${idx}, 'useA')" style="padding:2px 4px; font-size:9px; border-radius:3px; cursor:pointer; font-weight:bold; border:1px solid ${sec.useA ? '#00ffcc' : '#444'}; background:${sec.useA ? '#00ffcc' : '#222'}; color:${sec.useA ? '#000' : '#888'};">A</button>
                <button type="button" id="btnB_${idx}" onclick="toggleBand(${idx}, 'useB')" style="padding:2px 4px; font-size:9px; border-radius:3px; cursor:pointer; font-weight:bold; border:1px solid ${sec.useB ? '#ffd700' : '#444'}; background:${sec.useB ? '#ffd700' : '#222'}; color:${sec.useB ? '#000' : '#888'};">B</button>
                <button type="button" id="btnC_${idx}" onclick="toggleBand(${idx}, 'useC')" style="padding:2px 4px; font-size:9px; border-radius:3px; cursor:pointer; font-weight:bold; border:1px solid ${sec.useC ? '#ff0077' : '#444'}; background:${sec.useC ? '#ff0077' : '#222'}; color:${sec.useC ? '#fff' : '#888'};">C</button>
            </div>
        `;
        container.appendChild(row);
    });
}

window.toggleBand = function(idx, key) {
    songSections[idx][key] = !songSections[idx][key];
    renderSectionInputs();
};

function loadSavedSongSections() {
    try {
        const savedSec = localStorage.getItem('arcatdia_14_sections');
        if (savedSec) songSections = JSON.parse(savedSec);
        else songSections = [...defaultSections];
    } catch(e) {
        songSections = [...defaultSections];
    }
}

window.saveSongSections = function() {
    try {
        songSections.forEach((sec, idx) => {
            const sInput = document.getElementById(`secStart_${idx}`);
            const eInput = document.getElementById(`secEnd_${idx}`);
            let sVal = sInput && sInput.value.trim() !== "" ? parseInt(sInput.value, 10) : 0;
            let eVal = eInput && eInput.value.trim() !== "" ? parseInt(eInput.value, 10) : 0;
            sec.startBar = isNaN(sVal) ? 0 : sVal;
            sec.endBar = isNaN(eVal) ? 0 : eVal;
        });

        localStorage.setItem('arcatdia_14_sections', JSON.stringify(songSections));
        generateRealFilteredChart();
        alert("✅ 14 間房真·濾波頻段排程已成功鎖定儲存！");
    } catch(err) {
        alert("⚠️ 儲存失敗：" + err.message);
    }
};

window.seekBars = function(deltaBars) {
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4;
    let targetAudioTime = masterAudio.currentTime + (deltaBars * barMs / 1000);
    if (targetAudioTime < 0) targetAudioTime = 0;
    if (masterAudio.duration && targetAudioTime > masterAudio.duration) targetAudioTime = masterAudio.duration - 1;
    masterAudio.currentTime = targetAudioTime;
    const curMs = Math.round(targetAudioTime * 1000);
    const curBar = Math.floor(curMs / barMs) + 1;
    showJudgement(`⏱️ 跳至第 ${curBar} Bar (${curMs} ms)`);
};

window.freezePlay = function() {
    if (freezeState === 'paused') {
        freezeState = 'playing';
        masterAudio.play().catch(()=>{});
        showJudgement("▶ 繼續前進");
        return;
    }

    freezeState = 'idle';
    masterAudio.pause();
    masterAudio.currentTime = 0;
    freezeCountInTimers.forEach(t => clearTimeout(t));
    freezeCountInTimers = [];

    freezeState = 'count-in';
    showJudgement("⏳ 預備...");
    
    const beatMs = (60 / bpm) * 1000;
    [0, 1, 2, 3].forEach(b => {
        freezeCountInTimers.push(setTimeout(() => {
            if (freezeState !== 'count-in') return;
            playStickClick(b === 3 ? 1800 : 1200);
            showJudgement(`${b + 1}`);
        }, b * beatMs));
    });

    freezeCountInTimers.push(setTimeout(() => {
        if (freezeState !== 'count-in') return;
        freezeState = 'playing';
        masterAudio.play().catch(()=>{});
        showJudgement("🎵 MUSIC START!");
    }, 4 * beatMs));
};

window.freezePause = function() {
    if (freezeState !== 'playing') return;
    freezeState = 'paused';
    masterAudio.pause();
    freezeCountInTimers.forEach(t => clearTimeout(t));
    const pausedTime = Math.round(masterAudio.currentTime * 1000);
    showJudgement(`⏸ 停於: ${pausedTime} ms`);
};

let countPerfect = 0; let countGreat = 0; let countGood = 0; let countMiss = 0;
let maxCombo = 0; let isSongEnding = false; let autoReturnTimer = null;

let battleBgOpacity = 1.0;
let preloadedSlideImages = [];
let currentSlideIndex = 0;
let lastSlideChangeTime = 0;
let savedData = { title: null, ready: null, battle: [], opacity: 100 };
let currentPerspectiveMode = 2;

const judgeLineAdjusts = [0, 3, 6, -3];
let judgeLineLevel = 0; 
let freezeManualMs = 0;

function updateFreezeUI() {
    const beatMs = (60 / bpm) * 1000;
    const beats = freezeManualMs / beatMs;
    const sign = freezeManualMs >= 0 ? "+" : "";
    const msDisp = document.getElementById('freezeMsDisplay');
    const beatDisp = document.getElementById('freezeBeatDisplay');
    if (msDisp) msDisp.innerText = `${sign}${freezeManualMs} ms`;
    if (beatDisp) beatDisp.innerText = `(${sign}${beats.toFixed(2)} 拍)`;
}

function stepFreezeMs(delta) {
    freezeManualMs += delta;
    updateFreezeUI();
    generateRealFilteredChart(); 
}

const lanePressed = [false, false, false, false];
const laneTouchStartY = [0, 0, 0, 0];
const laneTouchFlicked = [false, false, false, false];
const laneColors = [
    { main: "#ff0055", glow: "rgba(255, 0, 85, 0.8)" },
    { main: "#ccff00", glow: "rgba(204, 255, 0, 0.8)" },
    { main: "#00ccff", glow: "rgba(0, 204, 255, 0.8)" },
    { main: "#aa00ff", glow: "rgba(170, 0, 255, 0.8)" }
];

function togglePerspectiveMode() { currentPerspectiveMode = currentPerspectiveMode === 1 ? 2 : 1; showJudgement(currentPerspectiveMode === 1 ? "2D 直軌" : "3D 消失點"); }
function toggleJudgeLineLevel() { judgeLineLevel = (judgeLineLevel + 1) % judgeLineAdjusts.length; const qBtn = document.getElementById('btnQuickJudge'); if (qBtn) qBtn.innerText = `📏 線:LV${judgeLineLevel + 1}`; showJudgement(`判定線: LV ${judgeLineLevel + 1}`); }
function handleResize() { W = window.innerWidth; H = window.innerHeight; if (canvas) { canvas.width = W; canvas.height = H; } initStars(); }
window.addEventListener('resize', handleResize); handleResize();

function compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = function() {
        const cvs = document.createElement('canvas'); const MAX = 1080; let w = img.width; let h = img.height;
        if (w > h && w > MAX) { h *= MAX / w; w = MAX; } else if (h > MAX) { h *= MAX / h; h = MAX; }
        cvs.width = w; cvs.height = h; const cCtx = cvs.getContext('2d'); cCtx.drawImage(img, 0, 0, w, h); callback(cvs.toDataURL('image/jpeg', 0.6)); 
    }; img.src = dataUrl;
}

function loadSavedImages() {
    try {
        const saved = localStorage.getItem('arcatdia_save');
        if (saved) {
            savedData = JSON.parse(saved);
            if (savedData.title) { const tb = document.getElementById('titleBg'); if (tb) { tb.style.backgroundImage = `url(${savedData.title})`; } }
            if (savedData.ready) { const rb = document.getElementById('readyBg'); if (rb) { rb.style.backgroundImage = `url(${savedData.ready})`; } }
            if (savedData.battle && savedData.battle.length > 0) { preloadBattleSlides(); }
            if (savedData.opacity !== undefined) { battleBgOpacity = savedData.opacity / 100; const sl = document.getElementById('opacitySlider'); if (sl) sl.value = savedData.opacity; }
        }
    } catch(e) {}
}

function preloadBattleSlides() { preloadedSlideImages = []; savedData.battle.forEach(src => { const img = new Image(); img.src = src; preloadedSlideImages.push(img); }); }
function handleUpload(event, type) {
    const files = event.target.files; if (!files || files.length === 0) return;
    if (type === 'title') {
        const reader = new FileReader(); reader.onload = (e) => { compressImage(e.target.result, (compressed) => { savedData.title = compressed; const tb = document.getElementById('titleBg'); if (tb) { tb.style.backgroundImage = `url(${compressed})`; } showJudgement("封面已換！"); }); }; reader.readAsDataURL(files[0]);
    } else if (type === 'ready') {
        const reader = new FileReader(); reader.onload = (e) => { compressImage(e.target.result, (compressed) => { savedData.ready = compressed; const rb = document.getElementById('readyBg'); if (rb) { rb.style.backgroundImage = `url(${compressed})`; } showJudgement("候機室已換！"); }); }; reader.readAsDataURL(files[0]);
    } else if (type === 'battle') {
        savedData.battle = []; let loadedCount = 0;
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => { compressImage(e.target.result, (compressed) => { savedData.battle.push(compressed); loadedCount++; if (loadedCount === files.length) { preloadBattleSlides(); showJudgement(`已讀入 ${loadedCount} 張戰鬥圖！`); } }); };
            reader.readAsDataURL(file);
        });
    }
}
function updateSlideOpacity(val) { battleBgOpacity = parseFloat(val) / 100; savedData.opacity = parseInt(val, 10); }
function saveSettings() { try { savedData.opacity = Math.round(battleBgOpacity * 100); localStorage.setItem('arcatdia_save', JSON.stringify(savedData)); showJudgement("💾 存檔成功！"); } catch(e) {} }
window.addEventListener('DOMContentLoaded', () => { loadSavedImages(); loadSavedSongSections(); });

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null; let bgmGainNode = null; let sfxGainNode = null; let sfxBuffers = {};
function initAudioEngine() { if (!audioCtx) { audioCtx = new AudioContextClass(); bgmGainNode = audioCtx.createGain(); sfxGainNode = audioCtx.createGain(); bgmGainNode.connect(audioCtx.destination); sfxGainNode.connect(audioCtx.destination); loadSFXFiles(); } if (audioCtx.state === 'suspended') audioCtx.resume(); }
const soundPaths = { tap: "sounds/arcatdia_perfect_tap.wav", flick: "sounds/arcatdia_perfect_flick.wav", hold: "sounds/arcatdia_hold.wav", tick: "sounds/arcatdia_tick.wav", stage: "sounds/arcatdia_stage_tap.wav" };
async function loadSFXFiles() { for (let key in soundPaths) { try { const resp = await fetch(soundPaths[key]); const ab = await resp.arrayBuffer(); audioCtx.decodeAudioData(ab, (buf) => { sfxBuffers[key] = buf; }); } catch(e) { try { const resp2 = await fetch(soundPaths[key].replace('sounds/', '')); const ab2 = await resp2.arrayBuffer(); audioCtx.decodeAudioData(ab2, (buf) => { sfxBuffers[key] = buf; }); } catch(err) {} } } }
function playSFX(key) { if (!audioCtx || !sfxBuffers[key]) return null; try { const src = audioCtx.createBufferSource(); src.buffer = sfxBuffers[key]; src.connect(sfxGainNode); src.start(0); return src; } catch(e) { return null; } }
function updateBgmVolume(val) { if (bgmGainNode) bgmGainNode.gain.value = parseFloat(val); }
function updateSfxVolume(val) { if (sfxGainNode) sfxGainNode.gain.value = parseFloat(val); }

const songUrlA = "https://github.com/Heidiz17/arcatdia/releases/download/V1.0.0/master.wav";
const songUrlB = "https://github.com/Heidiz17/arcatdia/releases/download/v1.0.0/master.wav";

const currentSong = { 
    id: "01", 
    title: "最大の愛", 
    audioUrl: songUrlA, 
    bpm: 175 
};
const masterAudio = new Audio();
masterAudio.preload = "auto";
masterAudio.src = currentSong.audioUrl;

masterAudio.addEventListener('error', () => {
    if (masterAudio.src === songUrlA) {
        masterAudio.src = songUrlB;
        masterAudio.load();
    }
});

function hookMasterAudioNode() {
    if (bgmGainNode) masterAudio.volume = bgmGainNode.gain.value;
}
function playStickClick(freq = 1200) { if (!audioCtx) return; try { const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(freq, audioCtx.currentTime); gain.gain.setValueAtTime(0.8, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04); osc.connect(gain); gain.connect(sfxGainNode); osc.start(); osc.stop(audioCtx.currentTime + 0.04); } catch (e) {} }


/* =============================================================
   🔒 Arcatdia Battle Engine - Part 2/4 (真·三頻離線突變分析)
   ============================================================= */
let customChartLoaded = false;
let customAudioLoaded = false;
let decodedAudioBuffer = null;

// 儲存真·濾波提取出的三大頻段時間點 (ms)
let detectedPeaks = { bandA: [], bandB: [], bandC: [] };

masterAudio.addEventListener('loadedmetadata', async () => {
    if (!customChartLoaded && !decodedAudioBuffer) {
        try {
            const resp = await fetch(masterAudio.src);
            const arrayBuf = await resp.arrayBuffer();
            const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
            decodedAudioBuffer = await tempCtx.decodeAudioData(arrayBuf);
            runOfflineSpectralAnalysis(decodedAudioBuffer);
        } catch(e) {
            generateRealFilteredChart();
        }
    }
});

async function runOfflineSpectralAnalysis(audioBuffer) {
    showJudgement("🔍 背景進行硬體加速真·三頻濾波...");
    detectedPeaks = { bandA: [], bandB: [], bandC: [] };

    try {
        const sr = audioBuffer.sampleRate;
        const totalDuration = audioBuffer.duration;
        
        // 🎯 1. 低通濾波 (Lowpass 120Hz) 抓大鼓 Kick
        const lowCtx = new OfflineAudioContext(1, sr * totalDuration, sr);
        const lowSrc = lowCtx.createBufferSource();
        lowSrc.buffer = audioBuffer;
        const lowFilter = lowCtx.createBiquadFilter();
        lowFilter.type = "lowpass";
        lowFilter.frequency.value = 120;
        lowSrc.connect(lowFilter);
        lowFilter.connect(lowCtx.destination);
        lowSrc.start(0);
        const renderedLow = await lowCtx.startRendering();
        detectedPeaks.bandA = extractOnsetsFromBuffer(renderedLow.getChannelData(0), sr, 0.55, 200);

        // 🎯 2. 帶通濾波 (Bandpass 2500Hz) 抓人聲/結他
        const midCtx = new OfflineAudioContext(1, sr * totalDuration, sr);
        const midSrc = midCtx.createBufferSource();
        midSrc.buffer = audioBuffer;
        const midFilter = midCtx.createBiquadFilter();
        midFilter.type = "bandpass";
        midFilter.frequency.value = 2500;
        midFilter.Q.value = 1.0;
        midSrc.connect(midFilter);
        midFilter.connect(midCtx.destination);
        midSrc.start(0);
        const renderedMid = await midCtx.startRendering();
        detectedPeaks.bandB = extractOnsetsFromBuffer(renderedMid.getChannelData(0), sr, 0.45, 140);

        // 🎯 3. 高通濾波 (Highpass 7500Hz) 抓碎鈸/金屬
        const highCtx = new OfflineAudioContext(1, sr * totalDuration, sr);
        const highSrc = highCtx.createBufferSource();
        highSrc.buffer = audioBuffer;
        const highFilter = highCtx.createBiquadFilter();
        highFilter.type = "highpass";
        highFilter.frequency.value = 7500;
        highSrc.connect(highFilter);
        highFilter.connect(highCtx.destination);
        highSrc.start(0);
        const renderedHigh = await highCtx.startRendering();
        detectedPeaks.bandC = extractOnsetsFromBuffer(renderedHigh.getChannelData(0), sr, 0.40, 180);

        showJudgement(`🎯 濾波成功！A:${detectedPeaks.bandA.length} B:${detectedPeaks.bandB.length} C:${detectedPeaks.bandC.length}`);
    } catch(err) {
        showJudgement("⚠️ 濾波降級，採用格點模式");
    }
    generateRealFilteredChart();
}

// 實時動態突變能量提取演算法 (Onset Energy Flux Peak Picker)
function extractOnsetsFromBuffer(channelData, sampleRate, thresholdRatio, minIntervalMs) {
    const step = Math.floor(sampleRate / 100); // 10ms 窗口
    const energies = [];
    let maxE = 0;
    for (let i = 0; i < channelData.length; i += step) {
        let sum = 0;
        for (let j = 0; j < step && (i + j) < channelData.length; j++) {
            sum += Math.abs(channelData[i + j]);
        }
        if (sum > maxE) maxE = sum;
        energies.push(sum);
    }

    const threshold = maxE * thresholdRatio;
    const minStepGap = Math.floor(minIntervalMs / 10);
    const peaksMs = [];

    for (let i = 2; i < energies.length - 2; i++) {
        if (energies[i] > threshold &&
            energies[i] > energies[i - 1] &&
            energies[i] > energies[i - 2] &&
            energies[i] >= energies[i + 1] &&
            energies[i] >= energies[i + 2]) {
            peaksMs.push(Math.round(i * 10)); // 轉成毫秒
            i += minStepGap; // 避開連續重疊
        }
    }
    return peaksMs;
}

function getSectionForBar(barNum) {
    for (let sec of songSections) {
        if (sec.startBar > 0 && sec.endBar >= sec.startBar) {
            if (barNum >= sec.startBar && barNum <= sec.endBar) {
                return sec;
            }
        }
    }
    return null;
}

// 🎯 真·A/B/C 三頻矩陣時間表融合出波
function generateRealFilteredChart() {
    if (customChartLoaded && notes.length > 0) {
        notes.forEach(n => { n.hit = false; n.holding = false; });
        return;
    }

    notes = [];
    particles = [];
    const beatMs = (60 / bpm) * 1000;
    const barMs = beatMs * 4;
    
    let songTotalMs = 180000;
    if (masterAudio.duration && !isNaN(masterAudio.duration) && masterAudio.duration > 5) {
        songTotalMs = masterAudio.duration * 1000;
    }

    const hasRealData = (detectedPeaks.bandA.length + detectedPeaks.bandB.length + detectedPeaks.bandC.length) > 0;

    if (currentMode === 'test' || currentMode === 'freeze') {
        let t = (8 * beatMs) + freezeManualMs;
        while (t < songTotalMs - 2000) {
            notes.push({ type: 'tap', lane: 0, targetTime: t, hit: false });
            t += barMs;
        }
        notes.sort((a, b) => a.targetTime - b.targetTime);
        return;
    }

    let candidateNotes = [];
    let lastLane = 0;

    if (hasRealData) {
        // 🔥 真正聽歌：用波形真實時間戳
        songSections.forEach(sec => {
            if (sec.startBar <= 0 || sec.endBar < sec.startBar) return;
            const startMs = (sec.startBar - 1) * barMs + freezeManualMs;
            const endMs = sec.endBar * barMs + freezeManualMs;

            if (sec.useA) {
                detectedPeaks.bandA.forEach(t => {
                    const realT = t + freezeManualMs;
                    if (realT >= startMs && realT <= endMs) {
                        lastLane = (lastLane + 1) % 4;
                        candidateNotes.push({ type: 'tap', lane: lastLane, targetTime: realT, hit: false });
                    }
                });
            }

            if (sec.useB) {
                detectedPeaks.bandB.forEach(t => {
                    const realT = t + freezeManualMs;
                    if (realT >= startMs && realT <= endMs) {
                        lastLane = (lastLane + 2) % 4;
                        candidateNotes.push({ type: 'tap', lane: lastLane, targetTime: realT, hit: false });
                    }
                });
            }

            if (sec.useC) {
                detectedPeaks.bandC.forEach(t => {
                    const realT = t + freezeManualMs;
                    if (realT >= startMs && realT <= endMs) {
                        lastLane = (lastLane + 3) % 4;
                        const r = Math.random();
                        if (r < 0.6) {
                            candidateNotes.push({ type: 'flick', lane: lastLane, targetTime: realT, hit: false });
                        } else {
                            candidateNotes.push({ type: 'hold', lane: lastLane, targetTime: realT, duration: beatMs * 1.5, hit: false, holding: false, lastTick: 0 });
                        }
                    }
                });
            }
        });
    } else {
        // 降級備份：按房間密度組合
        let t = (8 * beatMs) + freezeManualMs;
        while (t < songTotalMs - 2000) {
            const curBar = Math.floor(t / barMs) + 1;
            const curSec = getSectionForBar(curBar);
            if (!curSec) { t += barMs; continue; }
            lastLane = (lastLane + 1) % 4;
            if (curSec.useA && !curSec.useB && !curSec.useC) {
                candidateNotes.push({ type: 'tap', lane: lastLane, targetTime: t, hit: false });
                t += (beatMs * 2);
            } else if (curSec.useA && curSec.useB && !curSec.useC) {
                candidateNotes.push({ type: 'tap', lane: lastLane, targetTime: t, hit: false });
                t += beatMs;
            } else {
                candidateNotes.push({ type: 'tap', lane: lastLane, targetTime: t, hit: false });
                t += (beatMs * 0.5);
            }
        }
    }

    // 智能去重：同一軌道 100ms 內唔重疊
    candidateNotes.sort((a, b) => a.targetTime - b.targetTime);
    const filtered = [];
    const lastTimeByLane = [-9999, -9999, -9999, -9999];

    candidateNotes.forEach(n => {
        if (n.targetTime - lastTimeByLane[n.lane] >= 90) {
            filtered.push(n);
            lastTimeByLane[n.lane] = n.targetTime;
        }
    });

    notes = filtered;
}

function generateChart() {
    generateRealFilteredChart();
}

async function handleAudioFileForBPM(audioFile) {
    const match = audioFile.name.match(/(\d{2,3})\s*BPM/i);
    if (match) {
        bpm = parseInt(match[1], 10);
        document.getElementById('manualBpmInput').value = bpm;
        showJudgement(`檔名鎖定: ${bpm} BPM`);
        updateFreezeUI();
    }
    try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        decodedAudioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
        runOfflineSpectralAnalysis(decodedAudioBuffer);
    } catch(e) {
        generateRealFilteredChart();
    }
}

function initReadyRoomDrawer() {
    const toggleBtn = document.getElementById('toggleDrawerBtn');
    const drawer = document.getElementById('readyRoomDrawer');
    if (toggleBtn && drawer) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = drawer.style.display === 'none';
            drawer.style.display = isHidden ? 'flex' : 'none';
            toggleBtn.innerHTML = isHidden ? '⚙️ 關閉工具箱 ▲' : '⚙️ 整備工具箱 (入歌/改BPM/14房排程) ▼';
        });
    }

    const bpmInput = document.getElementById('manualBpmInput');
    if (bpmInput) {
        bpmInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (val > 0) {
                bpm = val;
                showJudgement(`手動更改: ${bpm} BPM`);
                updateFreezeUI();
                if (!customChartLoaded) generateRealFilteredChart();
            }
        });
    }

    const wavIn = document.getElementById('dualWavInput');
    const midiIn = document.getElementById('dualMidiInput');

    if (wavIn) {
        wavIn.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            masterAudio.src = URL.createObjectURL(file);
            customAudioLoaded = true;
            const st = document.getElementById('wavStatus');
            if (st) { st.innerText = `WAV 就緒: ${file.name}`; st.style.color = "#00ffcc"; }
            handleAudioFileForBPM(file);
        });
    }

    if (midiIn) {
        midiIn.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    try {
                        const chartData = JSON.parse(evt.target.result);
                        notes = chartData.map((item, idx) => ({ 
                            id: idx, 
                            type: item.type || 'tap', 
                            lane: item.lane !== undefined ? item.lane : (idx % 4), 
                            targetTime: item.time || item.targetTime, 
                            duration: item.duration || 0, 
                            hit: false, 
                            holding: false, 
                            lastTick: 0 
                        }));
                        notes.sort((a, b) => a.targetTime - b.targetTime);
                        customChartLoaded = true;
                        const st = document.getElementById('midiStatus');
                        if (st) { st.innerText = `JSON 譜面 (${notes.length}音)`; st.style.color = "#ff0077"; }
                        showJudgement(`地圖已就緒: ${notes.length} 音符！`);
                    } catch(err) { showJudgement("⚠️ 譜面格式錯誤"); }
                };
                reader.readAsText(file);
                return;
            }

            try {
                showJudgement("🔍 正在拆解 MIDI 多音軌...");
                const arrayBuffer = await file.arrayBuffer();
                if (typeof Midi === "undefined") { showJudgement("⚠️ 請確認 HTML 已載入 Tonejs/Midi 庫"); return; }
                const midiData = new Midi(arrayBuffer);
                showTrackSelectorModal(midiData);
            } catch(err) { showJudgement("⚠️ MIDI 解析失敗"); }
        });
    }
}
window.addEventListener('DOMContentLoaded', initReadyRoomDrawer);

function showTrackSelectorModal(midi) {
    let modal = document.getElementById('midiTrackModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'midiTrackModal';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 999999; background: rgba(10, 15, 30, 0.98);
            border: 2px solid #00f0ff; border-radius: 12px; padding: 16px; max-width: 320px; width: 88%;
            box-shadow: 0 0 25px rgba(0, 240, 255, 0.5); font-family: sans-serif;
        `;
        document.body.appendChild(modal);
    }
    let trackHtml = `<div style="color:#00f0ff;font-size:14px;font-weight:bold;margin-bottom:12px;text-align:center;">🎵 揀一條音軌（如 Vocal/結他）</div><div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">`;
    midi.tracks.forEach((track, index) => {
        if (track.notes.length > 0) {
            const trackName = track.name || `音軌 ${index + 1} (${track.instrument.name || 'Instrument'})`;
            trackHtml += `<button onclick="selectMidiTrack(${index})" style="background:rgba(255,255,255,0.08);border:1px solid #ff0077;color:#fff;padding:8px;border-radius:6px;text-align:left;cursor:pointer;font-size:12px;"><b>${trackName}</b> <br><span style="color:#aaa;font-size:11px;">共 ${track.notes.length} 粒音</span></button>`;
        }
    });
    trackHtml += `</div><button onclick="document.getElementById('midiTrackModal').style.display='none'" style="margin-top:12px;width:100%;padding:6px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;">關閉</button>`;
    modal.innerHTML = trackHtml;
    modal.style.display = 'block';

    window.selectMidiTrack = function(trackIndex) {
        const chosenTrack = midi.tracks[trackIndex];
        notes = chosenTrack.notes.map((n, idx) => {
            const timeMs = n.time * 1000;
            const lane = Math.min(3, Math.max(0, Math.floor(((n.midi - 40) / 40) * 4)));
            return { id: idx, type: (n.duration * 1000) > 350 ? 'hold' : 'tap', lane: lane, targetTime: timeMs, duration: n.duration * 1000, hit: false, holding: false, lastTick: 0 };
        });
        notes.sort((a, b) => a.targetTime - b.targetTime);
        customChartLoaded = true;
        modal.style.display = 'none';
        const st = document.getElementById('midiStatus');
        if (st) { st.innerText = `自選音軌 (${notes.length}音)`; st.style.color = "#ff0077"; }
        showJudgement(`🎯 成功載入！共 ${notes.length} 粒光豆`);
    };
}


/* =============================================================
   🔒 Arcatdia Battle Engine - Part 3/4 (原裝航行與觸控判定)
   ============================================================= */
function initStars() { stars = []; for (let i = 0; i < 80; i++) { stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 2 + 1, speed: Math.random() * 1.5 + 0.5, alpha: Math.random() }); } }
function initCelestialJourney() { celestialEvents = [ { timeSec: 2, duration: 8, planets: [{ name: "🌍 地球起航", color: "rgba(0, 160, 255, 0.32)", radius: 65, xRatio: 0.72, yRatio: 0.20 }] }, { timeSec: 25, duration: 8, planets: [{ name: "🌟 啟明星・金星", color: "rgba(255, 205, 80, 0.32)", radius: 60, xRatio: 0.70, yRatio: 0.22 }] }, { timeSec: 52, duration: 11, planets: [ { name: "🪐 木星風暴", color: "rgba(235, 140, 60, 0.32)", radius: 78, xRatio: 0.60, yRatio: 0.18 }, { name: "🪐 土星光環", color: "rgba(240, 210, 140, 0.32)", radius: 55, xRatio: 0.82, yRatio: 0.26, hasRing: true } ]}, { timeSec: 148, duration: 12, planets: [{ name: "🌌 阿卡迪亞星雲", color: "rgba(180, 60, 255, 0.35)", radius: 95, xRatio: 0.70, yRatio: 0.18 }] } ]; }

function returnToTitle() { document.getElementById('readyRoom').classList.remove('active'); document.getElementById('readyBg').classList.remove('active'); document.getElementById('titleScreen').classList.add('active'); const tb = document.getElementById('titleBg'); if (tb) { tb.classList.add('active'); } }
function returnToReadyRoom() { 
    document.getElementById('pauseMenu').classList.remove('active'); 
    document.getElementById('battleHud').style.display = 'none'; 
    document.getElementById('touchController').style.display = 'none'; 
    const tuner = document.getElementById('freezeTuner'); if (tuner) tuner.style.display = 'none';
    const barHud = document.getElementById('barInspectorHUD'); if (barHud) barHud.style.display = 'none';
    const rb = document.getElementById('readyBg'); if (rb) { rb.classList.add('active'); } 
    document.getElementById('readyRoom').classList.add('active'); 
    isPaused = false; isPlaying = false; freezeState = 'idle'; masterAudio.pause(); masterAudio.currentTime = 0; clearAllTimers(); ctx.clearRect(0, 0, W, H); 
}

function startVoyage() { 
    document.getElementById('readyRoom').classList.remove('active'); 
    const rb = document.getElementById('readyBg'); if (rb) { rb.classList.remove('active'); }
    const tb = document.getElementById('titleBg'); if (tb) { tb.classList.remove('active'); }

    const coverBox = document.getElementById('introCoverBox');
    if (coverBox) {
        if (savedData.title) coverBox.style.backgroundImage = `url(${savedData.title})`;
        else if (savedData.battle && savedData.battle.length > 0) coverBox.style.backgroundImage = `url(${savedData.battle[0]})`;
        else coverBox.style.background = 'radial-gradient(circle, #ff0077, #03040a)';
    }
    const diffText = document.getElementById('introDifficultyText');
    if (diffText) diffText.innerText = `DIFFICULTY: ${currentMode.toUpperCase()}`;
    const intro = document.getElementById('introScreen');
    intro.classList.add('active');
    const readyTxt = document.getElementById('introReadyText');
    if (readyTxt) readyTxt.innerText = "READY...";

    setTimeout(() => {
        if (readyTxt) readyTxt.innerText = "GO!";
        setTimeout(() => { intro.classList.remove('active'); beginRealBattle(); }, 400);
    }, 1600);
}

function beginRealBattle() {
    document.getElementById('battleHud').style.display = 'flex'; 
    document.getElementById('touchController').style.display = 'flex'; 

    const tuner = document.getElementById('freezeTuner');
    const barHud = document.getElementById('barInspectorHUD');

    if (currentMode === 'test' || currentMode === 'freeze') {
        if (barHud) barHud.style.display = 'block';
    } else {
        if (barHud) barHud.style.display = 'none';
    }

    if (currentMode === 'freeze') {
        if (tuner) { tuner.style.display = 'block'; updateFreezeUI(); freezeState = 'idle'; }
    } else {
        if (tuner) tuner.style.display = 'none';
    }

    score = 0; combo = 0; maxCombo = 0; hp = 100; totalPausedDuration = 0; 
    countPerfect = 0; countGreat = 0; countGood = 0; countMiss = 0; isSongEnding = false;
    hookMasterAudioNode(); updateUI(); initStars(); initCelestialJourney(); generateChart(); 
    isPlaying = true; isPaused = false; startTime = performance.now(); lastSlideChangeTime = performance.now(); 

    if (currentMode !== 'freeze') {
        scheduleCountInAndPlay();
    }
    requestAnimationFrame(gameLoop); 
}

function selectDifficulty(mode) { 
    currentMode = mode; 
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active')); 
    if (mode === 'easy') document.getElementById('btnDiffEasy').classList.add('active'); 
    if (mode === 'normal') document.getElementById('btnDiffNormal').classList.add('active'); 
    if (mode === 'test') document.getElementById('btnDiffTest').classList.add('active'); 
    if (mode === 'freeze') document.getElementById('btnDiffFreeze').classList.add('active'); 
}

function pauseGame() { if (!isPlaying || isPaused) return; isPaused = true; pauseStartTime = performance.now(); masterAudio.pause(); clearAllTimers(); document.getElementById('pauseMenu').classList.add('active'); }
function resumeGame() { if (!isPaused) return; document.getElementById('pauseMenu').classList.remove('active'); totalPausedDuration += (performance.now() - pauseStartTime); isPaused = false; if (currentMode !== 'freeze') masterAudio.play().catch(()=>{}); requestAnimationFrame(gameLoop); }
function restartFromPause() { document.getElementById('pauseMenu').classList.remove('active'); isPaused = false; startVoyage(); }

function createHitParticles(x, y, color) { 
    if (particles.length > 30) particles.splice(0, 10); 
    for (let i = 0; i < 8; i++) { 
        const angle = Math.random() * Math.PI * 2; 
        const speed = Math.random() * 6 + 2; 
        particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 4 + 2, color: color, alpha: 1.0 }); 
    } 
}

for (let i = 0; i < 4; i++) {
    const laneBtn = document.getElementById(`lane${i}`);
    if (laneBtn) {
        laneBtn.addEventListener('touchstart', (e) => { e.preventDefault(); laneBtn.classList.add('pressed'); lanePressed[i] = true; laneTouchFlicked[i] = false; laneTouchStartY[i] = e.touches[0].clientY; handleAction(i, 'down'); }, { passive: false });
        laneBtn.addEventListener('touchmove', (e) => { const currentY = e.touches[0].clientY; if (!laneTouchFlicked[i] && (laneTouchStartY[i] - currentY > 18)) { laneTouchFlicked[i] = true; handleAction(i, 'flick'); } });
        laneBtn.addEventListener('touchend', (e) => { e.preventDefault(); laneBtn.classList.remove('pressed'); lanePressed[i] = false; handleAction(i, 'up'); }, { passive: false });
        laneBtn.addEventListener('mousedown', (e) => { laneBtn.classList.add('pressed'); lanePressed[i] = true; handleAction(i, 'down'); });
        laneBtn.addEventListener('mouseup', () => { laneBtn.classList.remove('pressed'); lanePressed[i] = false; handleAction(i, 'up'); });
    }
}

let activeHoldAudioSources = [null, null, null, null];

function getGeometry() {
    const radius = 28; 
    const circleCenterY = H - 165; 
    const circleTopY = circleCenterY - radius; 
    const hitY = circleTopY - 1.5 - judgeLineAdjusts[judgeLineLevel];
    return { radius, circleCenterY, hitY };
}

function handleAction(laneIndex, actionType) {
    if (!isPlaying || isPaused || currentMode === 'freeze') return;
    const currentTimeMs = (performance.now() - startTime - totalPausedDuration) * playbackSpeed;
    const { hitY } = getGeometry();
    const laneW = W / 4; const targetX = laneW * laneIndex + (laneW / 2);

    if (actionType === 'down') {
        const targetNote = notes.find(n => n.lane === laneIndex && !n.hit && Math.abs(currentTimeMs - n.targetTime) < 160);
        if (targetNote) {
            const diff = Math.abs(currentTimeMs - targetNote.targetTime);
            if (targetNote.type === 'tap') { 
                targetNote.hit = true; 
                if (diff <= 50) { score += 1000; countPerfect++; showJudgement("PERFECT!"); } 
                else if (diff <= 100) { score += 700; countGreat++; showJudgement("GREAT!"); } 
                else { score += 300; countGood++; showJudgement("GOOD"); }
                combo++; if (combo > maxCombo) maxCombo = combo; hp = Math.min(100, hp + 2); playSFX('tap'); createHitParticles(targetX, hitY, "#ffffff"); updateUI(); 
            } else if (targetNote.type === 'hold') { 
                targetNote.holding = true; targetNote.lastTick = currentTimeMs; activeHoldAudioSources[laneIndex] = playSFX('hold'); showJudgement("HOLD!"); createHitParticles(targetX, hitY, laneColors[laneIndex].main); updateUI(); 
            } else if (targetNote.type === 'flick') { showJudgement("FLICK UP!"); }
        } else { playSFX('stage'); createHitParticles(targetX, hitY, "rgba(0, 255, 204, 0.45)"); }
    } else if (actionType === 'flick') {
        const flickNote = notes.find(n => n.lane === laneIndex && !n.hit && n.type === 'flick' && Math.abs(currentTimeMs - n.targetTime) < 180);
        if (flickNote) { flickNote.hit = true; score += 1000; countPerfect++; combo++; if (combo > maxCombo) maxCombo = combo; hp = Math.min(100, hp + 3); playSFX('flick'); showJudgement("FLICK!!"); createHitParticles(targetX, hitY, "#ff0077"); updateUI(); }
    } else if (actionType === 'up') {
        const holdingNote = notes.find(n => n.lane === laneIndex && n.type === 'hold' && n.holding && !n.hit);
        if (holdingNote) { holdingNote.holding = false; holdingNote.hit = true; score += 500; updateUI(); }
        if (activeHoldAudioSources[laneIndex]) { try { activeHoldAudioSources[laneIndex].stop(); } catch(e) {} activeHoldAudioSources[laneIndex] = null; }
    }
}

function updateUI() {
    const scoreVal = document.getElementById('scoreVal'); if (scoreVal) scoreVal.innerText = String(score).padStart(6, '0');
    const hpFill = document.getElementById('hpFill');
    if (hpFill) { hpFill.style.width = `${hp}%`; hpFill.className = 'hp-fill'; if (hp <= 25) hpFill.classList.add('lvl-c'); else if (hp <= 60) hpFill.classList.add('lvl-b'); else if (hp <= 85) hpFill.classList.add('lvl-a'); else hpFill.classList.add('lvl-s'); }
    const comboDisp = document.getElementById('comboDisplay'); if (comboDisp && combo > 1) { comboDisp.innerText = `${combo} COMBO`; comboDisp.style.opacity = '1'; }
}

function showJudgement(text) { const disp = document.getElementById('judgementDisplay'); if (disp) { disp.innerText = text; disp.style.opacity = '1'; setTimeout(() => { disp.style.opacity = '0'; }, 280); } }

let countInTimers = []; let audioStartTimer = null;
function clearAllTimers() { countInTimers.forEach(t => clearTimeout(t)); countInTimers = []; if (audioStartTimer) { clearTimeout(audioStartTimer); audioStartTimer = null; } }
function scheduleCountInAndPlay() {
    clearAllTimers(); const beatMs = (60 / bpm) * 1000;
    [0, 1, 2, 3].forEach(b => { countInTimers.push(setTimeout(() => { if (!isPlaying || isPaused) return; playStickClick(b === 3 ? 1800 : 1200); showJudgement(`${b + 1}`); }, (b * beatMs) / playbackSpeed)); });
    audioStartTimer = setTimeout(() => { if (!isPlaying || isPaused) return; masterAudio.playbackRate = playbackSpeed; masterAudio.currentTime = 0; masterAudio.play().catch(() => {}); }, (beatMs * 4) / playbackSpeed);
}


/* =============================================================
   🔒 Arcatdia Battle Engine - Part 4/4 (雙向計時與威威結算)
   ============================================================= */
function gameLoop() {
    if (!isPlaying || isPaused) return;
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();  
    const currentTimeMs = (now - startTime - totalPausedDuration) * playbackSpeed; 
    const currentSec = currentTimeMs / 1000;

    const beatMs = (60 / bpm) * 1000; 
    const barMs = beatMs * 4;

    const hudBar = document.getElementById('hudBarDisplay');
    const hudMs = document.getElementById('hudMsDisplay');
    if (hudBar && hudMs) {
        const audioCurMs = Math.round(masterAudio.currentTime * 1000);
        const curBar = Math.floor(audioCurMs / barMs) + 1;
        const curBeatInBar = Math.floor((audioCurMs % barMs) / beatMs) + 1;
        const curSec = getSectionForBar(curBar);
        const curBands = curSec ? `[${curSec.useA ? 'A' : ''}${curSec.useB ? 'B' : ''}${curSec.useC ? 'C' : ''}]` : "[跳過]";
        hudBar.innerText = `BAR: ${curBar} (第 ${curBeatInBar} 拍) ${curBands}`;
        hudMs.innerText = `音樂絕對時間: ${audioCurMs} ms`;
    }

    if (preloadedSlideImages.length > 0) {
        if (now - lastSlideChangeTime > 8000) { currentSlideIndex = (currentSlideIndex + 1) % preloadedSlideImages.length; lastSlideChangeTime = now; }
        const curImg = preloadedSlideImages[currentSlideIndex];
        if (curImg && curImg.complete) {
            ctx.save(); ctx.globalAlpha = battleBgOpacity; const imgRatio = curImg.width / curImg.height; const screenRatio = W / H; let dw, dh, dx, dy;
            if (screenRatio > imgRatio) { dw = W; dh = W / imgRatio; dx = 0; dy = (H - dh) / 2; } else { dh = H; dw = H * imgRatio; dx = (W - dw) / 2; dy = 0; }
            ctx.drawImage(curImg, dx, dy, dw, dh); ctx.restore();
        }
    }

    stars.forEach(s => { ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill(); s.y += s.speed * 1.5; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });

    celestialEvents.forEach(evt => {
        if (currentSec >= evt.timeSec && currentSec <= evt.timeSec + evt.duration) {
            const progress = (currentSec - evt.timeSec) / evt.duration; const alpha = Math.sin(progress * Math.PI) * 0.40;
            evt.planets.forEach(p => {
                ctx.save(); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 45;
                const px = W * p.xRatio - (progress * 40); const py = H * p.yRatio + (progress * 30);
                ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2); ctx.fill();
                if (p.hasRing) { ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35); ctx.strokeStyle = "rgba(240, 220, 160, 0.55)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.8})`; ctx.font = "bold 13px sans-serif"; ctx.fillText(p.name, px - 40, py + p.radius + 20); ctx.restore();
            });
        }
    });

    const { radius, circleCenterY, hitY } = getGeometry();
    const startY = 40; const laneW = W / 4;
    const botX = [laneW * 0.5, laneW * 1.5, laneW * 2.5, laneW * 3.5]; const topX = (currentPerspectiveMode === 1) ? botX : [W * 0.44, W * 0.48, W * 0.52, W * 0.56];

    for (let i = 0; i < 4; i++) {  
        ctx.strokeStyle = laneColors[i].glow; ctx.lineWidth = 2; 
        ctx.beginPath(); ctx.moveTo(topX[i], startY); ctx.lineTo(botX[i], hitY); ctx.stroke(); 
    }

    ctx.save(); ctx.strokeStyle = "rgba(0, 255, 204, 0.9)"; ctx.lineWidth = 3; ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke(); ctx.restore();

    for (let i = 0; i < 4; i++) { 
        ctx.fillStyle = laneColors[i].main; 
        ctx.beginPath(); 
        ctx.arc(botX[i], circleCenterY, radius, 0, Math.PI * 2); 
        ctx.fill(); 
    }

    const tDur = (beatMs * 4) / scrollSpeedMultiplier; 
    const playTimeMs = currentTimeMs - (beatMs * 4);

    if (playTimeMs >= -20) {
        const cycleMs = (beatMs * 4);
        const phase = ((playTimeMs % cycleMs) + cycleMs) % cycleMs;
        if (phase < 120 || phase > (cycleMs - 20)) {
            const progress = phase < 120 ? (phase / 120) : 0;
            const alpha = 1.0 - progress;
            ctx.save();
            ctx.fillStyle = `rgba(0, 255, 204, ${alpha})`;
            ctx.shadowColor = "#00ffcc";
            ctx.shadowBlur = 30 * alpha;
            ctx.beginPath();
            ctx.arc(botX[0], hitY, radius * (0.8 + alpha * 0.4), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    if (currentMode === 'freeze') {
        const lane = 0;
        let p = 1.0; 

        if (freezeState === 'count-in') {
            p = -1; 
        } else if (freezeState === 'playing' || freezeState === 'paused') {
            const elapsed = masterAudio.currentTime * 1000; 
            const diff = elapsed - (freezeManualMs - tDur);
            p = ((diff % tDur) + tDur) % tDur / tDur;
        } else {
            p = 1.0; 
        }

        if (p >= 0) {
            const cx = topX[lane] + (botX[lane] - topX[lane]) * p;
            const cy = startY + (hitY - startY) * p;

            ctx.save();
            ctx.fillStyle = laneColors[lane].main;
            ctx.shadowColor = laneColors[lane].main;
            ctx.shadowBlur = 24;
            ctx.beginPath();
            if (currentPerspectiveMode === 1) { ctx.ellipse(cx, cy, 26, 32, 0, 0, Math.PI * 2); } 
            else { 
                const rx = (10 * (1.0 - p)) + (28 * p);  
                const ry = (32 * (1.0 - p)) + (14 * p);  
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); 
            }
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(botX[0], hitY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        requestAnimationFrame(gameLoop);
        return;
    }

    if (currentMode === 'test') {
        if (playTimeMs >= 0) {
            const currentBeatPhase = playTimeMs % beatMs;
            if (currentBeatPhase <= 70 || currentBeatPhase >= (beatMs - 70)) {
                ctx.save();
                ctx.strokeStyle = "rgba(255, 215, 0, 0.95)";
                ctx.lineWidth = 5;
                ctx.shadowColor = "#ffd700";
                ctx.shadowBlur = 30;
                ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke();
                ctx.restore();
            }
        }
    }

    notes.forEach(n => {
        if (n.hit) return;
        const effectiveDur = tDur - spawnDelayMs;
        const timeRemaining = n.targetTime - currentTimeMs;
        const p = 1.0 - (timeRemaining / effectiveDur);
        if (p < 0) return;

        if (n.type === 'hold') {
            const endP = 1.0 - (((n.targetTime + n.duration) - currentTimeMs) / effectiveDur);
            if (n.holding) {
                if (currentTimeMs - n.lastTick >= 120) { n.lastTick = currentTimeMs; playSFX('tick'); score += 150; combo++; updateUI(); createHitParticles(botX[n.lane], hitY, laneColors[n.lane].main); }
                if (currentTimeMs >= n.targetTime + n.duration) { n.hit = true; n.holding = false; score += 600; countPerfect++; combo++; if (combo > maxCombo) maxCombo = combo; hp = Math.min(100, hp + 3); playSFX('tap'); showJudgement("PERFECT!"); updateUI(); }
            }
            if (p >= 0 && endP <= 1.0) {
                const headY = startY + (hitY - startY) * Math.min(1.0, Math.max(0, p)); 
                const tailY = startY + (hitY - startY) * Math.min(1.0, Math.max(0, endP));
                const hx = topX[n.lane] + (botX[n.lane] - topX[n.lane]) * Math.min(1.0, Math.max(0, p)); 
                const tx = topX[n.lane] + (botX[n.lane] - topX[n.lane]) * Math.min(1.0, Math.max(0, endP));
                ctx.save(); ctx.strokeStyle = n.holding ? "#ffffff" : laneColors[n.lane].glow; ctx.lineWidth = n.holding ? 28 : 20; ctx.beginPath(); ctx.moveTo(hx, headY); ctx.lineTo(tx, tailY); ctx.stroke(); ctx.restore();
            }
            if (p > 1.0 && !n.holding && !n.hit) { n.hit = true; combo = 0; countMiss++; hp = Math.max(0, hp - 5); showJudgement("MISS"); updateUI(); }
        } else {
            if (p >= 0 && p <= 1.0) {
                const cx = topX[n.lane] + (botX[laneNum(n.lane)] - topX[n.lane]) * p; 
                const cy = startY + (hitY - startY) * p;
                ctx.save();
                if (p < 0.08) ctx.globalAlpha = p / 0.08;

                if (n.type === 'flick') {
                    const scale = (14 * (1.0 - p)) + (28 * p);
                    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.shadowBlur = 22 * p;
                    const w1 = scale * 0.85; const d1 = scale * 0.65; const y1 = cy + scale * 0.22;
                    ctx.strokeStyle = "#ffffff"; ctx.shadowColor = "#ffffff"; ctx.lineWidth = 3.5;
                    ctx.beginPath(); ctx.moveTo(cx - w1, y1 - d1); ctx.lineTo(cx, y1); ctx.lineTo(cx + w1, y1 - d1); ctx.stroke();
                    const w2 = scale * 1.25; const d2 = scale * 0.75; const y2 = cy - scale * 0.25;
                    ctx.strokeStyle = "#ff0077"; ctx.shadowColor = "#ff00aa"; ctx.lineWidth = 4.5;
                    ctx.beginPath(); ctx.moveTo(cx - w2, y2 - d2); ctx.lineTo(cx, y2); ctx.lineTo(cx + w2, y2 - d2); ctx.stroke();
                    ctx.restore();
                } else {
                    ctx.fillStyle = laneColors[n.lane].main; ctx.shadowColor = laneColors[n.lane].main; ctx.shadowBlur = 22 * p;
                    ctx.beginPath();
                    if (currentPerspectiveMode === 1) { ctx.ellipse(cx, cy, 26, 32, 0, 0, Math.PI * 2); } 
                    else { const rx = (10 * (1.0 - p)) + (28 * p); const ry = (32 * (1.0 - p)) + (14 * p); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
                }
                ctx.restore();
            }
            if (currentTimeMs - n.targetTime > 150 && !n.hit) { n.hit = true; combo = 0; countMiss++; hp = Math.max(0, hp - 5); showJudgement("MISS"); updateUI(); }
        }
    });

    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); p.x += p.vx; p.y += p.vy; p.alpha -= 0.05; if (p.alpha <= 0) particles.splice(i, 1); }
    const allNotesFinished = notes.length > 0 && notes.every(n => n.hit);
    if ((allNotesFinished || masterAudio.ended) && !isSongEnding && currentTimeMs > 5000) {
        isSongEnding = true; setTimeout(() => { triggerSongClear(); }, 1200);
    }
    requestAnimationFrame(gameLoop);
}

function laneNum(l) { return Math.min(3, Math.max(0, l)); }

// 🎯 全新威威機台結算畫面：大字 Accuracy %、各級百分比與專屬評級
function triggerSongClear() {
    isPlaying = false; masterAudio.pause();
    document.getElementById('battleHud').style.display = 'none';
    document.getElementById('touchController').style.display = 'none';
    const tuner = document.getElementById('freezeTuner'); if (tuner) tuner.style.display = 'none';
    const barHud = document.getElementById('barInspectorHUD'); if (barHud) barHud.style.display = 'none';

    const totalHits = countPerfect + countGreat + countGood + countMiss;
    const accuracy = totalHits > 0 
        ? (((countPerfect * 1.0) + (countGreat * 0.7) + (countGood * 0.3)) / totalHits) * 100 
        : 0;

    let rank = "C";
    if (countMiss === 0 && countGood === 0 && countGreat === 0 && totalHits > 0) rank = "SS";
    else if (accuracy >= 95.0) rank = "S";
    else if (accuracy >= 85.0) rank = "A";
    else if (accuracy >= 70.0) rank = "B";

    const badge = document.getElementById('rankBadge'); 
    badge.innerText = rank;
    if (rank === "SS") { badge.style.color = "#ff0077"; badge.style.textShadow = "0 0 35px #ff0077"; }
    else if (rank === "S") { badge.style.color = "#ffcc00"; badge.style.textShadow = "0 0 35px #ffcc00"; }
    else if (rank === "A") { badge.style.color = "#00ffcc"; badge.style.textShadow = "0 0 30px #00ffcc"; }
    else { badge.style.color = "#aaa"; badge.style.textShadow = "none"; }

    const resScoreEl = document.getElementById('resScore');
    if (resScoreEl) {
        resScoreEl.innerHTML = `
            <div style="font-size:26px; color:#ffd700; font-weight:900; letter-spacing:1px;">${String(score).padStart(6, '0')}</div>
            <div style="font-size:16px; color:#00ffcc; font-weight:bold; margin-top:3px; text-shadow:0 0 12px #00ffcc;">
                ACCURACY: ${accuracy.toFixed(2)}%
            </div>
            ${countMiss === 0 && totalHits > 0 ? '<div style="font-size:11px; color:#ff0077; font-weight:900; margin-top:2px;">★ FULL COMBO ★</div>' : ''}
        `;
    }

    const pRatio = totalHits > 0 ? ((countPerfect / totalHits) * 100).toFixed(1) : "0.0";
    const grRatio = totalHits > 0 ? ((countGreat / totalHits) * 100).toFixed(1) : "0.0";
    const gdRatio = totalHits > 0 ? ((countGood / totalHits) * 100).toFixed(1) : "0.0";
    const mRatio = totalHits > 0 ? ((countMiss / totalHits) * 100).toFixed(1) : "0.0";

    document.getElementById('resMaxCombo').innerText = `${maxCombo} / ${totalHits}`;
    document.getElementById('resPerfect').innerText = `${countPerfect} (${pRatio}%)`;
    document.getElementById('resGreat').innerText = `${countGreat} (${grRatio}%)`;
    document.getElementById('resGood').innerText = `${countGood} (${gdRatio}%)`;
    document.getElementById('resMiss').innerText = `${countMiss} (${mRatio}%)`;

    document.getElementById('resultModal').classList.add('active');
    const cdLabel = document.getElementById('closeCountdown');
    if (cdLabel) cdLabel.innerText = "點擊任意位置繼續航行";

    if (autoReturnTimer) { clearInterval(autoReturnTimer); autoReturnTimer = null; }
    const modal = document.getElementById('resultModal'); modal.onclick = function() { modal.onclick = null; returnFromResults(); };
}

function returnFromResults() { if (autoReturnTimer) { clearInterval(autoReturnTimer); autoReturnTimer = null; } document.getElementById('resultModal').classList.remove('active'); returnToReadyRoom(); }
