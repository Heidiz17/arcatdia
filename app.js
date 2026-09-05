/* =============================================================
   🔒 Arcatdia Battle Engine v3.7 - Pure Linear Calibration (Part 2)
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

        // 🎯 只要在判定線附近按下，給予公正判定
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
    
    // 🎯 物理鎖定：下落時間剛好等於 1 個小節 (4拍 = 1371.4ms)
    const beatMs = (60 / bpm) * 1000;
    const travelDuration = beatMs * 4; 

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

    // 🎯 純線性等速下落：無加速、無減速、無花臣！
    notes.forEach(note => {
        const laneIndex = note.lane;
        const tx = topX[laneIndex];
        const bx = botX[laneIndex];
        const colorObj = laneColors[laneIndex];

        if (note.hit) return;
        const timeTillHit = note.targetTime - currentTimeMs;
        
        // 🎯 1.0 代表剛好在判定線上，等速線性映射
        const rawProgress = 1.0 - (timeTillHit / travelDuration);

        // 只有當音符在螢幕可見範圍內（0 到 1.15）先繪製
        if (rawProgress > 0 && rawProgress < 1.15) {
            const currentX = tx + (bx - tx) * rawProgress;
            const currentY = startY + (hitZoneY - startY) * rawProgress;

            ctx.fillStyle = colorObj.main;
            ctx.shadowColor = colorObj.main;
            ctx.shadowBlur = 20 * rawProgress;
            ctx.beginPath();

            if (currentPerspectiveMode === 1) {
                // 2D 乾淨大圓
                ctx.ellipse(currentX, currentY, 26, 32, 0, 0, Math.PI * 2);
            } else {
                // 3D 尖角透視
                const rx = (10 * (1.0 - rawProgress)) + (52 * rawProgress);
                const ry = (32 * (1.0 - rawProgress)) + (14 * rawProgress);
                ctx.ellipse(currentX, currentY, rx, ry, 0, 0, Math.PI * 2);
            }
            ctx.fill();
        }

        // 🎯 修正核心：絕對不准在空中判 MISS！
        // 只有當粒音跌穿判定線超過 280ms，確認玩家完全漏咗唔撳，先准判 MISS！
        if (rawProgress > 1.25 && !note.hit) {
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
