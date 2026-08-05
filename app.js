// TamaRyu Game Engine & Economy

const TICK_RATE = 1000; // 1 real-time second per tick

// Default starting state
const DEFAULT_STATE = {
    stage: 'egg', // egg, baby, child, teen, adult
    ageTicks: 0,
    hunger: 50,
    happiness: 50,
    energy: 100,
    health: 100,
    poops: 0,
    isSleeping: false,
    lastUpdate: Date.now(),
    coins: 0,
    bg: 'cave', // cave, forest
    inventory: []
};

let state = { ...DEFAULT_STATE };
let loopInterval = null;
let isMinigameActive = false;
let emoteTimeout = null;
let deferredPrompt = null;

// Capture PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// UI Elements
const els = {
    barHunger: document.getElementById('bar-hunger'),
    barHappiness: document.getElementById('bar-happiness'),
    barEnergy: document.getElementById('bar-energy'),
    barHealth: document.getElementById('bar-health'),
    coinCounter: document.getElementById('coin-counter'),
    dragonSprite: document.getElementById('dragon-sprite'),
    environment: document.getElementById('environment'),
    poopContainer: document.getElementById('poop-container'),
    notification: document.getElementById('notification'),
    
    // Modals
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalOptions: document.getElementById('modal-options'),
    modalClose: document.getElementById('modal-close'),
    modalCoinsDisplay: document.getElementById('modal-coins-display'),
    modalCoinsVal: document.getElementById('modal-coins-val'),
    
    // Minigame
    minigameOverlay: document.getElementById('minigame-overlay'),
    minigameCanvas: document.getElementById('minigame-canvas'),
    minigameCoins: document.getElementById('minigame-coins'),
    btnExitMinigame: document.getElementById('btn-exit-minigame')
};

// Evolution thresholds (in ticks. 1 day = 86400 ticks)
const SECONDS_PER_DAY = 86400;
const EVOLUTION_THRESHOLDS = {
    egg: 30, // 30 seconds to hatch
    baby: SECONDS_PER_DAY * 2, // 2 days to child
    child: SECONDS_PER_DAY * 5, // 5 days total to teen
    teen: SECONDS_PER_DAY * 10 // 10 days total to adult
};

// -----------------------------------------
// Core Engine
// -----------------------------------------

function init() {
    loadState();
    bindEvents();
    updateUI();
    
    loopInterval = setInterval(gameLoop, TICK_RATE);
    handleOfflineProgress();
}

function loadState() {
    const saved = localStorage.getItem('tamaryu_state');
    if (saved) {
        try {
            state = { ...DEFAULT_STATE, ...JSON.parse(saved) };
        } catch (e) {
            console.error("Save corrupted, starting fresh.");
        }
    }
}

function saveState() {
    if (!isMinigameActive) {
        state.lastUpdate = Date.now();
        localStorage.setItem('tamaryu_state', JSON.stringify(state));
    }
}

function handleOfflineProgress() {
    const now = Date.now();
    const diff = now - state.lastUpdate;
    const ticksPassed = Math.floor(diff / TICK_RATE);
    
    if (ticksPassed > 0) {
        for (let i = 0; i < ticksPassed; i++) {
            tick(true);
        }
        updateUI();
        if (ticksPassed > 60) {
            showNotification(`Welcome back! ${ticksPassed} seconds passed.`);
        }
    }
}

function gameLoop() {
    if (isMinigameActive) return; // Pause real-time mechanics
    tick(false);
}

function tick(isFastForward = false) {
    state.ageTicks++;
    
    if (state.stage !== 'egg') {
        if (state.ageTicks % 10 === 0) state.hunger = Math.max(0, state.hunger - 1);
        if (state.ageTicks % 15 === 0) state.happiness = Math.max(0, state.happiness - 1);
        
        if (state.isSleeping) {
            if (state.ageTicks % 2 === 0) state.energy = Math.min(100, state.energy + 1);
            if (state.energy === 100 && !isFastForward) {
                toggleSleep(); 
            }
        } else {
            if (state.ageTicks % 30 === 0) state.energy = Math.max(0, state.energy - 1);
        }
        
        if (state.hunger > 30 && state.ageTicks % 60 === 0 && Math.random() > 0.7) {
            if (state.poops < 5) state.poops++;
        }
        
        if (state.poops > 0 && state.ageTicks % 10 === 0) {
            state.health = Math.max(0, state.health - state.poops);
        } else if (state.poops === 0 && state.health < 100 && state.ageTicks % 5 === 0) {
            state.health = Math.min(100, state.health + 1);
        }
        
        // Idle Emotes & Behaviors
        if (state.isSleeping) {
            if (state.ageTicks % 4 === 0) showEmote('💤');
        } else {
            if (!isFastForward && Math.random() < 0.1) {
                if (state.health < 40) showEmote('🤢');
                else if (state.hunger < 30) showEmote('🍖');
                else if (state.happiness < 30) showEmote('😿');
            }
            if (!isFastForward && Math.random() < 0.05) {
                playAnimation('anim-flutter', 1200);
            }
        }
    }
    
    if (state.stage === 'egg' && state.ageTicks >= EVOLUTION_THRESHOLDS.egg) {
        evolve('baby');
    } else if (state.stage === 'baby' && state.ageTicks >= EVOLUTION_THRESHOLDS.baby) {
        evolve('child');
    } else if (state.stage === 'child' && state.ageTicks >= EVOLUTION_THRESHOLDS.child) {
        evolve('teen');
    } else if (state.stage === 'teen' && state.ageTicks >= EVOLUTION_THRESHOLDS.teen) {
        evolve('adult');
    }
    
    if (!isFastForward) {
        updateUI();
        saveState();
    }
}

function evolve(newStage) {
    state.stage = newStage;
    showNotification(`Your egg hatched into a ${newStage}!`);
    state.hunger = 80;
    state.happiness = 80;
    state.energy = 100;
    state.health = 100;
}

// -----------------------------------------
// UI & Rendering
// -----------------------------------------

function updateUI() {
    els.barHunger.style.width = `${state.hunger}%`;
    els.barHappiness.style.width = `${state.happiness}%`;
    els.barEnergy.style.width = `${state.energy}%`;
    els.barHealth.style.width = `${state.health}%`;
    
    els.barHunger.style.background = state.hunger < 20 ? '#ef4444' : 'var(--stat-hunger)';
    els.barHealth.style.background = state.health < 30 ? '#ef4444' : 'var(--stat-health)';
    
    els.coinCounter.innerText = state.coins;
    els.environment.className = `bg-${state.bg}`;
    
    els.dragonSprite.className = `sprite-${state.stage}`;
    
    if (state.isSleeping) {
        els.dragonSprite.classList.add('sprite-sleep');
        els.dragonSprite.classList.add('breathe');
        document.body.classList.add('lights-out');
    } else {
        document.body.classList.remove('lights-out');
        if (state.health < 50) {
            els.dragonSprite.classList.add('sprite-sick');
            els.dragonSprite.classList.add('shake');
        } else {
            els.dragonSprite.classList.remove('bounce');
        }
    }
    
    // Sync poops without re-rendering everything (prevents flashing)
    while (els.poopContainer.children.length < state.poops) {
        const i = els.poopContainer.children.length;
        const poopEl = document.createElement('div');
        poopEl.className = 'poop';
        poopEl.style.left = `${10 + (i * 20)}%`;
        
        poopEl.innerHTML = `
            <div class="stink-lines">
                <div class="stink-line"></div>
                <div class="stink-line"></div>
                <div class="stink-line"></div>
            </div>
            <svg viewBox="0 0 64 64" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 50 C 12 58, 52 58, 52 50 C 52 42, 12 42, 12 50 Z" fill="#4a2e15"/>
              <path d="M20 40 C 20 48, 44 48, 44 40 C 44 32, 20 32, 20 40 Z" fill="#5c3a1a"/>
              <path d="M28 30 C 28 38, 36 38, 36 30 C 36 22, 32 16, 32 16 C 32 16, 28 22, 28 30 Z" fill="#6e4620"/>
            </svg>
        `;
        els.poopContainer.appendChild(poopEl);
    }
    while (els.poopContainer.children.length > state.poops) {
        els.poopContainer.removeChild(els.poopContainer.lastChild);
    }
}

function showNotification(msg) {
    els.notification.innerText = msg;
    els.notification.classList.remove('hidden');
    els.notification.style.animation = 'none';
    els.notification.offsetHeight; 
    els.notification.style.animation = null;
    
    setTimeout(() => {
        els.notification.classList.add('hidden');
    }, 3000);
}

let emoteTimeout = null;
function showEmote(emoji, duration = 2000) {
    if (state.stage === 'egg' && emoji !== '💤') return;
    
    const bubble = document.getElementById('emote-bubble');
    if (!bubble) return;
    
    bubble.innerText = emoji;
    bubble.classList.remove('hidden');
    
    bubble.style.animation = 'none';
    bubble.offsetHeight; // force reflow
    bubble.style.animation = null;
    
    clearTimeout(emoteTimeout);
    emoteTimeout = setTimeout(() => {
        bubble.classList.add('hidden');
    }, duration);
}

// -----------------------------------------
// Menus & Shop
// -----------------------------------------

function openMenu(title, options, showCoins = false) {
    if (state.isSleeping) {
        showNotification("Zzz... Wake up first.");
        return;
    }
    
    els.modalTitle.innerText = title;
    els.modalOptions.innerHTML = '';
    
    if (showCoins) {
        els.modalCoinsDisplay.classList.remove('hidden');
        els.modalCoinsVal.innerText = state.coins;
    } else {
        els.modalCoinsDisplay.classList.add('hidden');
    }
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'modal-option-btn';
        btn.innerHTML = opt.label;
        if (opt.disabled) {
            btn.style.opacity = 0.5;
            btn.style.cursor = 'not-allowed';
        } else {
            btn.onclick = () => {
                opt.action();
                if (!opt.keepOpen) closeMenu();
            };
        }
        els.modalOptions.appendChild(btn);
    });
    
    els.modalOverlay.classList.remove('hidden');
}

function closeMenu() {
    els.modalOverlay.classList.add('hidden');
}

function openShop() {
    const hasForest = state.inventory.includes('bg_forest');
    
    const options = [
        { 
            label: `🌲 Forest Background ${hasForest ? '(Owned)' : '- 100 🪙'}`, 
            disabled: hasForest && state.bg === 'forest',
            action: () => {
                if (hasForest) {
                    state.bg = 'forest';
                    updateUI();
                    showNotification("Equipped Forest Background");
                } else if (state.coins >= 100) {
                    state.coins -= 100;
                    state.inventory.push('bg_forest');
                    state.bg = 'forest';
                    updateUI();
                    showNotification("Purchased Forest Background!");
                } else {
                    showNotification("Not enough coins!");
                }
            }
        },
        { 
            label: `🦇 Cave Background ${state.bg === 'cave' ? '(Equipped)' : '(Owned)'}`, 
            disabled: state.bg === 'cave',
            action: () => {
                state.bg = 'cave';
                updateUI();
                showNotification("Equipped Cave Background");
            }
        },
        {
            label: `🍖 Premium Steak - 25 🪙`,
            action: () => {
                if (state.coins >= 25) {
                    state.coins -= 25;
                    state.hunger = 100;
                    state.happiness = 100;
                    updateUI();
                    showNotification("Ate Premium Steak!");
                    animateAction();
                } else {
                    showNotification("Not enough coins!");
                }
            }
        },
        {
            label: `⏩ CHEAT: Fast Forward 1 Day`,
            keepOpen: true,
            action: () => {
                showNotification("Skipping 1 day (stats protected)...");
                state.ageTicks += SECONDS_PER_DAY;
                
                // Manually trigger evolution checks without decaying stats 86400 times
                if (state.stage === 'egg' && state.ageTicks >= EVOLUTION_THRESHOLDS.egg) {
                    evolve('baby');
                } else if (state.stage === 'baby' && state.ageTicks >= EVOLUTION_THRESHOLDS.baby) {
                    evolve('child');
                } else if (state.stage === 'child' && state.ageTicks >= EVOLUTION_THRESHOLDS.child) {
                    evolve('teen');
                } else if (state.stage === 'teen' && state.ageTicks >= EVOLUTION_THRESHOLDS.teen) {
                    evolve('adult');
                }
                
                updateUI();
                saveState();
            }
        }
    ];
    openMenu("Shop", options, true);
}

// -----------------------------------------
// Interactions
// -----------------------------------------

function handleSpriteTap() {
    if (state.stage === 'egg') {
        showNotification("The egg wiggles warmly.");
        animateAction();
    } else {
        if (state.isSleeping) {
            showNotification("Shh, it's sleeping.");
        } else {
            state.happiness = Math.min(100, state.happiness + 5);
            showNotification("Happy tap!");
            showEmote('🎵');
        }
    }
}

function tossFood(emoji, callback) {
    const food = document.createElement('div');
    food.className = 'projectile';
    food.innerText = emoji;
    document.getElementById('environment').appendChild(food);
    
    setTimeout(() => {
        food.remove();
        if (callback) callback();
    }, 600);
}

function doFeed(type) {
    if (state.stage === 'egg') return showNotification("It's just an egg!");
    
    const emoji = type === 'meal' ? '🍖' : '🍎';
    tossFood(emoji, () => {
        if (type === 'meal') {
            state.hunger = Math.min(100, state.hunger + 30);
            showNotification("Ate a hearty meal!");
        } else if (type === 'snack') {
            state.hunger = Math.min(100, state.hunger + 10);
            state.happiness = Math.min(100, state.happiness + 20);
            state.health = Math.max(0, state.health - 5);
            showNotification("Ate a yummy apple!");
        }
        showEmote('❤️');
        updateUI();
    });
}

let fetchRallyCount = 0;
let fetchTimeout = null;

function startFetchGame() {
    closeMenu();
    if (state.stage === 'egg') return showNotification("It's just an egg!");
    if (state.energy < 20) return showNotification("Too tired to play.");
    
    state.energy -= 20;
    fetchRallyCount = 0;
    
    const ball = document.createElement('div');
    ball.className = 'fetch-ball';
    ball.innerText = '⚾';
    ball.style.setProperty('--click-offset-x', '0vw');
    ball.style.setProperty('--click-y', '-10%');
    ball.style.setProperty('--click-scale', '2');
    document.getElementById('environment').appendChild(ball);
    
    throwBallToDragon(ball);
}

function throwBallToDragon(ball) {
    const duration = Math.max(0.4, 0.8 - (fetchRallyCount * 0.05));
    ball.style.animation = `ballToDragon ${duration}s ease-in forwards`;
    
    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
        playAnimation('anim-flutter', 500);
        throwBallToPlayer(ball);
    }, duration * 1000);
}

function throwBallToPlayer(ball) {
    const duration = Math.max(0.6, 1.5 - (fetchRallyCount * 0.1));
    
    // Pick a random spot for the player to tap: between -35vw and +35vw of center
    const targetOffset = (Math.random() * 70 - 35);
    ball.style.setProperty('--offset-x', `${targetOffset}vw`);
    
    // Reset animation
    ball.style.animation = 'none';
    ball.offsetHeight; // force reflow
    ball.style.animation = `ballToPlayer ${duration}s ease-out forwards`;
    
    let caught = false;
    ball.onclick = () => {
        if (caught) return;
        caught = true;
        fetchRallyCount++;
        state.happiness = Math.min(100, state.happiness + 5);
        showEmote('✨', 500);
        
        // Start next throw from where it landed
        ball.style.setProperty('--click-offset-x', `${targetOffset}vw`);
        ball.style.setProperty('--click-y', '-10%');
        ball.style.setProperty('--click-scale', '2');
        
        throwBallToDragon(ball);
    };
    
    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
        if (!caught) {
            ball.remove();
            showNotification(`Fetch ended! Rally: ${fetchRallyCount}`);
            state.coins += fetchRallyCount * 2;
            if (fetchRallyCount >= 3) showEmote('🐲');
            updateUI();
        }
    }, duration * 1000);
}

function doPlay() {
    if (state.stage === 'egg') return showNotification("It's just an egg!");
    if (state.energy < 20) return showNotification("Too tired to play.");
    
    let games = [];
    
    if (state.stage === 'baby' || state.stage === 'child' || state.stage === 'teen' || state.stage === 'adult') {
        games.push({ label: "⚾ Play Fetch", action: () => startFetchGame() });
    }
    
    if (state.stage === 'child' || state.stage === 'teen' || state.stage === 'adult') {
        games.push({ label: "🍎 Sky Drop", action: () => startSkyDrop() });
    }
    
    if (state.stage === 'teen' || state.stage === 'adult') {
        games.push({ label: "🦇 Dragon Glide", action: () => startDragonGlide() });
    }
    
    if (state.stage === 'adult') {
        games.push({ label: "🔥 Dragon Fire", action: () => startDragonFire() });
    }
    
    openMenu("Minigames", games);
}

function doClean() {
    if (state.poops > 0) {
        state.poops = 0;
        showNotification("All clean!");
        showEmote('✨');
        updateUI();
    } else {
        showNotification("Nothing to clean.");
    }
}

function doHeal() {
    if (state.stage === 'egg') return;
    if (state.health < 100) {
        state.health = Math.min(100, state.health + 40);
        showNotification("Given medicine.");
        showEmote('💖');
    } else {
        showNotification("Already healthy!");
    }
}

function doMenu() {
    openMenu("Main Menu", [
        { label: "⚙️ Settings", action: () => openSettings() },
        { label: "❌ Quit (Close Tab)", action: () => { window.close(); } }
    ]);
}

function openSettings() {
    const volOn = state.volume !== false; // Default true
    openMenu("Settings", [
        { label: `🔊 Volume: ${volOn ? 'ON' : 'OFF'}`, action: () => toggleVolume() },
        { label: "📱 Install App to Phone", action: () => promptInstall() },
        { label: "⚠️ Factory Reset", action: () => doReset() },
        { label: "⬅️ Back", action: () => doMenu() }
    ]);
}

function toggleVolume() {
    state.volume = state.volume === false ? true : false;
    saveState();
    openSettings();
}

function promptInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showNotification('Installation started!');
            }
            deferredPrompt = null;
        });
    } else {
        showNotification("Please use your browser's 'Add to Home Screen' option!");
    }
}

function doReset() {
    openMenu("⚠️ RESET GAME?", [
        {
            label: `❌ YES, DELETE MY DRAGON ❌`,
            action: () => {
                localStorage.removeItem('tamaryu_state');
                state = { ...DEFAULT_STATE, lastUpdate: Date.now() };
                updateUI();
                showNotification("Game completely reset!");
                animateAction();
            }
        }
    ]);
    
    // Make the button red in the modal
    const buttons = els.modalOptions.querySelectorAll('button');
    if (buttons.length > 0) {
        buttons[0].style.background = 'rgba(239, 68, 68, 0.2)';
        buttons[0].style.border = '1px solid rgba(239, 68, 68, 0.5)';
        buttons[0].style.color = '#fca5a5';
        buttons[0].style.fontWeight = 'bold';
    }
}

function toggleSleep() {
    if (state.stage === 'egg') return;
    state.isSleeping = !state.isSleeping;
    if (state.isSleeping) {
        showNotification("Lights out. Goodnight!");
    } else {
        showNotification("Good morning!");
        playAnimation('anim-walk', 2000);
    }
    updateUI();
    saveState();
}

function playAnimation(animClass, durationMs = 2000) {
    if (state.stage !== 'baby' && state.stage !== 'child' && state.stage !== 'teen' && state.stage !== 'adult') {
        animateAction();
        return;
    }
    els.dragonSprite.classList.add(animClass);
    setTimeout(() => {
        els.dragonSprite.classList.remove(animClass);
    }, durationMs);
}

function animateAction() {
    if (state.stage === 'baby' || state.stage === 'child' || state.stage === 'teen' || state.stage === 'adult') {
        els.dragonSprite.classList.add('anim-flutter');
        setTimeout(() => els.dragonSprite.classList.remove('anim-flutter'), 1500);
        return;
    }
    els.dragonSprite.classList.remove('bounce', 'breathe', 'shake');
    els.dragonSprite.style.transform = 'scale(1.2)';
    setTimeout(() => {
        els.dragonSprite.style.transform = '';
        updateUI();
    }, 300);
}

function bindEvents() {
    document.getElementById('btn-feed').addEventListener('click', () => {
        openMenu("Feed", [
            { label: "🥩 Meat (Meal)", action: () => { doFeed('meal'); } },
            { label: "🍎 Apple (Snack)", action: () => { doFeed('snack'); } }
        ]);
    });
    
    document.getElementById('btn-play').addEventListener('click', doPlay);
    document.getElementById('btn-sleep').addEventListener('click', toggleSleep);
    document.getElementById('btn-clean').addEventListener('click', doClean);
    document.getElementById('btn-heal').addEventListener('click', doHeal);
    document.getElementById('btn-shop').addEventListener('click', openShop);
    document.getElementById('btn-menu').addEventListener('click', doMenu);
    
    // Tap dragon to flutter
    els.dragonSprite.addEventListener('click', () => {
        handleSpriteTap();
        if (!state.isSleeping && (state.stage === 'baby' || state.stage === 'child' || state.stage === 'teen' || state.stage === 'adult')) {
            playAnimation('anim-flutter', 1200);
        }
    });
    
    // Auto-sleep when screen is off / app is backgrounded
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            if (!state.isSleeping && state.stage !== 'egg') {
                toggleSleep();
            }
        }
    });
    
    els.modalClose.addEventListener('click', closeMenu);
    els.btnExitMinigame.addEventListener('click', () => {
        if (isMinigameActive === 'skydrop') exitSkyDrop();
        if (isMinigameActive === 'dragonglide') exitDragonGlide();
        if (isMinigameActive === 'dragonfire') exitDragonFire();
    });
}


// -----------------------------------------
// Minigame: Sky Drop (Child Stage)
// -----------------------------------------

let mgReq;
let mgCoinsWon = 0;

const sdState = {
    dragon: { x: 0, y: 0, w: 80, h: 80 },
    items: [], // {x, y, type: 'food'|'coin'|'rock', speed}
    width: 0,
    height: 0,
    lastSpawn: 0
};

// Sprites
const spriteImg = new Image();
spriteImg.src = 'child.png';

function startSkyDrop() {
    closeMenu();
    if (state.energy < 20) return showNotification("Too tired to play.");
    state.energy -= 20;
    
    isMinigameActive = 'skydrop';
    els.minigameOverlay.classList.remove('hidden');
    document.getElementById('minigame-title').innerText = "Sky Drop";
    mgCoinsWon = 0;
    els.minigameCoins.innerText = '0';
    
    // Resize canvas
    sdState.width = els.minigameCanvas.clientWidth;
    sdState.height = els.minigameCanvas.clientHeight;
    els.minigameCanvas.width = sdState.width;
    els.minigameCanvas.height = sdState.height;
    
    // Init state
    sdState.dragon.x = sdState.width / 2 - sdState.dragon.w / 2;
    sdState.dragon.y = sdState.height - sdState.dragon.h - 20;
    sdState.items = [];
    sdState.lastSpawn = Date.now();
    
    // Controls
    els.minigameCanvas.addEventListener('touchmove', handleSdTouch, {passive: false});
    els.minigameCanvas.addEventListener('mousemove', handleSdMouse);
    
    mgReq = requestAnimationFrame(sdLoop);
}

function exitSkyDrop() {
    cancelAnimationFrame(mgReq);
    isMinigameActive = false;
    els.minigameOverlay.classList.add('hidden');
    els.minigameCanvas.removeEventListener('touchmove', handleSdTouch);
    els.minigameCanvas.removeEventListener('mousemove', handleSdMouse);
    
    if (mgCoinsWon > 0) {
        state.coins += mgCoinsWon;
        state.happiness = Math.min(100, state.happiness + mgCoinsWon * 2);
        showNotification(`You won ${mgCoinsWon} 🪙!`);
        showEmote('🐲'); 
    } else {
        showNotification("Minigame exited.");
    }
    updateUI();
    saveState();
}

function handleSdTouch(e) {
    e.preventDefault();
    const rect = els.minigameCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    sdState.dragon.x = touch.clientX - rect.left - (sdState.dragon.w / 2);
    checkSdBounds();
}

function handleSdMouse(e) {
    const rect = els.minigameCanvas.getBoundingClientRect();
    sdState.dragon.x = e.clientX - rect.left - (sdState.dragon.w / 2);
    checkSdBounds();
}

function checkSdBounds() {
    if (sdState.dragon.x < 0) sdState.dragon.x = 0;
    if (sdState.dragon.x + sdState.dragon.w > sdState.width) sdState.dragon.x = sdState.width - sdState.dragon.w;
}

function sdLoop() {
    const ctx = els.minigameCanvas.getContext('2d');
    ctx.clearRect(0, 0, sdState.width, sdState.height);
    
    const now = Date.now();
    
    // Spawn items
    if (now - sdState.lastSpawn > 1000) {
        sdState.lastSpawn = now;
        const types = ['food', 'coin', 'rock'];
        const type = types[Math.floor(Math.random() * types.length)];
        const emojis = { 'food': '🍎', 'coin': '🪙', 'rock': '🪨' };
        
        sdState.items.push({
            x: Math.random() * (sdState.width - 30) + 15,
            y: -30,
            type: type,
            emoji: emojis[type],
            speed: 3 + Math.random() * 3
        });
    }
    
    // Move & Draw Items
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = sdState.items.length - 1; i >= 0; i--) {
        const item = sdState.items[i];
        item.y += item.speed;
        
        ctx.fillText(item.emoji, item.x, item.y);
        
        // Collision
        if (item.y > sdState.dragon.y && item.y < sdState.dragon.y + sdState.dragon.h &&
            item.x > sdState.dragon.x && item.x < sdState.dragon.x + sdState.dragon.w) {
            
            if (item.type === 'food') {
                mgCoinsWon++;
            } else if (item.type === 'coin') {
                mgCoinsWon += 2;
            } else if (item.type === 'rock') {
                state.health = Math.max(0, state.health - 10);
                if (state.health <= 0) {
                    exitSkyDrop();
                    return;
                }
            }
            
            els.minigameCoins.innerText = mgCoinsWon;
            sdState.items.splice(i, 1);
            continue;
        }
        
        // Off-screen
        if (item.y > sdState.height + 30) {
            sdState.items.splice(i, 1);
        }
    }
    
    // Draw Dragon
    if (spriteImg.complete) {
        // Draw the first frame of the child walk strip (size is 150x150, but we scale it)
        ctx.drawImage(spriteImg, 0, 0, 150, 150, sdState.dragon.x, sdState.dragon.y, sdState.dragon.w, sdState.dragon.h);
    } else {
        ctx.fillStyle = '#10b981'; // Fallback green box
        ctx.fillRect(sdState.dragon.x, sdState.dragon.y, sdState.dragon.w, sdState.dragon.h);
    }
    
    mgReq = requestAnimationFrame(sdLoop);
}

// Start
init();

// -----------------------------------------
// Minigame: Dragon Glide (Teen Stage)
// -----------------------------------------

let dgState = {
    dragon: { x: 50, y: 100, w: 60, h: 60, velocity: 0, gravity: 0.6, jump: -8 },
    obstacles: [],
    width: 0,
    height: 0,
    frames: 0,
    active: false
};
const dgImg = new Image();
dgImg.src = 'teen.png'; // fallback or use the specific teen flutter strip if loaded? The flutter strip is separate but we can just use teen.png for now or draw it as a green box if it fails.

function startDragonGlide() {
    closeMenu();
    if (state.energy < 20) return showNotification(`Too tired to play.`);
    state.energy -= 20;
    
    isMinigameActive = 'dragonglide';
    dgState.active = true;
    els.minigameOverlay.classList.remove('hidden');
    document.getElementById('minigame-title').innerText = "Dragon Glide";
    mgCoinsWon = 0;
    els.minigameCoins.innerText = '0';
    
    dgState.width = els.minigameCanvas.clientWidth;
    dgState.height = els.minigameCanvas.clientHeight;
    els.minigameCanvas.width = dgState.width;
    els.minigameCanvas.height = dgState.height;
    
    dgState.dragon.y = dgState.height / 2;
    dgState.dragon.velocity = 0;
    dgState.obstacles = [];
    dgState.frames = 0;
    
    // Controls: tap anywhere to flap
    const flap = (e) => {
        if(e) e.preventDefault();
        dgState.dragon.velocity = dgState.dragon.jump;
    };
    els.minigameCanvas.addEventListener('touchstart', flap, {passive: false});
    els.minigameCanvas.addEventListener('mousedown', flap);
    
    // Save reference to remove later
    dgState.flapHandler = flap;
    
    mgReq = requestAnimationFrame(dgLoop);
}

function exitDragonGlide() {
    cancelAnimationFrame(mgReq);
    isMinigameActive = false;
    dgState.active = false;
    els.minigameOverlay.classList.add('hidden');
    
    els.minigameCanvas.removeEventListener('touchstart', dgState.flapHandler);
    els.minigameCanvas.removeEventListener('mousedown', dgState.flapHandler);
    
    if (mgCoinsWon > 0) {
        state.coins += mgCoinsWon;
        state.happiness = Math.min(100, state.happiness + mgCoinsWon * 2);
        showNotification(You won  + mgCoinsWon +  ??!);
        showEmote('??');
    } else {
        showNotification(Minigame exited.);
    }
    updateUI();
    saveState();
}

function dgLoop() {
    if(!dgState.active) return;
    const ctx = els.minigameCanvas.getContext('2d');
    ctx.clearRect(0, 0, dgState.width, dgState.height);
    
    // Physics
    dgState.dragon.velocity += dgState.dragon.gravity;
    dgState.dragon.y += dgState.dragon.velocity;
    
    // Collision with Floor/Ceiling
    if (dgState.dragon.y + dgState.dragon.h > dgState.height || dgState.dragon.y < 0) {
        exitDragonGlide();
        return;
    }
    
    // Spawn Obstacles (Stalactites / Stalagmites)
    if (dgState.frames % 90 === 0) {
        const gap = 150; // Gap for dragon to fly through
        const minHeight = 50;
        const topHeight = Math.random() * (dgState.height - gap - minHeight * 2) + minHeight;
        
        dgState.obstacles.push({
            x: dgState.width,
            w: 40,
            top: topHeight,
            bottom: dgState.height - topHeight - gap,
            passed: false
        });
    }
    
    // Move & Draw Obstacles
    ctx.fillStyle = '#9ca3af'; // Gray rocks
    for (let i = dgState.obstacles.length - 1; i >= 0; i--) {
        let obs = dgState.obstacles[i];
        obs.x -= 3; // speed
        
        // Draw top rock
        ctx.fillRect(obs.x, 0, obs.w, obs.top);
        // Draw bottom rock
        ctx.fillRect(obs.x, dgState.height - obs.bottom, obs.w, obs.bottom);
        
        // Collision Detection
        if (
            dgState.dragon.x < obs.x + obs.w &&
            dgState.dragon.x + dgState.dragon.w > obs.x &&
            (dgState.dragon.y < obs.top || dgState.dragon.y + dgState.dragon.h > dgState.height - obs.bottom)
        ) {
            exitDragonGlide();
            return;
        }
        
        // Score
        if (obs.x + obs.w < dgState.dragon.x && !obs.passed) {
            obs.passed = true;
            mgCoinsWon++;
            els.minigameCoins.innerText = mgCoinsWon;
        }
        
        if (obs.x + obs.w < 0) {
            dgState.obstacles.splice(i, 1);
        }
    }
    
    // Draw Dragon
    if (dgImg.complete) {
        ctx.drawImage(dgImg, 0, 0, 190, 190, dgState.dragon.x, dgState.dragon.y, dgState.dragon.w, dgState.dragon.h);
    } else {
        ctx.fillStyle = '#34d399';
        ctx.fillRect(dgState.dragon.x, dgState.dragon.y, dgState.dragon.w, dgState.dragon.h);
    }
    
    dgState.frames++;
    mgReq = requestAnimationFrame(dgLoop);
}


// -----------------------------------------
// Minigame: Dragon Fire (Adult Stage)
// -----------------------------------------

let dfState = {
    dragon: { x: 0, y: 0, w: 100, h: 100 },
    targets: [],
    fireballs: [],
    drag: { active: false, startX: 0, startY: 0, curX: 0, curY: 0 },
    width: 0,
    height: 0,
    frames: 0,
    active: false
};
const dfImg = new Image();
dfImg.src = 'adult.png';

function startDragonFire() {
    closeMenu();
    if (state.energy < 20) return showNotification(Too tired to play.);
    state.energy -= 20;
    
    isMinigameActive = 'dragonfire';
    dfState.active = true;
    els.minigameOverlay.classList.remove('hidden');
    document.getElementById('minigame-title').innerText = Dragon Fire;
    mgCoinsWon = 0;
    els.minigameCoins.innerText = '0';
    
    dfState.width = els.minigameCanvas.clientWidth;
    dfState.height = els.minigameCanvas.clientHeight;
    els.minigameCanvas.width = dfState.width;
    els.minigameCanvas.height = dfState.height;
    
    dfState.dragon.x = dfState.width / 2 - dfState.dragon.w / 2;
    dfState.dragon.y = dfState.height - dfState.dragon.h - 20;
    dfState.targets = [];
    dfState.fireballs = [];
    dfState.drag.active = false;
    dfState.frames = 0;
    
    const onStart = (e) => {
        if(e.type === 'touchstart') e.preventDefault();
        dfState.drag.active = true;
        let pos = getPos(e);
        dfState.drag.startX = pos.x;
        dfState.drag.startY = pos.y;
        dfState.drag.curX = pos.x;
        dfState.drag.curY = pos.y;
    };
    
    const onMove = (e) => {
        if (!dfState.drag.active) return;
        let pos = getPos(e);
        dfState.drag.curX = pos.x;
        dfState.drag.curY = pos.y;
    };
    
    const onEnd = (e) => {
        if (!dfState.drag.active) return;
        dfState.drag.active = false;
        
        let dx = dfState.drag.startX - dfState.drag.curX;
        let dy = dfState.drag.startY - dfState.drag.curY;
        
        // Prevent accidental micro-taps
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        
        // Create fireball
        dfState.fireballs.push({
            x: dfState.dragon.x + dfState.dragon.w / 2,
            y: dfState.dragon.y + 20,
            vx: dx * 0.15,
            vy: dy * 0.15,
            r: 15
        });
    };
    
    const getPos = (e) => {
        const rect = els.minigameCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    
    els.minigameCanvas.addEventListener('touchstart', onStart, {passive: false});
    els.minigameCanvas.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onEnd);
    
    els.minigameCanvas.addEventListener('mousedown', onStart);
    els.minigameCanvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    
    dfState.handlers = { onStart, onMove, onEnd };
    
    mgReq = requestAnimationFrame(dfLoop);
}

function exitDragonFire() {
    cancelAnimationFrame(mgReq);
    isMinigameActive = false;
    dfState.active = false;
    els.minigameOverlay.classList.add('hidden');
    
    els.minigameCanvas.removeEventListener('touchstart', dfState.handlers.onStart);
    els.minigameCanvas.removeEventListener('touchmove', dfState.handlers.onMove);
    window.removeEventListener('touchend', dfState.handlers.onEnd);
    
    els.minigameCanvas.removeEventListener('mousedown', dfState.handlers.onStart);
    els.minigameCanvas.removeEventListener('mousemove', dfState.handlers.onMove);
    window.removeEventListener('mouseup', dfState.handlers.onEnd);
    
    if (mgCoinsWon > 0) {
        state.coins += mgCoinsWon;
        state.happiness = Math.min(100, state.happiness + mgCoinsWon * 2);
        showNotification(You won  + mgCoinsWon +  ??!);
        showEmote('??');
    } else {
        showNotification(Minigame exited.);
    }
    updateUI();
    saveState();
}

function dfLoop() {
    if(!dfState.active) return;
    const ctx = els.minigameCanvas.getContext('2d');
    ctx.clearRect(0, 0, dfState.width, dfState.height);
    
    // Spawn Targets
    if (dfState.frames % 60 === 0 && dfState.targets.length < 5) {
        dfState.targets.push({
            x: Math.random() > 0.5 ? -30 : dfState.width + 30,
            y: Math.random() * (dfState.height / 2) + 20,
            vx: (Math.random() * 2 + 2) * (Math.random() > 0.5 ? 1 : -1),
            r: 20
        });
    }
    
    // Move & Draw Targets
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = dfState.targets.length - 1; i >= 0; i--) {
        let t = dfState.targets[i];
        t.x += t.vx;
        
        ctx.fillText('??', t.x, t.y);
        
        // Remove if way off screen
        if (t.x < -100 || t.x > dfState.width + 100) {
            dfState.targets.splice(i, 1);
        }
    }
    
    // Move & Draw Fireballs
    for (let i = dfState.fireballs.length - 1; i >= 0; i--) {
        let f = dfState.fireballs[i];
        f.x += f.vx;
        f.y += f.vy;
        
        // Add slight gravity
        f.vy += 0.2;
        
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444'; // Red-orange fireball
        ctx.fill();
        ctx.closePath();
        
        // Collision with targets
        let hit = false;
        for (let j = dfState.targets.length - 1; j >= 0; j--) {
            let t = dfState.targets[j];
            let dist = Math.hypot(f.x - t.x, f.y - t.y);
            if (dist < f.r + t.r) {
                hit = true;
                dfState.targets.splice(j, 1);
                mgCoinsWon++;
                els.minigameCoins.innerText = mgCoinsWon;
                break;
            }
        }
        
        if (hit || f.y > dfState.height + 50 || f.x < -50 || f.x > dfState.width + 50) {
            dfState.fireballs.splice(i, 1);
        }
    }
    
    // Draw Slingshot Band
    if (dfState.drag.active) {
        ctx.beginPath();
        ctx.moveTo(dfState.dragon.x + dfState.dragon.w / 2, dfState.dragon.y + 20);
        
        // Target aim inverted line
        let dx = dfState.drag.startX - dfState.drag.curX;
        let dy = dfState.drag.startY - dfState.drag.curY;
        
        ctx.lineTo(dfState.dragon.x + dfState.dragon.w / 2 + dx, dfState.dragon.y + 20 + dy);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.closePath();
    }
    
    // Draw Dragon
    if (dfImg.complete) {
        ctx.drawImage(dfImg, 0, 0, 200, 200, dfState.dragon.x, dfState.dragon.y, dfState.dragon.w, dfState.dragon.h);
    } else {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(dfState.dragon.x, dfState.dragon.y, dfState.dragon.w, dfState.dragon.h);
    }
    
    dfState.frames++;
    mgReq = requestAnimationFrame(dfLoop);
}

