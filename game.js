const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;
const FLOOR_Y = CANVAS_HEIGHT - 58;
const GRAVITY = 0.82;
const ROUND_DURATION = 60;
const POWERUP_INTERVAL = 12;
const MAX_ROUNDS = 3;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const STATE = {
    TITLE: 'TITLE',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    ROUND_END: 'ROUND_END',
    GAME_OVER: 'GAME_OVER'
};

const inputState = {
    left: false,
    right: false,
    block: false,
    attack: false
};

const ui = {
    timer: document.getElementById('timer'),
    player1Health: document.getElementById('player1-health'),
    player2Health: document.getElementById('player2-health'),
    player1Meter: document.getElementById('player1-meter'),
    player2Meter: document.getElementById('player2-meter'),
    player1Score: document.getElementById('player1-score'),
    player2Score: document.getElementById('player2-score'),
    roundLabel: document.getElementById('round-label'),
    pauseButton: document.getElementById('pause-button'),
    audioToggle: document.getElementById('audio-toggle'),
    playerName: document.getElementById('player-name'),
    difficulty: document.getElementById('difficulty-select'),
    loadout: document.getElementById('loadout-select'),
    leaderboard: document.getElementById('leaderboard-list'),
    combatStatus: document.getElementById('combat-status'),
    pilotRank: document.getElementById('pilot-rank'),
    pilotXp: document.getElementById('pilot-xp'),
    contractName: document.getElementById('contract-name'),
    contractProgress: document.getElementById('contract-progress'),
    directorEvent: document.getElementById('director-event'),
    directorTimer: document.getElementById('director-timer'),
    eventFeed: document.getElementById('event-feed')
};

const overlay = document.getElementById('message-overlay');
const startMenu = document.getElementById('start-menu');
const messagePanel = document.getElementById('message-panel');
const statusMessage = document.getElementById('status-message');
const subtitleMessage = document.getElementById('subtitle-message');
const overlayAction = document.getElementById('overlay-action');
const debriefPanel = document.getElementById('debrief-panel');
const debriefResult = document.getElementById('debrief-result');
const debriefXp = document.getElementById('debrief-xp');
const debriefScore = document.getElementById('debrief-score');
const debriefContract = document.getElementById('debrief-contract');

const startButton = document.getElementById('start-button');
const touchControls = document.getElementById('touch-controls');
const cloudStatus = document.getElementById('cloud-status');

let audioEnabled = true;
let lastFrame = 0;
const difficultyProfiles = {
    rookie: { label: 'ROOKIE', aggression: 0.65 },
    veteran: { label: 'VETERAN', aggression: 1 },
    apex: { label: 'APEX', aggression: 1.35 }
};

const loadoutProfiles = {
    vanguard: { label: 'VANGUARD', maxHealth: 118, damageMultiplier: 0.9, dashCooldown: 1.02 },
    striker: { label: 'STRIKER', maxHealth: 100, damageMultiplier: 1.16, dashCooldown: 0.92 },
    phase: { label: 'PHASE', maxHealth: 88, damageMultiplier: 0.98, dashCooldown: 0.66 }
};

const contracts = [
    { name: 'LAND 8 HITS', target: 8, getValue: stats => stats.hits },
    { name: 'COLLECT 2 POWERUPS', target: 2, getValue: stats => stats.powerups },
    { name: 'TRIGGER A SPECIAL', target: 1, getValue: stats => stats.specials },
    { name: 'BUILD A 5 HIT COMBO', target: 5, getValue: stats => stats.bestCombo },
    { name: 'DEAL 150 DAMAGE', target: 150, getValue: stats => Math.round(stats.damage) }
];

const directorEvents = [
    { name: 'GRAVITY FLUX', duration: 7, color: '#72d9ff', intro: 'Gravity reduced. Air control amplified.' },
    { name: 'MIRROR CURRENT', duration: 6, color: '#f08bff', intro: 'Directional inputs inverted for PLAYER 1.' },
    { name: 'OVERDRIVE WINDOW', duration: 5, color: '#ffbd6f', intro: 'All attacks deal amplified damage.' },
    { name: 'BLACKOUT PROTOCOL', duration: 6, color: '#a8b8d8', intro: 'Arena visibility reduced. Read the silhouettes.' }
];

const profile = {
    xp: 0,
    matches: 0,
    wins: 0,
    contractIndex: new Date().getDate() % contracts.length
};

try {
    ui.playerName.value = localStorage.getItem('slipstream.callsign') || ui.playerName.value;
    ui.difficulty.value = localStorage.getItem('slipstream.profile') || ui.difficulty.value;
    ui.loadout.value = localStorage.getItem('slipstream.loadout') || ui.loadout.value;
    const storedProfile = JSON.parse(localStorage.getItem('slipstream.pilot') || 'null');
    if (storedProfile) {
        profile.xp = Number(storedProfile.xp) || 0;
        profile.matches = Number(storedProfile.matches) || 0;
        profile.wins = Number(storedProfile.wins) || 0;
    }
} catch {
    // Private browsing may block local storage; the defaults remain usable.
}

function getPilotLevel() {
    return Math.floor(profile.xp / 500) + 1;
}

function saveProfile() {
    try {
        localStorage.setItem('slipstream.pilot', JSON.stringify(profile));
    } catch {
        // Progress remains available until the page is closed.
    }
}

function getContract() {
    return contracts[profile.contractIndex];
}

function updateProfileUI() {
    const contract = getContract();
    const progress = Math.min(contract.getValue(game.stats), contract.target);
    ui.pilotRank.textContent = `PILOT LEVEL ${getPilotLevel()}`;
    ui.pilotXp.textContent = `${profile.xp} XP // ${profile.wins} WINS`;
    ui.contractName.textContent = contract.name;
    ui.contractProgress.textContent = `${progress} / ${contract.target}`;
}

function recordEvent(message, color = '#72d9ff') {
    game.director.history.unshift({ message, color });
    game.director.history = game.director.history.slice(0, 3);
    ui.eventFeed.innerHTML = game.director.history
        .map(event => `<div style="border-color:${event.color}">${event.message}</div>`)
        .join('');
}

function startDirectorEvent() {
    const event = directorEvents[game.director.cycle % directorEvents.length];
    game.director.cycle += 1;
    game.director.active = event;
    game.director.time = event.duration;
    game.director.gravityScale = event.name === 'GRAVITY FLUX' ? 0.45 : 1;
    game.director.inputInverted = event.name === 'MIRROR CURRENT';
    game.director.damageScale = event.name === 'OVERDRIVE WINDOW' ? 1.45 : 1;
    recordEvent(`DIRECTOR // ${event.name}`, event.color);
    playEffect('powerup');
}

function updateDirector(delta) {
    if (game.director.active) {
        game.director.time -= delta;
        if (game.director.time <= 0) {
            recordEvent(`DIRECTOR // ${game.director.active.name} ENDED`, '#8fa7d4');
            game.director.active = null;
            game.director.gravityScale = 1;
            game.director.inputInverted = false;
            game.director.damageScale = 1;
            game.director.next = 10 + Math.random() * 4;
        }
    } else {
        game.director.next -= delta;
        if (game.director.next <= 0) startDirectorEvent();
    }
}

function getPlayerName() {
    return (ui.playerName.value.trim() || 'PLAYER 1').slice(0, 24);
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) throw new Error('Leaderboard unavailable');
        const entries = await response.json();
        ui.leaderboard.innerHTML = entries.length
            ? entries.slice(0, 5).map((entry, index) => `<div class="leaderboard-row"><span>${index + 1}. ${entry.player}</span><strong>${entry.wins}W / ${entry.losses}L</strong></div>`).join('')
            : '<span>No pilots on the board yet.</span>';
    } catch {
        ui.leaderboard.innerHTML = '<span>Cloud board unavailable. Local mode active.</span>';
    }
}

async function checkCloudApi() {
    try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error('Cloud API unavailable');
        cloudStatus.textContent = 'CLOUD SCORES: ONLINE';
        cloudStatus.classList.add('online');
    } catch {
        cloudStatus.textContent = 'CLOUD SCORES: LOCAL MODE';
    }
}

async function recordMatchResult() {
    try {
        await fetch('/api/matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player: getPlayerName(),
                playerScore: game.scores.p1,
                opponentScore: game.scores.p2
            })
        });
    } catch {
        // The match is still complete when the optional cloud API is offline.
    }
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function resumeAudio() {
    if (audioContext.state !== 'running') {
        audioContext.resume().catch(() => {});
    }
}

function playTone(frequency, duration = 0.08, volume = 0.12) {
    if (!audioEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

function playEffect(name) {
    if (!audioEnabled) return;
    switch (name) {
        case 'dash':
            playTone(320, 0.06, 0.08);
            playTone(430, 0.08, 0.06);
            break;
        case 'attack':
            playTone(280, 0.05, 0.12);
            playTone(180, 0.08, 0.08);
            break;
        case 'hit':
            playTone(120, 0.05, 0.14);
            playTone(220, 0.07, 0.08);
            break;
        case 'powerup':
            playTone(520, 0.1, 0.12);
            playTone(680, 0.12, 0.08);
            break;
        case 'start':
            playTone(360, 0.1, 0.09);
            playTone(420, 0.18, 0.08);
            break;
        case 'win':
            playTone(460, 0.14, 0.12);
            playTone(620, 0.18, 0.08);
            break;
    }
}

function rectangleCollision(rect1, rect2) {
    return (
        rect1.position.x + rect1.width >= rect2.position.x &&
        rect1.position.x <= rect2.position.x + rect2.width &&
        rect1.position.y + rect1.height >= rect2.position.y &&
        rect1.position.y <= rect2.position.y + rect2.height
    );
}

function rectangleOverlap(a, b) {
    return (
        a.position.x < b.position.x + b.width &&
        a.position.x + a.width > b.position.x &&
        a.position.y < b.position.y + b.height &&
        a.position.y + a.height > b.position.y
    );
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

class Particle {
    constructor(x, y, color, velocity, radius, life) {
        this.position = { x, y };
        this.velocity = velocity;
        this.color = color;
        this.radius = radius;
        this.life = life;
        this.alpha = 1;
    }

    update(delta) {
        this.position.x += this.velocity.x * delta * 60;
        this.position.y += this.velocity.y * delta * 60;
        this.life -= delta;
        this.alpha = clamp(this.life * 1.6, 0, 1);
    }

    draw() {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Powerup {
    constructor(type, x) {
        this.type = type;
        this.position = { x, y: FLOOR_Y - 26 };
        this.width = 46;
        this.height = 46;
        this.timer = 0;
        this.isCollected = false;
        this.spawnTime = performance.now();
    }

    update(delta) {
        this.timer += delta;
    }

    draw() {
        const bob = Math.sin(this.timer * 3.2) * 8;
        const centerX = this.position.x + this.width / 2;
        const centerY = this.position.y + this.height / 2 + bob;

        ctx.save();
        ctx.translate(centerX, centerY);
        const colors = {
            HEAL: ['#84ff8d', '#2ce8a6'],
            METER: ['#75d4ff', '#4a7cff'],
            SHIELD: ['#b885ff', '#7b57ff'],
            BOOST: ['#ffab3b', '#ff5d60']
        };
        const [inner, outer] = colors[this.type] || ['#ffffff', '#ffea00'];

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
        gradient.addColorStop(0, inner);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    getHitbox() {
        return {
            position: {
                x: this.position.x,
                y: this.position.y + Math.sin(this.timer * 3.2) * 8
            },
            width: this.width,
            height: this.height
        };
    }
}

class Player {
    constructor({ name, color, accent, x, isAI = false }) {
        this.name = name;
        this.color = color;
        this.accent = accent;
        this.isAI = isAI;
        this.width = 52;
        this.height = 146;
        this.position = { x, y: FLOOR_Y - this.height };
        this.velocity = { x: 0, y: 0 };
        this.facing = 1;
        this.health = 100;
        this.maxHealth = 100;
        this.meter = 0;
        this.isBlocking = false;
        this.isIntangible = false;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.attackCooldown = 0;
        this.specialCooldown = 0;
        this.attackHit = false;
        this.activeAttack = null;
        this.stunTimer = 0;
        this.stateTimer = 0;
        this.grounded = true;
        this.airJumps = 1;
        this.effects = [];
        this.speedMultiplier = 1;
        this.damageMultiplier = 1;
        this.dashCooldownBase = 0.92;
    }

    get hitbox() {
        return {
            position: { x: this.position.x, y: this.position.y },
            width: this.width,
            height: this.height
        };
    }

    get attackBox() {
        if (!this.activeAttack) return null;

        const width = this.activeAttack.width;
        const height = this.activeAttack.height;
        const xOffset = this.facing * this.activeAttack.offsetX;
        const x = this.position.x + this.width / 2 + xOffset - width / 2;
        const y = this.position.y + this.activeAttack.offsetY;

        return {
            position: { x, y },
            width,
            height
        };
    }

    reset(x) {
        this.position.x = x;
        this.position.y = FLOOR_Y - this.height;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.facing = x < CANVAS_WIDTH / 2 ? 1 : -1;
        this.health = this.maxHealth;
        this.meter = 0;
        this.isBlocking = false;
        this.isIntangible = false;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.attackCooldown = 0;
        this.specialCooldown = 0;
        this.attackHit = false;
        this.activeAttack = null;
        this.stunTimer = 0;
        this.stateTimer = 0;
        this.grounded = true;
        this.airJumps = 1;
        this.effects = [];
        this.speedMultiplier = 1;
    }

    move(direction) {
        if (this.stunTimer > 0 || this.health <= 0) return;
        this.facing = direction || this.facing;
        const speed = 0.38 * this.speedMultiplier;
        this.velocity.x += direction * speed;
        this.velocity.x = clamp(this.velocity.x, -10 * this.speedMultiplier, 10 * this.speedMultiplier);
        if (this.grounded && !this.isDashing && !this.isBlocking && this.activeAttack === null) {
            this.stateTimer = 0.12;
        }
    }

    jump() {
        if (this.health <= 0 || this.stunTimer > 0) return;
        if (this.grounded || this.airJumps > 0) {
            this.velocity.y = -18;
            this.grounded = false;
            if (!this.grounded) this.airJumps -= 1;
            this.stateTimer = 0.2;
            this.state = 'JUMP';
            playEffect('dash');
        }
    }

    startBlock() {
        if (this.health <= 0) return;
        this.isBlocking = true;
        this.state = 'BLOCK';
    }

    stopBlock() {
        this.isBlocking = false;
        if (this.state === 'BLOCK') {
            this.state = 'NEUTRAL';
        }
    }

    attack() {
        if (this.health <= 0 || this.attackCooldown > 0 || this.activeAttack || this.stunTimer > 0) return;
        this.attackCooldown = 0.45;
        this.activeAttack = {
            width: 68,
            height: 22,
            offsetX: 42,
            offsetY: 74,
            damage: 16 * this.damageMultiplier,
            time: 0.16,
            hit: false,
            special: false
        };
        this.state = 'ATTACK';
        this.stateTimer = 0.18;
        playEffect('attack');
    }

    useSpecial() {
        if (this.health <= 0 || this.specialCooldown > 0 || this.meter < 100 || this.stunTimer > 0) return false;
        this.meter = 0;
        this.specialCooldown = 2.2;
        this.isIntangible = true;
        this.state = 'SPECIAL';
        this.stateTimer = 0.4;
        this.activeAttack = {
            width: 120,
            height: 36,
            offsetX: 78,
            offsetY: 58,
            damage: 34,
            time: 0.24,
            hit: false,
            special: true
        };
        this.attackCooldown = 0.8;
        createImpact(this.position.x + this.width / 2, this.position.y + this.height / 2, 30, '#7fe7ff');
        playEffect('powerup');
        if (this === player1) game.stats.specials += 1;
        return true;
    }

    dash(direction) {
        if (this.health <= 0 || this.dashCooldown > 0 || this.isDashing || this.stunTimer > 0) return;
        this.isDashing = true;
        this.isIntangible = true;
        this.dashTimer = 0.18;
        this.dashCooldown = this.dashCooldownBase;
        this.state = 'DASH';
        this.stateTimer = 0.18;
        this.velocity.x = direction * 24 * this.speedMultiplier;
        this.facing = direction;
        if (this === player1) game.stats.dashes += 1;
        playEffect('dash');
    }

    takeDamage(amount, attacker = null) {
        if (this.health <= 0) return;

        if (this.isBlocking && attacker && attacker.activeAttack && attacker.activeAttack.time > 0.06 && attacker.activeAttack.time < 0.18) {
            const perfectBlockWindow = Math.abs(attacker.position.x - this.position.x) < 160;
            if (perfectBlockWindow) {
                this.chargeMeter(35);
                if (this === player1) game.stats.perfectGuards += 1;
                this.state = 'PARRY';
                this.stateTimer = 0.35;
                this.isBlocking = false;
                this.isIntangible = false;
                attacker.activeAttack = null;
                attacker.attackHit = true;
                attacker.stunTimer = 0.35;
                createImpact(this.position.x + this.width / 2, this.position.y + this.height / 2, 22, '#97ebff');
                playEffect('powerup');
                return;
            }
        }

        if (this.isBlocking) {
            amount *= 0.35;
        }

        this.health -= amount;
        this.health = clamp(this.health, 0, 100);
        this.stunTimer = this.isBlocking ? 0.14 : 0.24;
        this.state = 'HIT';
        this.stateTimer = 0.22;
        this.isDashing = false;
        this.isIntangible = false;
        this.activeAttack = null;
        this.attackHit = false;

        if (attacker) {
            attacker.chargeMeter(15);
            if (attacker === player1) {
                game.stats.damage += amount;
                game.stats.hits += 1;
                game.stats.combo += 1;
                game.stats.bestCombo = Math.max(game.stats.bestCombo, game.stats.combo);
            }
        }
        if (this === player1) game.stats.combo = 0;

        createImpact(this.position.x + this.width / 2, this.position.y + this.height / 2, 16, '#ff6f6f');
        playEffect('hit');
    }

    heal(amount) {
        this.health = clamp(this.health + amount, 0, 100);
    }

    chargeMeter(amount) {
        this.meter = clamp(this.meter + amount, 0, 100);
    }

    applyPowerup(type) {
        switch (type) {
            case 'HEAL':
                this.heal(22);
                this.chargeMeter(16);
                break;
            case 'METER':
                this.chargeMeter(38);
                break;
            case 'SHIELD':
                this.effects.push({ type: 'SHIELD', timer: 4.0 });
                break;
            case 'BOOST':
                this.effects.push({ type: 'BOOST', timer: 4.0 });
                break;
        }

        playEffect('powerup');
        if (this === player1) game.stats.powerups += 1;
    }

    updateEffects(delta) {
        let hasShield = false;
        let hasBoost = false;

        this.effects = this.effects.filter(effect => {
            effect.timer -= delta;
            if (effect.timer > 0) {
                if (effect.type === 'SHIELD') {
                    hasShield = true;
                }
                if (effect.type === 'BOOST') {
                    hasBoost = true;
                }
                return true;
            }
            return false;
        });

        this.isBlocking = hasShield || this.isBlocking;
        this.speedMultiplier = hasBoost ? 1.35 : 1;
    }

    update(delta) {
        this.updateEffects(delta);

        if (this.health <= 0) {
            this.velocity.x *= 0.92;
            return;
        }

        if (this.attackCooldown > 0) this.attackCooldown = Math.max(this.attackCooldown - delta, 0);
        if (this.dashCooldown > 0) this.dashCooldown = Math.max(this.dashCooldown - delta, 0);
        if (this.specialCooldown > 0) this.specialCooldown = Math.max(this.specialCooldown - delta, 0);
        if (this.stunTimer > 0) this.stunTimer = Math.max(this.stunTimer - delta, 0);
        if (this.stateTimer > 0) this.stateTimer = Math.max(this.stateTimer - delta, 0);

        if (this.dashTimer > 0) {
            this.dashTimer = Math.max(this.dashTimer - delta, 0);
            if (this.dashTimer === 0) {
                this.isDashing = false;
                this.isIntangible = false;
                this.state = 'RECOVER';
                this.stateTimer = 0.16;
            }
        }

        if (!this.isDashing && Math.abs(this.velocity.x) > 0.1) {
            this.velocity.x *= 0.88;
        }

        this.velocity.y += GRAVITY;
        this.position.x += this.velocity.x * delta * 60;
        this.position.y += this.velocity.y * delta * 60;

        if (this.position.x < 14) {
            this.position.x = 14;
            this.velocity.x = 0;
        }
        if (this.position.x + this.width > CANVAS_WIDTH - 14) {
            this.position.x = CANVAS_WIDTH - this.width - 14;
            this.velocity.x = 0;
        }

        if (this.position.y + this.height >= FLOOR_Y) {
            this.position.y = FLOOR_Y - this.height;
            this.velocity.y = 0;
            if (!this.grounded) {
                this.grounded = true;
                this.airJumps = 1;
            }
        } else {
            this.grounded = false;
        }

        if (!this.isDashing && this.stateTimer <= 0 && this.stunTimer <= 0 && !this.activeAttack && !this.isBlocking) {
            this.state = 'NEUTRAL';
        }

        if (this.activeAttack) {
            this.activeAttack.time -= delta;
            if (this.activeAttack.time <= 0) {
                this.activeAttack = null;
                this.attackHit = false;
                if (this.state === 'SPECIAL') {
                    this.isIntangible = false;
                    this.state = 'RECOVER';
                    this.stateTimer = 0.16;
                }
            }
        }

        if (this.meter < 100) {
            this.meter = clamp(this.meter + delta * 3.5, 0, 100);
        }
    }

    draw() {
        const pulse = Math.abs(Math.sin(performance.now() / 220));
        ctx.save();
        if (this.isIntangible || this.state === 'DASH') {
            ctx.globalAlpha = 0.75;
        }

        const auraStrength = this.effects.some(effect => effect.type === 'BOOST') ? 0.22 : 0;
        if (auraStrength) {
            ctx.fillStyle = 'rgba(255, 190, 70, 0.16)';
            ctx.fillRect(this.position.x - 8, this.position.y - 8, this.width + 16, this.height + 16);
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

        ctx.fillStyle = this.accent;
        ctx.fillRect(this.position.x + this.facing * 6 + 10, this.position.y + 28, 12, 68);

        if (this.isBlocking || this.effects.some(effect => effect.type === 'SHIELD')) {
            ctx.strokeStyle = 'rgba(115, 85, 255, 0.35)';
            ctx.lineWidth = 8;
            ctx.strokeRect(this.position.x - 4, this.position.y - 4, this.width + 8, this.height + 8);
        }

        ctx.fillStyle = '#0d1019';
        ctx.fillRect(this.position.x + 10, this.position.y + 20, 32, 18);
        ctx.fillRect(this.position.x + 10, this.position.y + 42, 32, 8);

        ctx.fillStyle = '#dde4ff';
        ctx.fillRect(this.position.x + 26 + this.facing * 2, this.position.y + 28, 10, 10);
        ctx.restore();

        if (this.activeAttack) {
            const box = this.attackBox;
            ctx.save();
            ctx.globalAlpha = 0.5 + pulse * 0.25;
            ctx.fillStyle = '#86d3ff';
            ctx.fillRect(box.position.x, box.position.y, box.width, box.height);
            ctx.restore();
        }
    }
}

const player1 = new Player({ name: 'PLAYER 1', color: '#40a8ff', accent: '#88e3ff', x: 140, isAI: false });
const player2 = new Player({ name: 'AI', color: '#ff5f71', accent: '#ff9aa8', x: CANVAS_WIDTH - 190, isAI: true });

const game = {
    state: STATE.TITLE,
    roundTimer: ROUND_DURATION,
    countdown: 3.6,
    roundNumber: 1,
    scores: { p1: 0, p2: 0 },
    powerupTimer: 0,
    particles: [],
    powerups: [],
    roundDelay: 0,
    difficulty: 'veteran',
    loadout: 'striker',
    stats: { hits: 0, damage: 0, dashes: 0, powerups: 0, specials: 0, perfectGuards: 0, combo: 0, bestCombo: 0 },
    director: { active: null, time: 0, next: 9, cycle: 0, gravityScale: 1, inputInverted: false, damageScale: 1 },
    adaptation: { blocks: 0, dashes: 0, attacks: 0 }
};

function updateUI() {
    ui.timer.textContent = Math.max(0, Math.ceil(game.roundTimer));
    ui.player1Health.style.width = `${player1.health}%`;
    ui.player2Health.style.width = `${player2.health}%`;
    ui.player1Meter.style.width = `${player1.meter}%`;
    ui.player2Meter.style.width = `${player2.meter}%`;
    ui.player1Score.textContent = game.scores.p1;
    ui.player2Score.textContent = game.scores.p2;
    ui.roundLabel.textContent = `Round ${game.roundNumber} / ${MAX_ROUNDS}`;
    ui.pauseButton.textContent = game.state === STATE.PAUSED ? 'RESUME' : 'PAUSE';
    updateProfileUI();
}

function showStartMenu() {
    overlay.classList.remove('hidden');
    startMenu.classList.remove('hidden');
    messagePanel.classList.add('hidden');
    overlayAction.classList.add('hidden');
}

function showMessage(title, subtitle = '', actionText = '', actionHandler = null) {
    overlay.classList.remove('hidden');
    startMenu.classList.add('hidden');
    messagePanel.classList.remove('hidden');
    debriefPanel.classList.add('hidden');
    statusMessage.textContent = title;
    subtitleMessage.textContent = subtitle;

    if (actionText && actionHandler) {
        overlayAction.classList.remove('hidden');
        overlayAction.textContent = actionText;
        overlayAction.onclick = actionHandler;
    } else {
        overlayAction.classList.add('hidden');
        overlayAction.onclick = null;
    }
}

function applyLoadout() {
    const loadout = loadoutProfiles[game.loadout];
    player1.maxHealth = loadout.maxHealth;
    player1.damageMultiplier = loadout.damageMultiplier;
    player1.dashCooldownBase = loadout.dashCooldown;
}

function hideOverlay() {
    overlay.classList.add('hidden');
}

function resetPlayers() {
    player1.reset(140);
    player2.reset(CANVAS_WIDTH - 190);
}

function startMatch() {
    resumeAudio();
    game.scores = { p1: 0, p2: 0 };
    game.roundNumber = 1;
    game.powerups = [];
    game.particles = [];
    game.difficulty = ui.difficulty.value;
    game.loadout = ui.loadout.value;
    game.stats = { hits: 0, damage: 0, dashes: 0, powerups: 0, specials: 0, perfectGuards: 0, combo: 0, bestCombo: 0 };
    applyLoadout();
    startRound();
}

function startRound() {
    resetPlayers();
    game.roundTimer = ROUND_DURATION;
    game.countdown = 3.6;
    game.powerupTimer = 0;
    game.roundDelay = 0;
    game.state = STATE.COUNTDOWN;
    showMessage(`ROUND ${game.roundNumber}`, 'Get ready for the next strike');
    playEffect('start');
    updateUI();
}

function pauseRound() {
    if (game.state !== STATE.PLAYING) return;
    game.state = STATE.PAUSED;
    showMessage('PAUSED', 'Press RESUME or ESC to continue', 'RESUME', resumeRound);
}

function resumeRound() {
    if (game.state !== STATE.PAUSED) return;
    game.state = STATE.PLAYING;
    hideOverlay();
}

function calculateRoundWinner() {
    if (player1.health === player2.health) {
        return null;
    }
    return player1.health > player2.health ? 'PLAYER 1' : 'AI';
}

function endRound(winner) {
    if (winner === 'PLAYER 1') {
        game.scores.p1 += 1;
    } else if (winner === 'AI') {
        game.scores.p2 += 1;
    }

    const winnerText = winner ? `${winner} WINS` : 'DRAW';
    showMessage(winnerText, 'Preparing next round...');
    game.state = STATE.ROUND_END;
    game.roundDelay = 2.8;
    updateUI();

    if (winner === 'PLAYER 1') {
        playEffect('win');
    } else if (winner === 'AI') {
        playEffect('hit');
    }
}

function endMatch() {
    const winner = game.scores.p1 > game.scores.p2 ? 'PLAYER 1' : 'AI';
    game.state = STATE.GAME_OVER;
    const contract = getContract();
    const contractComplete = contract.getValue(game.stats) >= contract.target;
    const matchScore = Math.round(game.stats.damage + game.stats.hits * 12 + game.stats.bestCombo * 18 + game.stats.perfectGuards * 25);
    const xpEarned = 100 + game.scores.p1 * 75 + Math.round(matchScore / 20) + (contractComplete ? 150 : 0);
    profile.matches += 1;
    if (winner === 'PLAYER 1') profile.wins += 1;
    profile.xp += xpEarned;
    saveProfile();
    recordMatchResult();
    const stats = game.stats;
    showMessage(`${winner} TAKES IT`, `${difficultyProfiles[game.difficulty].label} // ${loadoutProfiles[game.loadout].label} LOADOUT`, 'REMATCH', startMatch);
    debriefPanel.classList.remove('hidden');
    debriefResult.textContent = winner === 'PLAYER 1' ? 'VICTORY' : 'DEFEAT';
    debriefXp.textContent = `+${xpEarned} XP`;
    debriefScore.textContent = `${matchScore} // ${stats.hits} HITS`;
    debriefContract.textContent = contractComplete ? 'COMPLETE +150 XP' : `${contract.getValue(stats)} / ${contract.target}`;
    playEffect('win');
    loadLeaderboard();
}

function spawnPowerup() {
    const types = ['HEAL', 'METER', 'SHIELD', 'BOOST'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = clamp(Math.random() * (CANVAS_WIDTH - 140) + 70, 80, CANVAS_WIDTH - 120);
    game.powerups.push(new Powerup(type, x));
}

function createImpact(x, y, amount, color) {
    for (let i = 0; i < amount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        game.particles.push(new Particle(x, y, color, { x: vx, y: vy }, Math.random() * 2.6 + 1.4, 0.35 + Math.random() * 0.18));
    }
}

function applyPlayerInput() {
    if (game.state !== STATE.PLAYING) return;
    if (inputState.left) {
        player1.move(-1);
    }
    if (inputState.right) {
        player1.move(1);
    }
    if (!inputState.left && !inputState.right && player1.grounded && !player1.isDashing) {
        player1.velocity.x *= 0.94;
    }
    player1.isBlocking = inputState.block;
    if (player1.isBlocking) {
        player1.state = 'BLOCK';
    }
}

function updateAI(delta) {
    if (game.state !== STATE.PLAYING || !player2.isAI || player2.health <= 0) return;

    const distance = player1.position.x - player2.position.x;
    const absDistance = Math.abs(distance);
    const direction = Math.sign(distance) || 1;
    const profile = difficultyProfiles[game.difficulty];

    if (player2.stunTimer > 0) {
        return;
    }

    if (player2.activeAttack === null && player2.attackCooldown <= 0 && absDistance < 170 && Math.random() < 0.14 * profile.aggression) {
        player2.attack();
    }

    if (player2.dashCooldown <= 0 && absDistance > 250 && Math.random() < 0.04 * profile.aggression) {
        player2.dash(direction);
    }

    if (absDistance > 120) {
        if (Math.random() < 0.72 * profile.aggression) {
            player2.move(direction);
        }
    } else {
        player2.velocity.x *= 0.92;
    }

    if (player2.grounded && absDistance < 130 && Math.random() < 0.035 * profile.aggression) {
        player2.jump();
    }

    if (player2.health < 36 && Math.random() < 0.012 * profile.aggression) {
        player2.startBlock();
    }
    if (player2.isBlocking && Math.random() < 0.06) {
        player2.stopBlock();
    }
}

function handleAttackCollisions() {
    const players = [player1, player2];

    players.forEach((attacker, index) => {
        const defender = players[1 - index];
        const attackBox = attacker.attackBox;
        if (!attackBox || attacker.attackHit || defender.health <= 0) return;

        if (rectangleOverlap(attackBox, defender.hitbox) && !defender.isIntangible) {
            const perfectGuard = defender.isBlocking && attacker.activeAttack && attacker.activeAttack.time > 0.06 && attacker.activeAttack.time < 0.18;
            if (perfectGuard) {
                defender.takeDamage(attacker.activeAttack.damage, attacker);
                return;
            }

            defender.takeDamage(attacker.activeAttack.damage, attacker);
            attacker.attackHit = true;
            createImpact(defender.position.x + defender.width / 2, defender.position.y + defender.height / 2, 18, '#ffbd6f');
        }
    });
}

function handlePowerupCollisions() {
    game.powerups.forEach(powerup => {
        if (powerup.isCollected) return;
        const hitbox = powerup.getHitbox();
        if (rectangleOverlap(hitbox, player1.hitbox)) {
            powerup.isCollected = true;
            player1.applyPowerup(powerup.type);
            showMessage('POWERUP ACQUIRED', `${powerup.type} collected`, '', null);
        }
    });
    game.powerups = game.powerups.filter(powerup => !powerup.isCollected);
}

function updateEntities(delta) {
    player1.update(delta);
    player2.update(delta);
    handleAttackCollisions();

    game.powerups.forEach(powerup => powerup.update(delta));
    handlePowerupCollisions();

    game.particles.forEach(particle => particle.update(delta));
    game.particles = game.particles.filter(particle => particle.life > 0);
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#06101f');
    gradient.addColorStop(0.45, '#040612');
    gradient.addColorStop(1, '#020307');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.strokeStyle = 'rgba(96, 130, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#060a16';
    ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y);

    ctx.save();
    const beam = ctx.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 150);
    beam.addColorStop(0, 'rgba(81, 107, 255, 0.16)');
    beam.addColorStop(1, 'rgba(2, 6, 16, 0.05)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, 150);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, FLOOR_Y + 6);
    ctx.lineTo(CANVAS_WIDTH - 24, FLOOR_Y + 6);
    ctx.stroke();
}

function drawEntities() {
    game.powerups.forEach(powerup => powerup.draw());
    player1.draw();
    player2.draw();
    game.particles.forEach(particle => particle.draw());
}

function drawHUD() {
    const timeColor = game.roundTimer < 10 ? '#ff6f6f' : '#d7e5ff';
    ui.timer.style.color = timeColor;
    if (ui.combatStatus) {
        if (player1.meter >= 100) {
            ui.combatStatus.textContent = 'SPECIAL READY';
            ui.combatStatus.classList.add('combo-live');
        } else if (game.stats.combo > 1) {
            ui.combatStatus.textContent = `COMBO x${game.stats.combo}`;
            ui.combatStatus.classList.add('combo-live');
        } else {
            ui.combatStatus.textContent = `${difficultyProfiles[game.difficulty].label} PROFILE`;
            ui.combatStatus.classList.remove('combo-live');
        }
    }
}

function animate(timestamp) {
    const delta = Math.min((timestamp - lastFrame) / 1000, 0.033);
    lastFrame = timestamp;

    updateUI();
    drawBackground();

    if (game.state === STATE.PLAYING) {
        applyPlayerInput();
        updateAI(delta);
        updateEntities(delta);

        game.powerupTimer += delta;
        if (game.powerupTimer > POWERUP_INTERVAL) {
            spawnPowerup();
            game.powerupTimer = 0;
        }

        game.roundTimer -= delta;
        if (game.roundTimer <= 0) {
            const winner = calculateRoundWinner();
            endRound(winner);
        }

        if (player1.health <= 0 || player2.health <= 0) {
            const winnerText = player1.health > player2.health ? 'PLAYER 1' : 'AI';
            endRound(winnerText);
        }
    }

    if (game.state === STATE.COUNTDOWN) {
        game.countdown -= delta;
        statusMessage.textContent = Math.ceil(game.countdown);
        subtitleMessage.textContent = 'Fight!';
        if (game.countdown <= 0) {
            hideOverlay();
            game.state = STATE.PLAYING;
        }
    }

    if (game.state === STATE.ROUND_END) {
        game.roundDelay -= delta;
        if (game.roundDelay <= 0) {
            if (game.scores.p1 > MAX_ROUNDS / 2 || game.scores.p2 > MAX_ROUNDS / 2 || game.roundNumber >= MAX_ROUNDS) {
                endMatch();
            } else {
                game.roundNumber += 1;
                startRound();
            }
        }
    }

    if (game.state === STATE.PLAYING && game.state !== STATE.PAUSED) {
        drawEntities();
    } else {
        drawEntities();
    }

    drawHUD();
    requestAnimationFrame(animate);
}

startButton.addEventListener('click', () => {
    resumeAudio();
    startMatch();
});

touchControls.querySelectorAll('button').forEach(button => {
    const action = button.dataset.control;
    button.addEventListener('pointerdown', () => {
        resumeAudio();
        switch (action) {
            case 'left':
                inputState.left = true;
                break;
            case 'right':
                inputState.right = true;
                break;
            case 'jump':
                player1.jump();
                break;
            case 'dash':
                player1.dash(player1.facing);
                break;
            case 'attack':
                player1.attack();
                break;
            case 'special':
                player1.useSpecial();
                break;
        }
    });
    button.addEventListener('pointerup', () => {
        if (action === 'left') inputState.left = false;
        if (action === 'right') inputState.right = false;
    });
    button.addEventListener('pointerleave', () => {
        if (action === 'left') inputState.left = false;
        if (action === 'right') inputState.right = false;
    });
});

ui.pauseButton.addEventListener('click', () => {
    if (game.state === STATE.PLAYING) {
        pauseRound();
    } else if (game.state === STATE.PAUSED) {
        resumeRound();
    }
});

ui.audioToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    ui.audioToggle.textContent = audioEnabled ? 'AUDIO ON' : 'AUDIO OFF';
});

ui.playerName.addEventListener('input', () => {
    ui.playerName.value = ui.playerName.value.replace(/[^a-z0-9 _-]/gi, '').slice(0, 24);
    try {
        localStorage.setItem('slipstream.callsign', ui.playerName.value);
    } catch {
        // The current callsign still works for this session.
    }
});

ui.difficulty.addEventListener('change', () => {
    try {
        localStorage.setItem('slipstream.profile', ui.difficulty.value);
    } catch {
        // The selected profile still works for this session.
    }
});

ui.loadout.addEventListener('change', () => {
    try {
        localStorage.setItem('slipstream.loadout', ui.loadout.value);
    } catch {
        // The selected loadout still works for this session.
    }
});

overlayAction.addEventListener('click', () => {
    if (overlayAction.onclick) {
        overlayAction.onclick();
    }
});

window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        if (game.state === STATE.PLAYING) {
            pauseRound();
        } else if (game.state === STATE.PAUSED) {
            resumeRound();
        }
    }

    if (game.state === STATE.TITLE && event.key === 'Enter') {
        startMatch();
    }

    if (event.key === 'a' || event.key === 'A') {
        inputState.left = true;
    }
    if (event.key === 'd' || event.key === 'D') {
        inputState.right = true;
    }
    if (event.key === 's' || event.key === 'S') {
        inputState.block = true;
        player1.startBlock();
    }
    if (event.key === 'w' || event.key === 'W') {
        player1.jump();
    }
    if (event.key === 'f' || event.key === 'F') {
        player1.attack();
    }
    if (event.key === 'r' || event.key === 'R') {
        player1.useSpecial();
    }
    if (event.key === 'q' || event.key === 'Q') {
        player1.dash(-1);
    }
    if (event.key === 'e' || event.key === 'E') {
        player1.dash(1);
    }
});

window.addEventListener('keyup', event => {
    if (event.key === 'a' || event.key === 'A') {
        inputState.left = false;
    }
    if (event.key === 'd' || event.key === 'D') {
        inputState.right = false;
    }
    if (event.key === 's' || event.key === 'S') {
        inputState.block = false;
        player1.stopBlock();
    }
});

window.addEventListener('blur', () => {
    if (game.state === STATE.PLAYING) {
        pauseRound();
    }
});

showStartMenu();
checkCloudApi();
loadLeaderboard();
requestAnimationFrame(timestamp => {
    lastFrame = timestamp;
    animate(timestamp);
});