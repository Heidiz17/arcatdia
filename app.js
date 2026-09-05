/* -------------------------------------------------------------
   🎵 Arcatdia - 175 BPM Direct Local Audio Engine (app.js)
   ------------------------------------------------------------- */
const canvas = document.getElementById('battleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 850; 
canvas.height = 520;

let bpm = 175;
const lanes = [170, 340, 510, 680];
const hitZoneY = 440;
let isPlaying = false;
let notes = [];

// 定義同層目錄下的 6 條 Stem 檔名 (請按你實際檔名對應)
const stemFiles = {
    drums: "最大の愛(original jp)_drums_mixed.mp3",
    guitars: "最大の愛(original jp)_guitars_mixed.mp3",
    piano: "最大の愛(original jp)_piano_mixed.mp3",
    bass: "最大の愛(original jp)_bass_mixed.mp3",
    vocals: "最大の愛(original jp)_vocals_mixed.mp3",
    other: "最大の愛(original jp)_other_mixed.mp3"
};

const audioElements = {};

// 預先加載同層 MP3 檔
Object.keys(stemFiles).forEach(key => {
    const audio = new Audio();
    audio.src = stemFiles[key];
    audio.preload = "auto";
    audioElements[key] = audio;
});

function updateBPM() {
    bpm = document.getElementById('bpmInput').value;
    const bpmDisp = document.getElementById('bpmDisplay');
    if (bpmDisp) bpmDisp.innerText = bpm;
}

function toggleMenu() {
    const panel = document.getElementById('drawerPanel');
    if (panel) panel.classList.toggle('open');
}

// 播放所有 6 條 Stems
function playAllAudio() {
    Object.keys(audioElements).forEach(key => {
        audioElements[key].currentTime = 0;
        audioElements[key].play().then(() => {
            console.log(`🔊 ${key} 成功播放！`);
        }).catch(err => {
            console.error(`❌ ${key} 播放失敗:`, err);
        });
    });
}

// 暫停所有 Stems
function pauseAllAudio() {
    Object.keys(audioElements).forEach(key => {
        audioElements[key].pause();
    });
}

// 頂部 ▶ PLAY / ⏸ PAUSE 切換
function togglePlay() {
    const playBtn = document.getElementById('mainPlayBtn');
    
    if (!isPlaying) {
        isPlaying = true;
        playAllAudio(); // 點擊即播放同層 6 條 MP3！
        if (playBtn) playBtn.innerText = "⏸ PAUSE";
        
        if (notes.length === 0) {
            const speed = (bpm / 150) * 5.0;
            for (let i = 0; i < 50; i++) {
                notes.push({ lane: Math.floor(Math.random() * 4), y: -i * 70, speed: speed });
            }
        }
        requestAnimationFrame(gameLoop);
    } else {
        isPlaying = false;
        pauseAllAudio();
        if (playBtn) playBtn.innerText = "▶ PLAY";
    }
}

function startBattle() {
    const mask = document.getElementById('startMask');
    if (mask) mask.style.display = 'none';
    togglePlay();
}

// Canvas 175 BPM 動畫繪製 Loop
function gameLoop() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    lanes.forEach((x) => {
        ctx.strokeStyle = "rgba(0, 255, 204, 0.25)"; 
        ctx.lineWidth = 2;
        ctx.beginPath(); 
        ctx.moveTo(x, 0); 
        ctx.lineTo(x, canvas.height); 
        ctx.stroke();

        ctx.fillStyle = "#ff0077"; 
        ctx.shadowColor = "#ff0077"; 
        ctx.shadowBlur = 12;
        ctx.beginPath(); 
        ctx.arc(x, hitZoneY, 16, 0, Math.PI * 2); 
        ctx.fill();
    });

    notes.forEach(note => {
        note.y += note.speed;
        if (note.y > canvas.height + 20) note.y = -100;

        ctx.fillStyle = "#00ffcc"; 
        ctx.shadowColor = "#00ffcc"; 
        ctx.shadowBlur = 10;
        ctx.beginPath(); 
        ctx.arc(lanes[note.lane], note.y, 14, 0, Math.PI * 2); 
        ctx.fill();
    });

    requestAnimationFrame(gameLoop);
}
